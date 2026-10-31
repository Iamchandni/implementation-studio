import psycopg
from app.core.config import settings


def check_database_connection() -> bool:
    """Return True when PostgreSQL is reachable; do not create schema/tables here."""
    try:
        with psycopg.connect(settings.database_url, connect_timeout=3) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        return True
    except Exception:
        return False
