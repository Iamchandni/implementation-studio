import json
from pathlib import Path
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/schemas", tags=["schemas"])
SCHEMA_ROOT = Path(__file__).resolve().parents[3] / "schemas"


@router.get("")
def list_schemas():
    items = []
    for path in sorted(SCHEMA_ROOT.rglob("*.schema.json")):
        items.append({
            "name": path.name,
            "path": path.relative_to(SCHEMA_ROOT).as_posix(),
        })
    return {"count": len(items), "schemas": items}


@router.get("/{schema_path:path}")
def get_schema(schema_path: str):
    # Resolve only paths that remain inside the schema directory.
    candidate = (SCHEMA_ROOT / schema_path).resolve()
    if SCHEMA_ROOT.resolve() not in candidate.parents or not candidate.is_file():
        raise HTTPException(status_code=404, detail="Schema not found")
    try:
        return json.loads(candidate.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Schema file contains invalid JSON")
