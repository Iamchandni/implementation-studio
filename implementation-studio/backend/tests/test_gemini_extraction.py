import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core import requirement_extraction


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class FakeAsyncClient:
    last_request = None

    def __init__(self, **_kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def post(self, url, **kwargs):
        self.last_request = (url, kwargs)
        FakeAsyncClient.last_request = self.last_request
        return FakeResponse({
            "candidates": [{
                "content": {
                    "parts": [{
                        "text": json.dumps({
                            "requirements": [{
                                "evidence_segment_id": "SEG-001",
                                "source_text": "Applicants must be between 21 and 60 years of age.",
                                "requirement_type": "VALIDATION",
                                "title": "Applicant age range",
                                "statement": "Applicants must be between 21 and 60 years of age.",
                                "normalized_intent": "Validate applicant age between 21 and 60.",
                                "subject": "Applicant",
                                "attributes": {},
                                "conditions": [],
                                "outcomes": [],
                                "dependencies": [],
                                "confidence": 0.9,
                                "status": "NEEDS_REVIEW",
                                "open_questions": [],
                            }]
                        })
                    }]
                }
            }]
        })


class GeminiExtractionTests(unittest.IsolatedAsyncioTestCase):
    async def test_native_gemini_response_is_canonicalized_with_exact_evidence(self):
        document = {
            "document_id": "DOC-001",
            "document_name": "requirements.md",
            "segments": [{
                "segment_id": "SEG-001",
                "page": None,
                "section": "Eligibility",
                "paragraph": 1,
                "sheet": None,
                "text": "Applicants must be between 21 and 60 years of age.",
                "char_start": 0,
                "char_end": 52,
            }],
        }

        with patch.object(requirement_extraction.httpx, "AsyncClient", FakeAsyncClient):
            requirements = await requirement_extraction.extract_requirements(
                document,
                "gemini",
                None,
                "gemini-test",
                "test-key",
            )

        self.assertEqual(requirements[0]["requirement_id"], "REQ-0001")
        self.assertEqual(requirements[0]["source"]["source_text"], document["segments"][0]["text"])
        url, request = FakeAsyncClient.last_request
        self.assertEqual(
            url,
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent",
        )
        self.assertEqual(request["headers"]["x-goog-api-key"], "test-key")
        self.assertEqual(request["json"]["generationConfig"]["responseMimeType"], "application/json")
        self.assertEqual(request["json"]["contents"][0]["role"], "user")

    async def test_gemini_requires_an_api_key(self):
        with patch.object(requirement_extraction.settings, "gemini_api_key", ""):
            with self.assertRaisesRegex(ValueError, "Gemini API key"):
                await requirement_extraction.extract_requirements(
                    {"segments": []},
                    "gemini",
                    None,
                    None,
                    None,
                )


if __name__ == "__main__":
    unittest.main()
