import json
import re
from pathlib import Path
from typing import Any

import httpx
from jsonschema import Draft202012Validator

from app.core.config import settings


SCHEMA_PATH = Path(__file__).resolve().parents[2] / "schemas" / "requirements" / "requirement.schema.json"
REQUIREMENT_SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
REQUIREMENT_VALIDATOR = Draft202012Validator(REQUIREMENT_SCHEMA)


def _guess_type(text: str) -> str:
    lower = text.lower()
    if "?" in text or any(phrase in lower for phrase in ("clarification required", "must be clarified", "does not define", "not specified")):
        return "OPEN_QUESTION"
    if any(word in lower for word in ("approval", "approve", "review", "route", "escalat", "submit", "workflow")):
        return "WORKFLOW"
    if any(word in lower for word in ("depend on", "depends on", "after ", "before ", "once ", "prerequisite")):
        return "DEPENDENCY"
    if any(word in lower for word in ("field", "attribute", "data type", "capture", "record the", "store the")):
        return "FIELD"
    if any(word in lower for word in ("minimum", "maximum", "threshold", "rate", "fee", "duration", "amount range")):
        return "PARAMETER"
    if any(word in lower for word in ("must", "shall", "required", "cannot", "should not", "valid", "at least", "no more than", "between")):
        return "VALIDATION"
    return "BUSINESS_RULE"


def demo_extract(document: dict[str, Any]) -> list[dict[str, Any]]:
    requirements = []
    for segment in document["segments"]:
        for match in re.finditer(r"[^.!?]+(?:[.!?]+|$)", segment["text"]):
            evidence = match.group().strip()
            if len(evidence) < 20 or evidence.startswith("#"):
                continue
            relative_start = segment["text"].find(evidence)
            start = segment["char_start"] + relative_start
            requirement_id = f"REQ-{len(requirements) + 1:04d}"
            title = evidence.rstrip(".!? ").splitlines()[0][:96]
            requirement_type = _guess_type(evidence)
            requirements.append({
                "evidence_segment_id": segment["segment_id"],
                "source_text": evidence,
                "requirement_id": requirement_id,
                "requirement_type": requirement_type,
                "title": title,
                "statement": evidence,
                "normalized_intent": evidence,
                "subject": "UNSPECIFIED",
                "attributes": {},
                "conditions": [],
                "outcomes": [],
                "dependencies": [],
                "source": {
                    "document_id": document["document_id"],
                    "document_name": document["document_name"],
                    "page": segment["page"],
                    "section": segment["section"],
                    "paragraph": segment["paragraph"],
                    "sheet": segment["sheet"],
                    "source_text": evidence,
                    "char_start": start,
                    "char_end": start + len(evidence),
                },
                "confidence": 0.25,
                "status": "NEEDS_REVIEW",
                "open_questions": [],
            })
    return requirements


def _chat_completions_url(endpoint: str) -> str:
    base = endpoint.strip().rstrip("/")
    if base.endswith("/chat/completions"):
        return base
    if base.endswith("/v1"):
        return f"{base}/chat/completions"
    return f"{base}/v1/chat/completions"


async def _openai_compatible_extract(document: dict[str, Any], endpoint: str, model: str, api_key: str) -> list[dict[str, Any]]:
    prompt = {
        "task": "Extract candidate business requirements from source segments.",
        "rules": [
            "Return JSON only, shaped as {requirements: [...]}.",
            "Use requirement_type BUSINESS_RULE, WORKFLOW, FIELD, VALIDATION, DEPENDENCY, PARAMETER, or OPEN_QUESTION.",
            "Each item must include title, statement, normalized_intent, subject, attributes, conditions, outcomes, dependencies, evidence_segment_id, and source_text.",
            "source_text must be a verbatim contiguous quote from the identified segment, with no edits or ellipses.",
            "Do not infer missing facts. Put unresolved information in open_questions and use NEEDS_REVIEW when appropriate.",
        ],
        "segments": [{
            "segment_id": segment["segment_id"], "page": segment["page"], "section": segment["section"],
            "paragraph": segment["paragraph"], "sheet": segment["sheet"], "text": segment["text"],
        } for segment in document["segments"]],
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    body = {
        "model": model,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "You extract source-grounded business requirements. Never invent or paraphrase source evidence."},
            {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
        ],
    }
    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(_chat_completions_url(endpoint), headers=headers, json=body)
        response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    if not isinstance(parsed, dict) or not isinstance(parsed.get("requirements"), list):
        raise ValueError("The provider response must contain a requirements array.")
    return parsed["requirements"]


def _canonicalize(raw_items: list[dict[str, Any]], document: dict[str, Any]) -> list[dict[str, Any]]:
    segments_by_id = {segment["segment_id"]: segment for segment in document["segments"]}
    canonical = []
    for index, raw in enumerate(raw_items, start=1):
        if not isinstance(raw, dict):
            raise ValueError(f"Requirement {index} is not a JSON object.")
        evidence = raw.get("source_text")
        segment = segments_by_id.get(raw.get("evidence_segment_id"))
        if not isinstance(evidence, str) or not evidence:
            raise ValueError(f"Requirement {index} is missing exact source_text evidence.")
        if segment is None:
            segment = next((candidate for candidate in document["segments"] if evidence in candidate["text"]), None)
        if segment is None or evidence not in segment["text"]:
            raise ValueError(f"Requirement {index} cites text that is not present verbatim in a source segment.")
        relative_start = segment["text"].find(evidence)
        start = segment["char_start"] + relative_start
        item = {
            "requirement_id": f"REQ-{index:04d}",
            "requirement_type": raw.get("requirement_type"),
            "title": raw.get("title"),
            "statement": raw.get("statement"),
            "normalized_intent": raw.get("normalized_intent", raw.get("statement")),
            "subject": raw.get("subject", "UNSPECIFIED"),
            "attributes": raw.get("attributes", {}),
            "conditions": raw.get("conditions", []),
            "outcomes": raw.get("outcomes", []),
            "dependencies": raw.get("dependencies", []),
            "source": {
                "document_id": document["document_id"],
                "document_name": document["document_name"],
                "page": segment["page"],
                "section": segment["section"],
                "paragraph": segment["paragraph"],
                "sheet": segment["sheet"],
                "source_text": evidence,
                "char_start": start,
                "char_end": start + len(evidence),
            },
            "confidence": raw.get("confidence", 0.5),
            "status": raw.get("status", "NEEDS_REVIEW"),
            "open_questions": raw.get("open_questions", []),
        }
        errors = sorted(REQUIREMENT_VALIDATOR.iter_errors(item), key=lambda error: list(error.absolute_path))
        if errors:
            location = ".".join(str(part) for part in errors[0].absolute_path) or "<root>"
            raise ValueError(f"Requirement {index} is invalid at {location}: {errors[0].message}")
        canonical.append(item)
    return canonical


async def extract_requirements(document: dict[str, Any], mode: str, endpoint: str | None, model: str | None, api_key: str | None) -> list[dict[str, Any]]:
    if mode == "demo":
        return _canonicalize(demo_extract(document), document)
    if mode != "openai_compatible":
        raise ValueError("Mode must be 'demo' or 'openai_compatible'.")
    effective_key = api_key or settings.llm_api_key
    if not effective_key:
        raise ValueError("An API key is required for OpenAI-compatible extraction.")
    raw_items = await _openai_compatible_extract(
        document,
        endpoint or settings.llm_endpoint,
        model or settings.llm_model,
        effective_key,
    )
    return _canonicalize(raw_items, document)