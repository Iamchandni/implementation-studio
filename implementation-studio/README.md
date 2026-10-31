# AI Implementation Studio — Milestone 2

A local prototype foundation for converting business requirements into structured, traceable implementation artefacts.

## Stack
- Frontend: React + Vite
- Backend: Python + FastAPI
- Database: PostgreSQL
- Contracts: JSON Schema Draft 2020-12
- LLM: OpenAI-compatible chat-completions API, with heuristic demo mode

## Repository structure

```text
implementation-studio/
├── backend/
│   ├── app/
│   │   ├── api/routes/
│   │   ├── core/
│   │   ├── db/
│   │   └── main.py
│   ├── schemas/
│   │   ├── requirements/
│   │   └── artefacts/
│   ├── sample_data/
│   ├── tests/
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml
└── README.md
```

## Prerequisites
- Python 3.11+
- Node.js 20+
- Docker Desktop with Docker Compose, or a locally installed PostgreSQL 16+

## 1. Start PostgreSQL

From the repository root:

```bash
docker compose up -d postgres
```

PostgreSQL will be available at `localhost:5432`.
The development database is `implementation_studio`, username `studio`, password `studio_dev_password`.
Change these credentials before any shared or deployed environment.

## 2. Start the backend

```bash
cd backend
python -m venv .venv
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Install dependencies and configure environment:

```bash
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and adjust `DATABASE_URL` if needed.

```bash
uvicorn app.main:app --reload
```

- API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- Health: http://localhost:8000/health
- Schema catalog: http://localhost:8000/api/v1/schemas

Uploaded originals, extracted text, source segments, warnings and canonical requirements are persisted as JSON and text files under `backend/data/documents/` by default. This local file store keeps the prototype usable without PostgreSQL; document data is excluded from Git. PostgreSQL remains configured for later relational persistence.

### Document ingestion and requirement extraction

- Upload PDF, DOCX, XLSX, JSON, TXT or Markdown files through the workspace or `POST /api/v1/documents` (maximum 25 MB).
- Extracted segments retain page, section, paragraph, sheet and cell-range metadata where the source format exposes it. Empty or unreadable pages, sections and sheets are returned as warnings.
- Run `POST /api/v1/documents/{document_id}/extract` with `{"mode":"demo"}` for clearly labelled heuristic candidates. They are marked `NEEDS_REVIEW` and carry low confidence.
- Configure an OpenAI-compatible provider with `LLM_ENDPOINT`, `LLM_MODEL` and `LLM_API_KEY`, or provide endpoint/model/key in the UI for a single request. The key entered in the UI is not persisted.
- Every extracted requirement must cite a verbatim quote from a source segment. The API validates the quote, canonical requirement schema, and source offsets before storing results.
- `GET /api/v1/documents` lists stored sources; `GET /api/v1/documents/{document_id}` returns extracted text, segments, warnings and requirements.

### Artefact generation

- Approve a reviewed requirement with `POST /api/v1/documents/{document_id}/requirements/{requirement_id}/approve`. Requirements with unresolved questions, including `OPEN_QUESTION` records, cannot be approved.
- Generate configurations from approved requirements with `POST /api/v1/documents/{document_id}/generate`. This uses the configured OpenAI-compatible provider and requires a provider API key when a supported requirement is ready.
- Requirement categories route to their corresponding contracts: `PARAMETER` to the parameter schema, `BUSINESS_RULE` to business-rule, `VALIDATION` and `FIELD` to validation, and `WORKFLOW` to workflow. Unsupported types are reported rather than guessed.
- Generated artefacts are linked by `source_requirements`, assigned `VALIDATED` or `VALIDATION_FAILED`, and returned with their selected schema path and validation errors. The generation report lists approved requirements that produced no artefact, as well as items not approved or unsupported.
- Artefacts and generation reports are stored with the document and exposed by `GET /api/v1/documents/{document_id}`.

Common environment settings are shown in `backend/.env.example`. The default storage directory is relative to the backend directory.

## 3. Start the frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite, usually http://localhost:5173.

## 4. Validate the sample JSON manually

Install backend dependencies first, then run from `backend/`:

```bash
python -m app.core.validate_sample
```

This validates the sample requirement and three sample artefacts against the schemas in this repository.

## Schema design

### Canonical requirement
`backend/schemas/requirements/requirement.schema.json` describes the normalized representation of an extracted requirement, including:
- stable requirement ID and type
- structured statement and implementation intent
- source document, page, section and exact source text
- extraction status and unresolved questions

### Artefact envelope
`backend/schemas/artefacts/common/artefact_envelope.schema.json` defines the common metadata expected on all artefacts.

### Category schemas
The parameter, business-rule and workflow schemas define category-specific configuration payloads. They repeat the common envelope constraints so each category schema is independently usable by a JSON Schema validator.

### Important distinction
- Requirement JSON = what the business asked for, normalized into structured data.
- JSON Schema = the contract that defines valid JSON structure and constraints.
- Artefact JSON = the actual implementation configuration generated from requirements.

The sample artefacts are illustrative canonical configurations. They are not guaranteed to be directly executable by a particular bank's lending platform.

## Next milestone
1. Add project-level organization and PostgreSQL migrations for document, requirement and artefact records.
2. Add requirement and artefact editing with evidence-preserving version history.
3. Add review, approval and publication workflows for generated configurations.
