# SPDX-License-Identifier: MIT
"""
Application bootstrap for the backend service.

This module is intentionally lightweight in this stage; routes and
extensions are plugged in from dedicated packages so we can evolve
the architecture without rewriting the entrypoint.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import api_router
from .core.config import get_settings
from .core.logging import configure_logging


def create_app() -> FastAPI:
    """
    Instantiate a FastAPI application with the project defaults.

    Returns
    -------
    FastAPI
        Application ready to receive routers and event handlers.
    """
    settings = get_settings()
    configure_logging()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        docs_url=f"{settings.api_v1_prefix}/docs" if settings.enable_docs else None,
        redoc_url=f"{settings.api_v1_prefix}/redoc" if settings.enable_docs else None,
        openapi_url=f"{settings.api_v1_prefix}/openapi.json"
        if settings.enable_docs
        else None,
    )

    if settings.enable_cors and settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_methods=["*"],
            allow_headers=["*"],
            allow_credentials=True,
        )

    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/health", include_in_schema=False)
    async def root_health() -> dict:
        """
        Backward compatible health endpoint.
        """
        return {"status": "ok"}

    return app


app = create_app()
