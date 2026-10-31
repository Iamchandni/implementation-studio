from fastapi import APIRouter
from app.db.connection import check_database_connection

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    db_ok = check_database_connection()
    return {
        "status": "ok" if db_ok else "degraded",
        "service": "implementation-studio-api",
        "database": "connected" if db_ok else "unavailable",
    }
