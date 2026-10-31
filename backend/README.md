# AI Implementation Studio

A hackathon-ready foundation for the problem statement **AI Implementation Studio**: convert business requirements into traceable, reviewable implementation artefacts and executable validation.

## What it does

1. Create an implementation workspace and upload PDF, DOCX, TXT or Markdown business briefs.
2. Extract structured requirements with source excerpts, confidence and clarification state.
3. Keep ambiguous requirements unresolved until a human provides clarification.
4. Generate a proposed implementation workflow, business-rule catalogue, data mappings and OpenAPI contract.
5. Generate and run positive, negative and boundary test cases.
6. Validate artefacts, calculate change impact, record approvals and verify the append-only audit chain.
7. Export a versioned implementation package after blockers are resolved.

## Architecture

- **Backend:** Python 3.12+, FastAPI, SQLAlchemy, SQLite by default (PostgreSQL configurable).
- **Frontend:** Next.js App Router, React, TypeScript, React Flow.
- **LLM layer:** provider abstraction in `app/core/llm.py`; extraction can use a configured model, while deterministic templates provide a reliable offline fallback.
- **Workflow UI:** retained Adam Hack workflow canvas component and its supporting brand icon/util modules. It is used as the visual orchestration surface, not as a source of business logic.
- **Audit:** append-only hash-chained events.

## Quick start

Backend:
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```
Frontend:
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```
Open `http://localhost:3000` and click **Load synthetic demo**. API docs: `http://localhost:8000/docs`.

## Main API routes

- `POST /api/v1/projects` and `GET /api/v1/projects`
- `POST /api/v1/demo/seed`
- `POST /api/v1/projects/{id}/documents` (multipart upload)
- `POST /api/v1/projects/{id}/documents/{document_id}/extract-requirements`
- `GET /api/v1/projects/{id}/requirements`
- `POST /api/v1/projects/{id}/requirements/{requirement_id}/clarification`
- `POST /api/v1/projects/{id}/generate`
- `GET /api/v1/projects/{id}/artifacts`
- `POST /api/v1/projects/{id}/validate`
- `POST /api/v1/projects/{id}/tests/generate` and `/tests/run`
- `POST /api/v1/projects/{id}/changes`
- `GET /api/v1/projects/{id}/requirements/{requirement_id}/impact`
- `POST /api/v1/projects/{id}/publish` and `GET /api/v1/projects/{id}/export`
- `GET /api/v1/projects/{id}/audit/verify`

## Demo data and limitations

The demo is synthetic retail account opening requirements. One requirement intentionally lacks a retention-period value and is marked `needs_clarification`. Generated workflow and mappings are proposed outputs, not authoritative integrations. The demo test executor is deterministic; no live banking, CRM or core systems are called. Authentication/RBAC, production connectors, durable workflow execution, model evaluation and real environment deployment are outside this hackathon baseline.

## Adam Hack reference

`references/ezio_backend_reference/` contains selected backend reference snippets for provider routing, workflow suggestions, execution and audit concepts. `references/adam_frontend_reference/` contains the original frontend reference files. The reused canvas is retained in `frontend/src/components/workflow-canvas.tsx`; surrounding product UX is specific to AI Implementation Studio.
