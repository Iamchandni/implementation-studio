from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.entities import Requirement, Artifact, ValidationRun, Project
from app.schemas.contracts import GenerateRequest, ChangeRequestIn, ClarificationIn
from app.modules.artifact_service import generate_artifacts, validate_project_artifacts
from app.modules.testing_service import generate_test_cases, execute_tests
from app.modules.change_service import create_change, impact_report
from app.core.audit import write_event, verify_chain

router = APIRouter(prefix="/projects/{project_id}", tags=["implementation"])

def ensure_project(db, project_id):
    project = db.query(Project).filter_by(id=project_id).first()
    if not project: raise HTTPException(404,"Project not found")
    return project

@router.get("/requirements")
def list_requirements(project_id: str, db: Session = Depends(get_db)):
    ensure_project(db,project_id)
    rows = db.query(Requirement).filter_by(project_id=project_id).order_by(Requirement.created_at.asc()).all()
    return [{"id":r.id,"code":r.code,"title":r.title,"description":r.description,"category":r.category,
             "field":r.field,"operator":r.operator,"value":r.value,"status":r.status,"confidence":r.confidence,
             "source_excerpt":r.source_excerpt,"clarification_question":r.clarification_question,"version":r.version} for r in rows]

@router.post("/requirements/{requirement_id}/clarification")
def clarify(project_id: str, requirement_id: str, body: ClarificationIn, db: Session = Depends(get_db)):
    req = db.query(Requirement).filter_by(id=requirement_id,project_id=project_id).first()
    if not req: raise HTTPException(404,"Requirement not found")
    req.description += f" Clarification response: {body.answer}"
    if body.resolved_value is not None:
        req.value = body.resolved_value
        req.status = "confirmed"
        req.clarification_question = None
        req.confidence = 1.0
    else:
        req.status = "needs_clarification"
    write_event(db,project_id,"REQUIREMENT_CLARIFICATION_RECORDED","requirement",req.id,
                {"answer":body.answer,"resolved_value":body.resolved_value,"status":req.status})
    db.commit()
    return {"id":req.id,"status":req.status,"resolved":req.status == "confirmed",
            "message":"Requirement resolved." if req.status == "confirmed" else "Provide a structured resolved_value before this requirement can be approved."}

@router.post("/generate")
async def generate(project_id: str, body: GenerateRequest = GenerateRequest(), db: Session = Depends(get_db)):
    ensure_project(db,project_id)
    try:
        rows = await generate_artifacts(db,project_id,body.include_mappings,body.include_api_contract)
    except ValueError as exc: raise HTTPException(400,str(exc))
    return {"count":len(rows),"artifacts":[{"id":r.id,"type":r.artifact_type,"name":r.name,"version":r.version,"payload":r.payload} for r in rows]}

@router.get("/artifacts")
def list_artifacts(project_id: str, db: Session = Depends(get_db)):
    ensure_project(db,project_id)
    rows = db.query(Artifact).filter_by(project_id=project_id).order_by(Artifact.created_at.desc()).all()
    return [{"id":r.id,"type":r.artifact_type,"name":r.name,"version":r.version,"status":r.status,
             "payload":r.payload,"requirement_ids":r.requirement_ids} for r in rows]

@router.post("/validate")
def validate(project_id: str, db: Session = Depends(get_db)):
    ensure_project(db,project_id)
    reports = validate_project_artifacts(db,project_id)
    issues = [issue for report in reports for issue in report["issues"]]
    if not reports:
        issues.append({"severity":"error","code":"NO_ARTIFACTS","message":"Generate implementation artefacts before validation"})
    run = ValidationRun(project_id=project_id,status="passed" if not issues else "failed",
                        issues=issues,summary={"artifacts":len(reports),"issues":len(issues)})
    db.add(run); db.commit()
    return {"status":run.status,"summary":run.summary,"reports":reports}

@router.post("/tests/generate")
def tests_generate(project_id: str, db: Session = Depends(get_db)):
    ensure_project(db,project_id)
    rows = generate_test_cases(db,project_id)
    return {"count":len(rows),"tests":[{"id":r.id,"code":r.code,"title":r.title,"category":r.category,
             "input":r.input_data,"expected":r.expected,"status":r.status} for r in rows]}

@router.post("/tests/run")
def tests_run(project_id: str, db: Session = Depends(get_db)):
    ensure_project(db,project_id)
    try: run = execute_tests(db,project_id)
    except ValueError as exc: raise HTTPException(400,str(exc))
    return {"id":run.id,"total":run.total,"passed":run.passed,"failed":run.failed,"results":run.results}

@router.get("/tests")
def list_tests(project_id: str, db: Session = Depends(get_db)):
    ensure_project(db,project_id)
    from app.models.entities import TestCase
    rows = db.query(TestCase).filter_by(project_id=project_id).all()
    return [{"id":r.id,"code":r.code,"title":r.title,"category":r.category,"status":r.status,
             "input":r.input_data,"expected":r.expected,"actual":r.actual} for r in rows]

