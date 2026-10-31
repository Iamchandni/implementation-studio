# AI Implementation Studio — Milestone 1

A local prototype foundation for converting business requirements into structured, traceable implementation artefacts.

## Stack
- Frontend: React + Vite
- Backend: Python + FastAPI
- Database: PostgreSQL
- Contracts: JSON Schema Draft 2020-12
- LLM: provider-independent (not configured in Milestone 1)

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

The database connection is configured but no tables are created in Milestone 1. Database models and migrations belong in the next implementation step.

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

## LLM provider decision

No provider SDK is installed or selected yet. Milestone 2 should introduce a small provider adapter interface, then implement the selected provider behind that interface. Do not put provider-specific calls inside extraction or artefact business logic.

## Next milestone
1. Add document upload and parsing for PDF, DOCX, XLSX and text.
2. Persist projects, source documents and extracted requirements in PostgreSQL.
3. Add an LLM provider adapter and extraction prompts.
4. Extract requirements with exact source evidence and processing warnings.
5. Generate artefacts from the canonical requirements and validate them.
