import re
from sqlalchemy.orm import Session
from app.core.llm import llm_client
from app.models.entities import Requirement, SourceDocument
from app.core.audit import write_event
from app.modules.document_parser import extract_text

SYSTEM = '''You are an enterprise implementation analyst. Extract only requirements explicitly supported by the source.
Return JSON: {"requirements":[{"code":"REQ-001","title":"...","description":"...","category":"eligibility|approval|data|integration|process|other","field":"applicant.age","operator":"between","value":{"min":21,"max":60,"inclusive":true},"status":"confirmed|ambiguous|conflicting|blocked","confidence":0.0,"source_excerpt":"exact short excerpt","clarification_question":null}]}
Do not invent missing business decisions. Mark ambiguous or missing details and ask a concise clarification.'''

def _mock_extract(text: str) -> list[dict]:
    found = []
    patterns = [
        (r"between\s+(\d{1,2})\s+and\s+(\d{1,2})\s+years", "applicant.age", "between", "Applicant age"),
        (r"minimum (?:monthly )?salary of\s*(?:(?:INR|Rs\.?|₹)\s*)?([\d,]+)", "applicant.monthly_salary", "gte", "Minimum monthly salary"),
        (r"salary.*?(?:credited|received).*?(?:at least )?(\d+) months", "applicant.salary_credit_months", "gte", "Salary credit history"),
        (r"above\s*(?:(?:INR|Rs\.?|₹)\s*)?([\d,]+).*?(?:two-level|two level)", "loan.amount", "approval_threshold", "Two-level approval threshold"),
    ]
    for idx, (pattern, field, operator, title) in enumerate(patterns, 1):
        match = re.search(pattern, text, re.I | re.S)
        if not match:
            continue
        nums = [int(x.replace(",", "")) for x in match.groups()]
        value = {"min": nums[0], "max": nums[1], "inclusive": True} if operator == "between" else nums[0]
        found.append({"code": f"REQ-{idx:03d}", "title": title, "description": match.group(0),
                      "category": "approval" if operator == "approval_threshold" else "eligibility",
                      "field": field, "operator": operator, "value": value, "status": "confirmed",
                      "confidence": 0.92, "source_excerpt": match.group(0), "clarification_question": None})
    if re.search(r"stable income", text, re.I):
        found.append({"code": f"REQ-{len(found)+1:03d}", "title": "Stable income definition",
                      "description": "Applicant must have stable income.", "category": "eligibility",
                      "field": "applicant.income_stability", "operator": None, "value": None,
                      "status": "ambiguous", "confidence": 0.55, "source_excerpt": "stable income",
                      "clarification_question": "How should stable income be defined and measured?"})
    if re.search(r"below.*threshold|under.*threshold", text, re.I) and re.search(r"approval", text, re.I):
        found.append({"code": f"REQ-{len(found)+1:03d}", "title": "Standard approval path",
                      "description": "Approval process below the specified threshold is not defined.",
                      "category": "approval", "field": "loan.approval_path", "operator": None, "value": None,
                      "status": "ambiguous", "confidence": 0.45, "source_excerpt": "approval threshold",
                      "clarification_question": "What approval path applies to loans at or below the threshold?"})
    return found

async def extract_requirements(db: Session, project_id: str, document: SourceDocument) -> list[Requirement]:
    result = await llm_client.json(SYSTEM, document.extracted_text[:30000])
    items = result.get("requirements", []) if result else _mock_extract(document.extracted_text)
    try:
        _, source_pages = extract_text(document.storage_path)
    except Exception:
        source_pages = [{"page": None, "text": document.extracted_text}]
    created = []
    for idx, item in enumerate(items, 1):
        excerpt = item.get("source_excerpt")
        page_number = item.get("source_page")
        if page_number is None and excerpt:
            page_number = next((p["page"] for p in source_pages if p.get("page") and excerpt.lower() in p["text"].lower()), None)
        row = Requirement(
            project_id=project_id, source_document_id=document.id,
            code=item.get("code") or f"REQ-{idx:03d}", title=item["title"],
            description=item.get("description", ""), category=item.get("category", "other"),
            field=item.get("field"), operator=item.get("operator"), value=item.get("value"),
            status=item.get("status", "confirmed"), confidence=float(item.get("confidence", 0.8)),
            source_excerpt=excerpt, source_page=page_number, clarification_question=item.get("clarification_question")
        )
        db.add(row); created.append(row)
    document.status = "processed"
    write_event(db, project_id, "REQUIREMENTS_EXTRACTED", "source_document", document.id,
                {"count": len(created), "codes": [x.code for x in created]})
    db.commit()
    for row in created: db.refresh(row)
    return created
