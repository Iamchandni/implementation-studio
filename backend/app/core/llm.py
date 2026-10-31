import json
import httpx
from app.core.config import settings

class LLMError(RuntimeError):
    pass

class LLMClient:
    """Small provider adapter inspired by EZIO's provider-agnostic LLM router.

    Supported modes:
      - mock: deterministic local fallback; no API key required
      - gemini: Gemini generateContent REST API
      - openai: OpenAI-compatible chat completions endpoint
    """
    async def json(self, system_prompt: str, user_prompt: str) -> dict | None:
        provider = settings.llm_provider.lower()
        if provider == "mock":
            return None
        if provider == "gemini":
            if not settings.gemini_api_key:
                raise LLMError("GEMINI_API_KEY is required when LLM_PROVIDER=gemini")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.llm_model}:generateContent"
            payload = {"system_instruction": {"parts": [{"text": system_prompt}]},
                       "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                       "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}}
            async with httpx.AsyncClient(timeout=90) as client:
                response = await client.post(url, params={"key": settings.gemini_api_key}, json=payload)
                response.raise_for_status()
                data = response.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return self._parse(text)
        if provider == "openai":
            if not settings.openai_api_key:
                raise LLMError("OPENAI_API_KEY is required when LLM_PROVIDER=openai")
            url = settings.openai_base_url.rstrip("/") + "/chat/completions"
            payload = {"model": settings.llm_model, "temperature": 0.1,
                       "response_format": {"type": "json_object"},
                       "messages": [{"role": "system", "content": system_prompt},
                                    {"role": "user", "content": user_prompt}]}
            async with httpx.AsyncClient(timeout=90) as client:
                response = await client.post(url, headers={"Authorization": f"Bearer {settings.openai_api_key}"}, json=payload)
                response.raise_for_status()
                data = response.json()
            return self._parse(data["choices"][0]["message"]["content"])
        raise LLMError(f"Unsupported LLM_PROVIDER: {provider}")

    @staticmethod
    def _parse(raw: str) -> dict:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        try:
            value = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise LLMError(f"LLM returned invalid JSON: {exc}") from exc
        if not isinstance(value, dict):
            raise LLMError("Expected a JSON object from LLM")
        return value

llm_client = LLMClient()
