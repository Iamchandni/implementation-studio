from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.database import init_db
from app.api import projects, demo, documents, implementation

app = FastAPI(
    title="AI Implementation Studio",
    version="0.2.0",
    description="Turn business requirements into traceable implementation artefacts, workflows, mappings and executable tests."
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

@app.get("/health")
def health():
    return {"status": "ok", "service": "AI Implementation Studio"}

app.include_router(projects.router, prefix=settings.api_prefix)
app.include_router(demo.router, prefix=settings.api_prefix)
app.include_router(documents.router, prefix=settings.api_prefix)
app.include_router(implementation.router, prefix=settings.api_prefix)
