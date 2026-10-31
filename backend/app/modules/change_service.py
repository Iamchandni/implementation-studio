from sqlalchemy.orm import Session
from app.models.entities import Requirement, Artifact, ArtifactDependency, ChangeRequest, TestCase
from app.core.audit import write_event
from app.modules.testing_service import generate_test_cases, execute_tests

def create_change(db: Session, project_id: str, requirement_id: str, new_value, description: str):
    req = db.query(Requirement).filter_by(id=requirement_id, project_id=project_id).first()
    if not req: raise ValueError("Requirement not found in this project")
    old_value = req.value
    change = ChangeRequest(project_id=project_id, requirement_id=req.id, old_value=old_value,
                           new_value=new_value, description=description, impacted_artifacts=[])
    db.add(change); db.flush()
    impacted = db.query(ArtifactDependency).filter_by(project_id=project_id,source_type="requirement",source_id=req.id,target_type="artifact").all()
    impacted_ids = list({x.target_id for x in impacted})
    change.impacted_artifacts = impacted_ids
    # Create a new requirement version rather than overwriting history.
    req.value = new_value
    req.version += 1
    for artifact_id in impacted_ids:
        artifact = db.query(Artifact).filter_by(id=artifact_id).first()
        if artifact:
            artifact.status = "stale"
    change.status = "applied"
    write_event(db, project_id, "REQUIREMENT_CHANGED", "requirement", req.id,
                {"change_id":change.id,"old_value":old_value,"new_value":new_value,"impacted_artifacts":impacted_ids})
    db.commit(); db.refresh(change)
    return change

def impact_report(db: Session, project_id: str, requirement_id: str):
    req = db.query(Requirement).filter_by(id=requirement_id, project_id=project_id).first()
    if not req: raise ValueError("Requirement not found")
    dependencies = db.query(ArtifactDependency).filter_by(project_id=project_id,source_type="requirement",source_id=requirement_id).all()
    artifacts = []
    for dep in dependencies:
        item = db.query(Artifact).filter_by(id=dep.target_id).first()
        if item: artifacts.append({"id":item.id,"type":item.artifact_type,"name":item.name,"status":item.status})
    return {"requirement_id":req.id,"requirement_code":req.code,"impacted_artifacts":artifacts,
            "impacted_tests":[{"id":t.id,"code":t.code,"title":t.title} for t in db.query(TestCase).filter_by(project_id=project_id).all()
                              if t.requirement_id == req.id]}
