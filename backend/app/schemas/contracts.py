from typing import Any, Literal
from pydantic import BaseModel, Field, ConfigDict

class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    domain: str = "general"
    description: str | None = None

class ProjectOut(BaseModel):
    id: str
    name: str
    domain: str
    description: str | None
    status: str
    model_config = ConfigDict(from_attributes=True)

class RequirementOut(BaseModel):
    id: str
    code: str
    title: str
    description: str
    category: str
    field: str | None
    operator: str | None
    value: Any
    status: str
    confidence: float
    source_excerpt: str | None
    clarification_question: str | None
    version: int
    model_config = ConfigDict(from_attributes=True)

class ClarificationIn(BaseModel):
    answer: str = Field(min_length=1)
    resolved_value: Any = None

class ChangeRequestIn(BaseModel):
    requirement_id: str
    new_value: Any
    description: str = Field(min_length=5)

class ArtifactOut(BaseModel):
    id: str
    artifact_type: str
    name: str
    version: int
    status: str
    payload: dict
    requirement_ids: list
    model_config = ConfigDict(from_attributes=True)

class GenerateRequest(BaseModel):
    include_mappings: bool = True
    include_api_contract: bool = True

class TestRunOut(BaseModel):
    id: str
    total: int
    passed: int
    failed: int
    results: list
    model_config = ConfigDict(from_attributes=True)

class ApprovalIn(BaseModel):
    approved: bool
    comment: str | None = None
