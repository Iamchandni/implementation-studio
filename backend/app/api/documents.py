from pathlib import Path
from uuid import uuid4
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.config import settings
from app.models.entities import Project, SourceDocument
from app.modules.document_parser import extract_text, DocumentParseError
from app.modules.requirement_service import extract_requirements
from app.core.audit import write_event

router = APIRouter(prefix="/projects/{project_id}/documents", tags=["documents"])

@router.post("", status_code=201)
async def upload_document(project_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    project = db.query(Project).filter_by(id=project_id).first()
    if not project: raise HTTPException(404,"Project not found")
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".pdf",".docx",".txt",".md"}: raise HTTPException(400,"Supported: PDF, DOCX, TXT, MD")
    content = await file.read()
    if len(content) > settings.max_upload_mb * 1024 * 1024: raise HTTPException(413,"File exceeds upload limit")
    upload_dir = Path(settings.upload_dir) / project_id
    upload_dir.mkdir(parents=True,exist_ok=True)
    path = upload_dir / f"{uuid4()}{suffix}"
    path.write_bytes(content)
    try:
        text, pages = extract_text(str(path),file.content_type)
    except DocumentParseError as exc:
        path.unlink(missing_ok=True); raise HTTPException(400,str(exc))
    row = SourceDocument(project_id=project_id,filename=file.filename or path.name,
                         content_type=file.content_type or "application/octet-stream",
                         storage_path=str(path),extracted_text=text,status="uploaded")
    db.add(row); db.flush()
    write_event(db,project_id,"DOCUMENT_UPLOADED","source_document",row.id,
                {"filename":row.filename,"characters":len(text)})
    db.commit(); db.refresh(row)
    return {"document_id":row.id,"filename":row.filename,"characters_extracted":len(text),
            "pages":len(pages),"preview":text[:1200]}

@router.post("/{document_id}/extract-requirements")
async def extract(project_id: str, document_id: str, db: Session = Depends(get_db)):
    document = db.query(SourceDocument).filter_by(id=document_id,project_id=project_id).first()
    if not document: raise HTTPException(404,"Document not found")
    rows = await extract_requirements(db,project_id,document)
    return {"count":len(rows),"requirements":[{"id":r.id,"code":r.code,"title":r.title,"status":r.status,
            "field":r.field,"operator":r.operator,"value":r.value,
            "clarification_question":r.clarification_question} for r in rows]}
