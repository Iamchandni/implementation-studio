from pathlib import Path
from typing import Literal

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.document_store import (
    SUPPORTED_EXTENSIONS,
    create_document,
    approve_requirement,
    get_document,
    list_documents,
    save_artefacts,
    save_requirements,
)
from app.core.artefact_generation import ArtefactProviderError, generate_artefacts
from app.core.requirement_extraction import extract_requirements


router = APIRouter(prefix="/documents", tags=["documents"])
MAX_UPLOAD_BYTES = 25 * 1024 * 1024


class ExtractionRequest(BaseModel):
    mode: Literal["demo", "openai_compatible"] = "demo"
    endpoint: str | None = Field(default=None, max_length=500)
    model: str | None = Field(default=None, max_length=200)
    api_key: str | None = Field(default=None, max_length=1000)


class GenerationRequest(BaseModel):
    endpoint: str | None = Field(default=None, max_length=500)
    model: str | None = Field(default=None, max_length=200)
    api_key: str | None = Field(default=None, max_length=1000)


@router.get("/config")
def extraction_config():
    return {
        "default_mode": "demo",
        "endpoint": settings.llm_endpoint,
        "model": settings.llm_model,
        "api_key_configured": bool(settings.llm_api_key),
    }


@router.get("")
def documents():
    return {"documents": list_documents()}


@router.post("")
async def upload_document(file: UploadFile = File(...)):
    filename = Path(file.filename or "").name
    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Supported formats: PDF, DOCX, XLSX, JSON, TXT, and Markdown.")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Upload exceeds the 25 MB limit.")
    try:
        return create_document(filename, content)
    except Exception as error:
        raise HTTPException(status_code=422, detail=f"Document could not be stored: {error}") from error


@router.get("/{document_id}")
def document(document_id: str):
    record = get_document(document_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return record


@router.post("/{document_id}/requirements/{requirement_id}/approve")
def approve_document_requirement(document_id: str, requirement_id: str):
    record = get_document(document_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    requirement = next((item for item in record.get("requirements", []) if item["requirement_id"] == requirement_id), None)
    if requirement is None:
        raise HTTPException(status_code=404, detail="Requirement not found.")
    if requirement.get("requirement_type") == "OPEN_QUESTION" or requirement.get("open_questions"):
        raise HTTPException(status_code=409, detail="Resolve open questions before approving this requirement.")
    saved = approve_requirement(document_id, requirement_id)
    return next(item for item in saved["requirements"] if item["requirement_id"] == requirement_id)


@router.post("/{document_id}/extract")
async def extract_document_requirements(document_id: str, request: ExtractionRequest):
    record = get_document(document_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    if not record["segments"]:
        raise HTTPException(status_code=422, detail="This document has no readable text to extract.")
    try:
        requirements = await extract_requirements(record, request.mode, request.endpoint, request.model, request.api_key)
        saved = save_requirements(document_id, requirements, request.mode)
        return {"document_id": document_id, "mode": request.mode, "count": len(requirements), "requirements": saved["requirements"]}
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"Extraction provider failed: {error}") from error


@router.post("/{document_id}/generate")
async def generate_document_artefacts(document_id: str, request: GenerationRequest):
    record = get_document(document_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    try:
        artefacts, report = await generate_artefacts(record, request.endpoint, request.model, request.api_key)
        saved = save_artefacts(document_id, artefacts, report)
        return {"document_id": document_id, "artefacts": saved["artefacts"], "report": saved["generation_report"]}
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except ArtefactProviderError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error