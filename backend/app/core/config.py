# SPDX-License-Identifier: MIT
"""
Application configuration powered by Pydantic Settings.

The goal is to centralise environment-driven configuration so it can be
consumed consistently across API handlers, workers and background tasks.
"""

from functools import lru_cache
from pathlib import Path
from typing import Any, List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Core runtime configuration."""

    app_name: str = "Nexus Quantum I2A2"
    app_version: str = "0.1.0"
    environment: str = "development"

    api_v1_prefix: str = "/api/v1"
    enable_docs: bool = True

    database_url: str = "postgresql+asyncpg://nexus:nexus@localhost:5432/nexus"
    alembic_script_location: str = "app.db:migrations"

    redis_url: str = "redis://localhost:6379/0"
    celery_result_backend: str | None = None

    enable_cors: bool = True
    cors_origins: List[str] | None = ["http://localhost:5173"]

    uploads_dir: str = "storage/uploads"
    max_upload_files: int = 25
    max_upload_file_bytes: int = 25 * 1024 * 1024  # 25 MB
    max_upload_job_bytes: int = 100 * 1024 * 1024  # 100 MB
    allowed_upload_extensions: List[str] | None = [
        "xml",
        "csv",
        "xlsx",
        "pdf",
        "png",
        "jpg",
        "jpeg",
        "txt",
    ]

    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="allow",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> List[str] | None:
        """
        Allow configuring CORS origins via comma-separated strings.
        """
        if value is None or value == "":
            return None
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("allowed_upload_extensions", mode="before")
    @classmethod
    def parse_allowed_extensions(cls, value: Any) -> List[str] | None:
        if value is None or value == "":
            return None
        if isinstance(value, str):
            return [ext.strip().lower() for ext in value.split(",") if ext.strip()]
        return [str(ext).lower() for ext in value]

    @property
    def celery_broker_url(self) -> str:
        """
        Resolve the Celery broker URL. Defaults to Redis when not provided.
        """
        return self.redis_url

    @property
    def celery_backend_url(self) -> str:
        """
        Resolve the Celery result backend.
        """
        return self.celery_result_backend or self.redis_url

    @property
    def uploads_dir_path(self) -> Path:
        """
        Resolve and ensure the directory used to persist uploaded files.
        """
        path = Path(self.uploads_dir).expanduser()
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        path.mkdir(parents=True, exist_ok=True)
        return path


@lru_cache
def get_settings() -> Settings:
    """Return a cached instance of application settings."""
    return Settings()
