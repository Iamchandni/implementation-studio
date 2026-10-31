from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.entities import Project, Requirement
from app.core.audit import write_event

router = APIRouter(prefix="/demo", tags=["demo"])

@router.post("/seed")
def seed_demo(db: Session = Depends(get_db)):
    project = Project(
        name="Retail Account Opening Implementation",
        domain="retail_banking",
        description="Synthetic business requirements for an AI-assisted implementation workflow."
    )
    db.add(project)
    db.flush()

    samples = [
        ("BR-001", "Capture applicant identity", "The application must capture full name, date of birth, mobile number and email address.", "data_requirement", "applicant.full_name", "required", True, "Applicant details section must collect identity fields.", 0.98),
        ("BR-002", "Validate applicant age", "Applicants must be at least 18 years old.", "business_rule", "applicant.age", "gte", 18, "Applicants must be at least 18 years old.", 0.99),
        ("BR-003", "Verify mobile number", "The system must verify the applicant mobile number using a one-time password.", "workflow_requirement", "applicant.mobile_verified", "eq", True, "Verify the applicant mobile number using OTP.", 0.96),
        ("BR-004", "Collect address proof", "The applicant must upload one accepted address proof document.", "data_requirement", "documents.address_proof", "required", True, "Upload one accepted address proof document.", 0.95),
        ("BR-005", "Manual review threshold", "Applications flagged by the risk engine must be routed to manual review.", "workflow_requirement", "risk.flagged", "eq", True, "Applications flagged by the risk engine must be routed to manual review.", 0.93),
        ("BR-006", "Retention period", "Application records must be retained for the legally approved retention period.", "non_functional", "records.retention_days", None, None, "retained for the legally approved retention period.", 0.58),
    ]
    for code, title, desc, category, field, operator, value, excerpt, confidence in samples:
        status = "needs_clarification" if code == "BR-006" else "confirmed"
        db.add(Requirement(
            project_id=project.id, code=code, title=title, description=desc,
            category=category, field=field, operator=operator, value=value,
            status=status, confidence=confidence, source_excerpt=excerpt,
            clarification_question=("What is the approved retention period, and which regulation or policy defines it?" if status == "needs_clarification" else None)
        ))
    write_event(db, project.id, "IMPLEMENTATION_DEMO_CREATED", "project", project.id,
                {"requirements": len(samples), "unresolved": 1, "domain": "retail_banking"})
    db.commit()
    return {
        "project_id": project.id,
        "project_name": project.name,
        "requirements_count": len(samples),
        "unresolved_count": 1,
        "next": f"GET /api/v1/projects/{project.id}/requirements"
    }
