from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-driven configuration for the BhoomiLens API."""

    model_config = SettingsConfigDict(env_prefix="BHOOMILENS_", env_file=".env", extra="ignore")

    env: str = "development"
    api_prefix: str = "/api/v1"
    # Development placeholder only. Must be replaced by a managed secret in production.
    secret_key: str = "bhoomilens-development-secret-key-change-me"
    algorithm: str = "HS256"
    access_token_ttl_minutes: int = 480
    data_seed: int = 20260909
    data_scale: str = "standard"
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