@router.post("/changes")
def change(project_id: str, body: ChangeRequestIn, db: Session = Depends(get_db)):
    ensure_project(db,project_id)
    try: row = create_change(db,project_id,body.requirement_id,body.new_value,body.description)
    except ValueError as exc: raise HTTPException(404,str(exc))
    return {"id":row.id,"status":row.status,"old_value":row.old_value,"new_value":row.new_value,
            "impacted_artifacts":row.impacted_artifacts}

@router.get("/requirements/{requirement_id}/impact")
def impact(project_id: str, requirement_id: str, db: Session = Depends(get_db)):
    ensure_project(db,project_id)
    try: return impact_report(db,project_id,requirement_id)
    except ValueError as exc: raise HTTPException(404,str(exc))

@router.get("/audit/verify")
def audit_verify(project_id: str, db: Session = Depends(get_db)):
    ensure_project(db,project_id)
    return verify_chain(db,project_id)

@router.post("/publish")
def publish(project_id: str, db: Session = Depends(get_db)):
    ensure_project(db,project_id)
    artifacts = db.query(Artifact).filter_by(project_id=project_id).all()
    latest_by_type = {}
    for artifact in artifacts:
        current = latest_by_type.get(artifact.artifact_type)
        if current is None or artifact.version > current.version:
            latest_by_type[artifact.artifact_type] = artifact
    blockers = [a.name for a in latest_by_type.values() if a.status not in {"valid", "approved"}]
    unresolved = db.query(Requirement).filter(Requirement.project_id==project_id,Requirement.status!="confirmed").count()
    from app.models.entities import TestRun
    latest_test_run = db.query(TestRun).filter_by(project_id=project_id).order_by(TestRun.created_at.desc()).first()
    test_blocker = latest_test_run is None or latest_test_run.failed > 0
    if blockers or unresolved or test_blocker:
        raise HTTPException(409,{"message":"Implementation package has unresolved blockers","artifacts":blockers,
                              "unresolved_requirements":unresolved,"tests_blocked":test_blocker})
    for artifact in latest_by_type.values():
        artifact.status = "approved"
    project = db.query(Project).filter_by(id=project_id).first()
    project.status = "published"
    write_event(db,project_id,"IMPLEMENTATION_PUBLISHED","project",project_id,{"artifact_count":len(artifacts)})
    db.commit()
    return {"status":"published","artifact_count":len(latest_by_type),"message":"Synthetic implementation package approved for export."}


@router.get("/export")
def export_package(project_id: str, db: Session = Depends(get_db)):
    ensure_project(db,project_id)
    import json
    from fastapi.responses import Response
    project = db.query(Project).filter_by(id=project_id).first()
    if project.status != "published":
        raise HTTPException(409,"Publish the implementation package before exporting")
    requirements = db.query(Requirement).filter_by(project_id=project_id).all()
    artifacts = db.query(Artifact).filter_by(project_id=project_id).all()
    from app.models.entities import TestCase, AuditEvent
    tests = db.query(TestCase).filter_by(project_id=project_id).all()
    events = db.query(AuditEvent).filter_by(project_id=project_id).order_by(AuditEvent.created_at.asc()).all()
    package = {
        "manifest":{"project_id":project.id,"project_name":project.name,"domain":project.domain,
                    "status":project.status,"format_version":"1.0"},
        "requirements":[{"id":r.id,"code":r.code,"title":r.title,"description":r.description,
                         "field":r.field,"operator":r.operator,"value":r.value,"status":r.status,
                         "version":r.version,"source_excerpt":r.source_excerpt} for r in requirements],
        "artifacts":[{"id":a.id,"type":a.artifact_type,"name":a.name,"version":a.version,
                      "status":a.status,"payload":a.payload,"requirement_ids":a.requirement_ids}
                     for a in artifacts if a.status != "superseded"],
        "tests":[{"code":t.code,"title":t.title,"input":t.input_data,"expected":t.expected,
                  "actual":t.actual,"status":t.status} for t in tests],
        "audit":[{"event_type":e.event_type,"entity_type":e.entity_type,"entity_id":e.entity_id,
                  "payload":e.payload,"previous_hash":e.previous_hash,"event_hash":e.event_hash}
                 for e in events]
    }
    body = json.dumps(package,indent=2,default=str)
    return Response(content=body,media_type="application/json",
                     headers={"Content-Disposition":f'attachment; filename="implementation-{project_id}.json"'})


@router.get("/audit")
def audit_events(project_id: str, db: Session = Depends(get_db)):
    ensure_project(db,project_id)
    from app.models.entities import AuditEvent
    rows = db.query(AuditEvent).filter_by(project_id=project_id).order_by(AuditEvent.created_at.asc()).all()
    return [{"id":e.id,"event_type":e.event_type,"entity_type":e.entity_type,
             "entity_id":e.entity_id,"payload":e.payload,"previous_hash":e.previous_hash,
             "event_hash":e.event_hash,"created_at":e.created_at} for e in rows]
