from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AI Implementation Studio"
    app_env: str = "local"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql://studio:studio_dev_password@localhost:5432/implementation_studio"
    cors_origins: str = "http://localhost:5173"
    document_storage_dir: str = "data/documents"
    llm_endpoint: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"
    llm_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
