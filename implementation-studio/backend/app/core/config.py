from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AI Implementation Studio"
    app_env: str = "local"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql://studio:studio_dev_password@localhost:5432/implementation_studio"
    cors_origins: str = "http://localhost:5173"
    document_storage_dir: str = "data/documents"
    llm_endpoint: str = "https://openrouter.ai/api/v1"
    llm_model: str = "google/gemma-4-31b-it:free"
    llm_api_key: str = ""
    openrouter_api_key: str = ""
    gemini_endpoint: str = "https://generativelanguage.googleapis.com/v1beta"
    gemini_model: str = "gemini-2.0-flash"
    gemini_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
