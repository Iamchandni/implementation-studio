from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.routes.documents import router as documents_router
from app.api.routes.schemas import router as schemas_router
from app.core.config import settings

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Prototype API for requirements-to-implementation artefacts.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(schemas_router, prefix=settings.api_v1_prefix)
app.include_router(documents_router, prefix=settings.api_v1_prefix)


@app.get("/")
def root():
    return {
        "name": settings.app_name,
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
    }
