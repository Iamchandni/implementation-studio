from sqlalchemy.orm import Session
from app.models.entities import Requirement, TestCase, TestRun, ArtifactDependency
from app.core.audit import write_event

def _read_path(data, path):
    value = data
    for part in (path or "").split("."):
        if not isinstance(value, dict) or part not in value:
            return None
        value = value[part]
    return value

def _evaluate(requirement, payload):
    if requirement.category == "data_requirement" and requirement.operator == "required":
        return _read_path(payload, requirement.field) not in (None, "", [])
    actual = _read_path(payload, requirement.field)
    expected = requirement.value
    op = requirement.operator
    if actual is None:
        return False
    try:
        return {"eq": lambda: actual == expected, "neq": lambda: actual != expected,
                "gte": lambda: actual >= expected, "gt": lambda: actual > expected,
                "lte": lambda: actual <= expected, "lt": lambda: actual < expected,
                "in": lambda: actual in expected}.get(op, lambda: True)()
    except (TypeError, ValueError):
        return False

def generate_test_cases(db: Session, project_id: str):
    requirements = db.query(Requirement).filter_by(project_id=project_id).all()
    created = []
    for req in requirements:
        if req.status != "confirmed" or not req.field:
            continue
        value = req.value
        if req.operator == "required":
            valid = {req.field.split(".")[0]: {}}
            cursor = valid
            parts = req.field.split(".")
            for part in parts[:-1]:
                cursor = cursor.setdefault(part, {})
            cursor[parts[-1]] = "sample"
            invalid = {}
        else:
            valid_value = value
            invalid_value = (value - 1 if isinstance(value, (int, float)) and req.operator in {"gte","gt"} else
                            value + 1 if isinstance(value, (int, float)) and req.operator in {"lte","lt"} else
                            (not value if isinstance(value, bool) else "__invalid__"))
            def nested(v):
                obj = {}
                cur = obj
                parts = req.field.split(".")
                for part in parts[:-1]:
                    cur = cur.setdefault(part,{})
                cur[parts[-1]] = v
                return obj
            valid, invalid = nested(valid_value), nested(invalid_value)
        fixtures = [
            (f"{req.code}-POS", f"{req.title} — valid input", "positive", valid, True),
            (f"{req.code}-NEG", f"{req.title} — invalid input", "negative", invalid, False),
            (f"{req.code}-EDGE", f"{req.title} — boundary / missing input", "boundary", {}, False),
        ]
        for code,title,category,input_data,expected in fixtures:
            row = db.query(TestCase).filter_by(project_id=project_id,code=code).first()
            if row is None:
                row = TestCase(project_id=project_id,code=code)
                db.add(row)
            row.requirement_id=req.id
            row.title,row.category=title,category
            row.input_data,row.expected=input_data,{"requirement_satisfied":expected}
            row.status,row.actual="not_run",None
            db.flush()
            if not db.query(ArtifactDependency).filter_by(project_id=project_id,source_type="requirement",
                source_id=req.id,target_type="test_case",target_id=row.id).first():
                db.add(ArtifactDependency(project_id=project_id,source_type="requirement",source_id=req.id,
                    target_type="test_case",target_id=row.id))
            created.append(row)
    write_event(db,project_id,"TEST_CASES_GENERATED","project",project_id,{"count":len(created)})
    db.commit()
    return created

def execute_tests(db: Session, project_id: str):
    cases = db.query(TestCase).filter_by(project_id=project_id).all()
    if not cases:
        raise ValueError("Generate test cases before running tests")
    requirements = {r.id:r for r in db.query(Requirement).filter_by(project_id=project_id).all()}
    results=[]
    for case in cases:
        req=requirements.get(case.requirement_id)
        satisfied=_evaluate(req,case.input_data) if req else False
        expected=case.expected.get("requirement_satisfied",False)
        passed=satisfied==expected
        case.actual={"requirement_satisfied":satisfied}
        case.status="passed" if passed else "failed"
        results.append({"test_case_id":case.id,"code":case.code,"title":case.title,
                        "expected":case.expected,"actual":case.actual,"status":case.status})
    run=TestRun(project_id=project_id,total=len(results),passed=sum(x["status"]=="passed" for x in results),
                failed=sum(x["status"]=="failed" for x in results),results=results)
    db.add(run)
    write_event(db,project_id,"TESTS_EXECUTED","test_run",run.id,
                {"total":run.total,"passed":run.passed,"failed":run.failed})
    db.commit();db.refresh(run)
    return run
