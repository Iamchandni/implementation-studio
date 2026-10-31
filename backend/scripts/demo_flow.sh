#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:8000/api/v1}"
PROJECT_JSON=$(curl -fsS -X POST "$BASE_URL/demo/seed")
echo "$PROJECT_JSON" | python -m json.tool
PROJECT_ID=$(echo "$PROJECT_JSON" | python -c 'import json,sys; print(json.load(sys.stdin)["project_id"])')
curl -fsS -X POST "$BASE_URL/projects/$PROJECT_ID/generate" -H 'Content-Type: application/json' -d '{}' | python -m json.tool
curl -fsS -X POST "$BASE_URL/projects/$PROJECT_ID/validate" | python -m json.tool
curl -fsS -X POST "$BASE_URL/projects/$PROJECT_ID/tests/generate" | python -m json.tool
curl -fsS -X POST "$BASE_URL/projects/$PROJECT_ID/tests/run" | python -m json.tool
echo "Demo project: $PROJECT_ID"
