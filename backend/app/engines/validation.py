REQUIRED_ARTIFACT_FIELDS = {
    "eligibility_rules": {"rules", "approval"},
    "workflow": {"nodes", "edges"},
    "data_mapping": {"mappings"},
    "api_contract": {"openapi", "info", "paths"},
    "test_plan": {"tests"},
    "business_rules": {"rules", "unresolved_requirements"},
}

def validate_artifact(artifact_type: str, payload: dict) -> list[dict]:
    issues = []
    required = REQUIRED_ARTIFACT_FIELDS.get(artifact_type, set())
    for key in sorted(required - set(payload.keys())):
        issues.append({"severity": "error", "code": "MISSING_FIELD", "message": f"Missing required field: {key}"})
    if artifact_type == "eligibility_rules":
        for rule in payload.get("rules", []):
            if not rule.get("id") or not rule.get("conditions"):
                issues.append({"severity": "error", "code": "INVALID_RULE", "message": "Each rule needs an id and conditions"})
            for condition in rule.get("conditions", []):
                if condition.get("operator") not in {"gte", "lte", "gt", "lt", "eq", "neq", "in", "exists"}:
                    issues.append({"severity": "error", "code": "UNSUPPORTED_OPERATOR", "message": f"Unsupported operator: {condition.get('operator')}"})
    if artifact_type == "workflow":
        node_ids = {n.get("id") for n in payload.get("nodes", [])}
        for edge in payload.get("edges", []):
            if edge.get("source") not in node_ids or edge.get("target") not in node_ids:
                issues.append({"severity": "error", "code": "DANGLING_EDGE", "message": f"Invalid edge: {edge}"})
    return issues
