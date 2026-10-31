import json
import re
import uuid
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any

from app.core.config import settings


SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".xlsx", ".json", ".txt", ".md", ".markdown"}


def storage_root() -> Path:
    configured = Path(settings.document_storage_dir)
    if not configured.is_absolute():
        configured = Path(__file__).resolve().parents[2] / configured
    configured.mkdir(parents=True, exist_ok=True)
    return configured


def _warning(code: str, message: str, **location: Any) -> dict[str, Any]:
    return {"code": code, "message": message, **location}


def _segments_from_text(text: str, extension: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    segments: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    section = "Document"
    paragraph_number = 0
    section_has_content = False
    for line in text.splitlines():
        stripped = line.strip()
        if extension in {".md", ".markdown"} and stripped.startswith("#"):
            if section != "Document" and not section_has_content:
                warnings.append(_warning("empty_section", f"Section '{section}' contains no readable text.", section=section))
            section = re.sub(r"^#+\s*", "", stripped) or "Untitled section"
            section_has_content = False
            continue
        if not stripped:
            continue
        paragraph_number += 1
        segments.append({"text": stripped, "page": None, "section": section, "paragraph": paragraph_number, "sheet": None})
        section_has_content = True
    if section != "Document" and not section_has_content:
        warnings.append(_warning("empty_section", f"Section '{section}' contains no readable text.", section=section))
    if not segments:
        warnings.append(_warning("empty_document", "No readable text was found in the document."))
    return segments, warnings


def _read_pdf(content: bytes) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    from pypdf import PdfReader

    segments = []
    warnings = []
    try:
        reader = PdfReader(BytesIO(content))
        for page_number, page in enumerate(reader.pages, start=1):
            try:
                text = (page.extract_text() or "").strip()
            except Exception as error:
                warnings.append(_warning("unreadable_page", f"Page text could not be extracted: {error}", page=page_number))
                continue
            if not text:
                warnings.append(_warning("empty_page", "No readable text was found on this page.", page=page_number))
                continue
            for paragraph_number, paragraph in enumerate((part.strip() for part in re.split(r"\n\s*\n", text)), start=1):
                if paragraph:
                    segments.append({"text": paragraph, "page": page_number, "section": None, "paragraph": paragraph_number, "sheet": None})
    except Exception as error:
        warnings.append(_warning("unreadable_document", f"PDF could not be read: {error}"))
    return segments, warnings


def _read_docx(content: bytes) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    from docx import Document

    segments = []
    warnings = []
    try:
        document = Document(BytesIO(content))
        section = "Document"
        section_has_content = False
        paragraph_number = 0
        for paragraph in document.paragraphs:
            text = paragraph.text.strip()
            if paragraph.style and paragraph.style.name.startswith("Heading"):
                if section != "Document" and not section_has_content:
                    warnings.append(_warning("empty_section", f"Section '{section}' contains no readable text.", section=section))
                section = text or "Untitled section"
                section_has_content = False
            elif text:
                paragraph_number += 1
                segments.append({"text": text, "page": None, "section": section, "paragraph": paragraph_number, "sheet": None})
                section_has_content = True
        for table_index, table in enumerate(document.tables, start=1):
            for row_index, row in enumerate(table.rows, start=1):
                text = " | ".join(cell.text.strip() for cell in row.cells)
                if text.strip(" |"):
                    paragraph_number += 1
                    segments.append({"text": text, "page": None, "section": f"{section} / Table {table_index}", "paragraph": paragraph_number, "sheet": None})
                    section_has_content = True
        if section != "Document" and not section_has_content:
            warnings.append(_warning("empty_section", f"Section '{section}' contains no readable text.", section=section))
        if not segments:
            warnings.append(_warning("empty_document", "No readable text was found in the document."))
    except Exception as error:
        warnings.append(_warning("unreadable_document", f"DOCX could not be read: {error}"))
    return segments, warnings


def _read_xlsx(content: bytes) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    from openpyxl import load_workbook

    segments = []
    warnings = []
    try:
        workbook = load_workbook(BytesIO(content), read_only=True, data_only=False)
        for worksheet in workbook.worksheets:
            sheet_has_content = False
            for row_number, row in enumerate(worksheet.iter_rows(), start=1):
                values = [(cell.coordinate, str(cell.value)) for cell in row if cell.value is not None]
                if not values:
                    continue
                sheet_has_content = True
                text = " | ".join(f"{coordinate}: {value}" for coordinate, value in values)
                segments.append({"text": text, "page": None, "section": f"{worksheet.title}!{values[0][0]}:{values[-1][0]}", "paragraph": row_number, "sheet": worksheet.title})
            if not sheet_has_content:
                warnings.append(_warning("empty_sheet", f"Worksheet '{worksheet.title}' contains no readable cells.", sheet=worksheet.title))
        workbook.close()
        if not segments:
            warnings.append(_warning("empty_document", "No readable cells were found in the workbook."))
    except Exception as error:
        warnings.append(_warning("unreadable_document", f"XLSX could not be read: {error}"))
    return segments, warnings


def parse_document(filename: str, content: bytes) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    extension = Path(filename).suffix.lower()
    if extension == ".pdf":
        segments, warnings = _read_pdf(content)
    elif extension == ".docx":
        segments, warnings = _read_docx(content)
    elif extension == ".xlsx":
        segments, warnings = _read_xlsx(content)
    else:
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = content.decode("utf-8", errors="replace")
            warnings = [_warning("encoding_replaced", "Some characters could not be decoded as UTF-8 and were replaced.")]
        else:
            warnings = []
        if extension == ".json":
            try:
                json.loads(text)
                segments = [{"text": text, "page": None, "section": "JSON document", "paragraph": 1, "sheet": None}] if text.strip() else []
                if not segments:
                    warnings.append(_warning("empty_document", "No readable text was found in the document."))
            except json.JSONDecodeError as error:
                segments = []
                warnings.append(_warning("unreadable_document", f"JSON could not be parsed: {error.msg} (line {error.lineno})."))
        else:
            segments, text_warnings = _segments_from_text(text, extension)
            warnings.extend(text_warnings)

    extracted_text = "\n".join(segment["text"] for segment in segments)
    offset = 0
    for index, segment in enumerate(segments, start=1):
        segment["segment_id"] = f"S{index:04d}"
        segment["char_start"] = offset
        segment["char_end"] = offset + len(segment["text"])
        offset = segment["char_end"] + 1
    return segments, warnings


def create_document(filename: str, content: bytes) -> dict[str, Any]:
    document_id = f"DOC-{uuid.uuid4().hex[:12].upper()}"
    directory = storage_root() / document_id
    directory.mkdir(parents=True, exist_ok=False)
    extension = Path(filename).suffix.lower()
    original_path = directory / f"original{extension}"
    original_path.write_bytes(content)
    segments, warnings = parse_document(filename, content)
    extracted_text = "\n".join(segment["text"] for segment in segments)
    record = {
        "document_id": document_id,
        "document_name": Path(filename).name,
        "file_type": extension.lstrip("."),
        "size_bytes": len(content),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "segments": segments,
        "extracted_text": extracted_text,
        "warnings": warnings,
        "requirements": [],
    }
    (directory / "extracted.txt").write_text(extracted_text, encoding="utf-8")
    _write_json(directory / "document.json", record)
    return record


def _write_json(path: Path, value: Any) -> None:
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    temporary_path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary_path.replace(path)


def get_document(document_id: str) -> dict[str, Any] | None:
    if not re.fullmatch(r"DOC-[A-F0-9]{12}", document_id):
        return None
    path = storage_root() / document_id / "document.json"
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def list_documents() -> list[dict[str, Any]]:
    documents = []
    for path in storage_root().glob("DOC-*/document.json"):
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
            documents.append({key: record[key] for key in ("document_id", "document_name", "file_type", "size_bytes", "created_at", "warnings")})
            documents[-1]["requirement_count"] = len(record.get("requirements", []))
        except (OSError, json.JSONDecodeError, KeyError):
            continue
    return sorted(documents, key=lambda item: item["created_at"], reverse=True)


def save_requirements(document_id: str, requirements: list[dict[str, Any]], mode: str) -> dict[str, Any]:
    record = get_document(document_id)
    if record is None:
        raise FileNotFoundError(document_id)
    record["requirements"] = requirements
    record["extraction_mode"] = mode
    _write_json(storage_root() / document_id / "document.json", record)
    _write_json(storage_root() / document_id / "requirements.json", requirements)
    return record