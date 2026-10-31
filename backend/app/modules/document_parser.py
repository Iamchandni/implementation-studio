from pathlib import Path
import fitz
from docx import Document

class DocumentParseError(ValueError):
    pass

def extract_text(path: str, content_type: str | None = None) -> tuple[str, list[dict]]:
    file_path = Path(path)
    suffix = file_path.suffix.lower()
    if suffix == ".pdf":
        pages = []
        with fitz.open(file_path) as pdf:
            for i, page in enumerate(pdf):
                pages.append({"page": i + 1, "text": page.get_text("text")})
        return "\n\n".join(p["text"] for p in pages), pages
    if suffix == ".docx":
        doc = Document(file_path)
        text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        return text, [{"page": None, "text": text}]
    if suffix in {".txt", ".md"}:
        text = file_path.read_text(encoding="utf-8", errors="replace")
        return text, [{"page": None, "text": text}]
    raise DocumentParseError("Supported formats: PDF, DOCX, TXT, MD")
