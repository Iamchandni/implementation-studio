from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.entities import Project
from app.schemas.contracts import ProjectCreate, ProjectOut
from app.core.audit import write_event

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)):
    row = Project(**body.model_dump())
    db.add(row); db.flush()
    write_event(db,row.id,"PROJECT_CREATED","project",row.id,{"name":row.name,"domain":row.domain})
    db.commit(); db.refresh(row)
    return row

@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.created_at.desc()).all()

@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db)):
    row = db.query(Project).filter_by(id=project_id).first()
    if not row: raise HTTPException(404,"Project not found")
    return row
