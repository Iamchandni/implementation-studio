import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from jsonschema import Draft202012Validator

from app.core.config import settings
from app.core.requirement_extraction import _chat_completions_url


SCHEMA_ROOT = Path(__file__).resolve().parents[2] / "schemas" / "artefacts"
CATEGORY_SCHEMAS = {
    "PARAMETER": "parameter.schema.json",
    "BUSINESS_RULE": "business_rule.schema.json",
    "VALIDATION": "validation.schema.json",
    "WORKFLOW": "workflow.schema.json",
}
REQUIREMENT_CATEGORY = {
    "PARAMETER": "PARAMETER",
    "BUSINESS_RULE": "BUSINESS_RULE",
    "VALIDATION": "VALIDATION",
    "FIELD": "VALIDATION",
    "WORKFLOW": "WORKFLOW",
}


class ArtefactProviderError(RuntimeError):
    pass


def _read_schema(artefact_type: str) -> tuple[str, dict[str, Any]]:
    relative_path = CATEGORY_SCHEMAS[artefact_type]
    schema_path = SCHEMA_ROOT / relative_path
    return f"artefacts/{relative_path}", json.loads(schema_path.read_text(encoding="utf-8"))


def _validation_errors(schema: dict[str, Any], artefact: dict[str, Any]) -> list[str]:
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(artefact), key=lambda error: list(error.absolute_path))
    return [
        f"{'.'.join(str(part) for part in error.absolute_path) or '<root>'}: {error.message}"
        for error in errors
    ]


async def _generate_category(
    artefact_type: str,
    requirements: list[dict[str, Any]],
    endpoint: str,
    model: str,
    api_key: str,
) -> list[dict[str, Any]]:
    schema_path, schema = _read_schema(artefact_type)
    prompt = {
        "task": "Generate implementation artefacts from approved canonical requirements.",
        "response_contract": {"artefacts": [
            {"artefact_type": artefact_type, "name": "string", "description": "string", "configuration": "object", "source_requirements": ["REQ-..." ]}
        ]},
        "rules": [
            "Return JSON only with an artefacts array.",
            "Generate only the requested artefact_type and use only the supplied approved requirement IDs.",
            "Every artefact must cite one or more source_requirements that directly support it.",
            "Do not invent values; omit an artefact if the requirements do not support a complete configuration.",
            "The configuration must conform to the provided category schema.",
        ],
        "category_schema_path": schema_path,
        "category_schema": schema,
        "approved_requirements": requirements,
    }
    body = {
        "model": model,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Generate conservative, schema-conforming implementation configuration from approved requirements. Return JSON only."},
            {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(
                _chat_completions_url(endpoint),
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=body,
            )
            response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        parsed = json.loads(content)
    except (httpx.HTTPError, KeyError, IndexError, TypeError, json.JSONDecodeError) as error:
        raise ArtefactProviderError(f"{artefact_type} generation provider failed: {error}") from error
    if not isinstance(parsed, dict) or not isinstance(parsed.get("artefacts"), list):
        raise ArtefactProviderError(f"{artefact_type} response must contain an artefacts array.")
    return parsed["artefacts"]


async def generate_artefacts(
    document: dict[str, Any],
    endpoint: str | None,
    model: str | None,
    api_key: str | None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    requirements = document.get("requirements", [])
    approved = [item for item in requirements if item.get("status") == "APPROVED"]
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for requirement in approved:
        category = REQUIREMENT_CATEGORY.get(requirement.get("requirement_type"))
        if category:
            grouped[category].append(requirement)

    effective_key = api_key or settings.llm_api_key
    if grouped and not effective_key:
        raise ValueError("An API key is required to generate implementation artefacts.")

    generated: list[dict[str, Any]] = []
    produced_requirement_ids: set[str] = set()
    chosen_endpoint = endpoint or settings.llm_endpoint
    chosen_model = model or settings.llm_model

    for category, category_requirements in grouped.items():
        raw_artefacts = await _generate_category(category, category_requirements, chosen_endpoint, chosen_model, effective_key)
        approved_ids = {item["requirement_id"] for item in category_requirements}
        schema_path, schema = _read_schema(category)
        for raw in raw_artefacts:
            if not isinstance(raw, dict):
                raise ArtefactProviderError(f"{category} provider returned a non-object artefact.")
            source_ids = raw.get("source_requirements")
            if raw.get("artefact_type") != category or not isinstance(source_ids, list) or not source_ids:
                raise ArtefactProviderError(f"{category} artefacts must declare their type and source_requirements.")
            if not all(isinstance(source_id, str) for source_id in source_ids) or not set(source_ids).issubset(approved_ids):
                raise ArtefactProviderError(f"{category} artefact links to a requirement that was not approved for this category.")

            timestamp = datetime.now(timezone.utc).isoformat()
            artefact = {
                "artefact_id": f"ART-{len(generated) + 1:04d}",
                "artefact_type": category,
                "name": raw.get("name"),
                "description": raw.get("description", ""),
                "configuration": raw.get("configuration", {}),
                "source_requirements": list(dict.fromkeys(source_ids)),
                "status": "DRAFT",
                "version": 1,
                "schema_version": "1.0",
                "created_at": timestamp,
                "updated_at": timestamp,
            }
            errors = _validation_errors(schema, artefact)
            artefact["status"] = "VALIDATED" if not errors else "VALIDATION_FAILED"
            generated.append({
                "artefact": artefact,
                "schema_path": schema_path,
                "validation_passed": not errors,
                "validation_errors": errors,
            })
            produced_requirement_ids.update(source_ids)

    unproduced = []
    for requirement in requirements:
        requirement_id = requirement["requirement_id"]
        if requirement_id in produced_requirement_ids:
            continue
        category = REQUIREMENT_CATEGORY.get(requirement.get("requirement_type"))
        if requirement.get("status") != "APPROVED":
            reason = "not_approved"
        elif category is None:
            reason = "unsupported_requirement_type"
        else:
            reason = "no_artefact_generated"
        unproduced.append({
            "requirement_id": requirement_id,
            "title": requirement.get("title", ""),
            "requirement_type": requirement.get("requirement_type"),
            "reason": reason,
        })

    report = {
        "model": chosen_model,
        "generated_categories": [
            {"artefact_type": category, "schema_path": _read_schema(category)[0], "requirements": [item["requirement_id"] for item in items]}
            for category, items in grouped.items()
        ],
        "artefact_count": len(generated),
        "validated_count": sum(1 for item in generated if item["validation_passed"]),
        "validation_failed_count": sum(1 for item in generated if not item["validation_passed"]),
        "unproduced_requirements": unproduced,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    return generated, report