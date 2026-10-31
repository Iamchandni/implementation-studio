from sqlalchemy.orm import Session
from app.models.entities import Requirement, Artifact, ArtifactDependency
from app.core.audit import write_event
from app.engines.validation import validate_artifact

def _mock_artifacts(requirements: list[Requirement], include_mappings=True, include_api=True):
    confirmed = [r for r in requirements if r.status == "confirmed"]
    unresolved = [r for r in requirements if r.status != "confirmed"]
    rules = []
    for r in confirmed:
        if r.field and r.operator and r.value is not None:
            rules.append({"id": r.code, "title": r.title, "field": r.field,
                          "operator": r.operator, "value": r.value,
                          "source_requirement": r.code})
    nodes = [
        {"id": "intake", "type": "trigger", "label": "Receive application", "config": {"source": "web_or_mobile"}},
        {"id": "validate", "type": "validation", "label": "Validate required data", "requirement_refs": [r.code for r in confirmed if r.category == "data_requirement"]},
        {"id": "business-rules", "type": "rules", "label": "Evaluate business rules", "requirement_refs": [r.code for r in confirmed if r.category == "business_rule"]},
        {"id": "verification", "type": "verification", "label": "Verify identity and documents", "requirement_refs": [r.code for r in confirmed if "verify" in r.title.lower() or "document" in r.title.lower()]},
        {"id": "risk-route", "type": "decision", "label": "Risk decision", "branches": ["standard_processing", "manual_review"]},
        {"id": "complete", "type": "terminal", "label": "Complete or refer", "config": {"human_review": True}}
    ]
    edges = [{"source":"intake","target":"validate"},{"source":"validate","target":"business-rules"},
             {"source":"business-rules","target":"verification"},{"source":"verification","target":"risk-route"},
             {"source":"risk-route","target":"complete","condition":"decision"}]
    mapping = {"mappings": [
        {"source":"customer_profile.full_name","target":"applicant.full_name","transform":"identity","type":"string","status":"proposed"},
        {"source":"customer_profile.date_of_birth","target":"applicant.date_of_birth","transform":"date_normalize","type":"date","status":"proposed"},
        {"source":"customer_profile.mobile","target":"applicant.mobile_number","transform":"normalize_phone","type":"string","status":"proposed"},
        {"source":"document_store.address_proof","target":"documents.address_proof","transform":"document_reference","type":"file_reference","status":"proposed"}
    ], "unresolved": [r.code for r in unresolved], "note":"Mappings are synthetic proposals and require source-system confirmation."}
    api = {"openapi":"3.1.0","info":{"title":"Account Opening Implementation API","version":"0.1.0"},
           "paths":{"/applications":{"post":{"summary":"Submit an account opening application",
           "requestBody":{"required":True,"content":{"application/json":{"schema":{"type":"object","required":["full_name","date_of_birth","mobile_number"]}}}},
           "responses":{"202":{"description":"Application accepted for processing"},"400":{"description":"Invalid input"},"422":{"description":"Business validation failed"}}}}}}
    ids = [r.id for r in requirements]
    out = [("business_rules","Business rules",{"rules":rules,"unresolved_requirements":[r.code for r in unresolved]},ids),
           ("workflow","Implementation workflow",{"nodes":nodes,"edges":edges},ids)]
    if include_mappings: out.append(("data_mapping","Data mappings",mapping,ids))
    if include_api: out.append(("api_contract","API contract",api,ids))
    return out

async def generate_artifacts(db: Session, project_id: str, include_mappings=True, include_api=True):
    requirements = db.query(Requirement).filter_by(project_id=project_id).all()
    if not requirements:
        raise ValueError("Add or extract requirements before generating artefacts")
    generated = _mock_artifacts(requirements, include_mappings, include_api)
    rows = []
    for artifact_type, name, payload, req_ids in generated:
        previous = db.query(Artifact).filter_by(project_id=project_id, artifact_type=artifact_type).order_by(Artifact.version.desc()).first()
        version = (previous.version + 1) if previous else 1
        if previous:
            previous.status = "superseded"
        row = Artifact(project_id=project_id, artifact_type=artifact_type, name=name,
                      version=version, status="draft", payload=payload, requirement_ids=req_ids)
        db.add(row)
        rows.append(row)
    db.flush()
    for row in rows:
        issues = validate_artifact(row.artifact_type, row.payload)
        row.status = "valid" if not issues else "invalid"
        for requirement_id in row.requirement_ids or []:
            if not db.query(ArtifactDependency).filter_by(project_id=project_id, source_type="requirement",
                    source_id=requirement_id, target_type="artifact", target_id=row.id).first():
                db.add(ArtifactDependency(project_id=project_id, source_type="requirement", source_id=requirement_id,
                                          target_type="artifact", target_id=row.id))
    write_event(db, project_id, "IMPLEMENTATION_ARTIFACTS_GENERATED", "project", project_id,
                {"types":[r.artifact_type for r in rows], "count":len(rows)})
    db.commit()
    return rows

def validate_project_artifacts(db: Session, project_id: str):
    artifacts = db.query(Artifact).filter_by(project_id=project_id).all()
    return [{"artifact_id":a.id,"type":a.artifact_type,"name":a.name,
             "issues":validate_artifact(a.artifact_type,a.payload)} for a in artifacts if a.status != "superseded"]
