from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "AI Implementation Studio"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./implementation_studio.db"
    upload_dir: str = "./uploads"
    max_upload_mb: int = 20
    llm_provider: str = "mock"
    llm_model: str = "gemini-2.5-flash"
    gemini_api_key: str = ""
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]

settings = Settings()
