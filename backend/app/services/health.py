# SPDX-License-Identifier: MIT
"""
Health check helpers shared by HTTP endpoints and monitoring tasks.
"""

from collections.abc import Iterable
from typing import Any, Dict

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..workers import celery_app


async def check_database(session: AsyncSession) -> Dict[str, Any]:
    """
    Execute a lightweight query to ensure the database is reachable.
    """
    try:
        await session.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as exc:  # pragma: no cover - defensive
        return {"status": "error", "detail": str(exc)}


def check_celery() -> Dict[str, Any]:
    """
    Ensure the Celery broker is reachable.
    """
    try:
        with celery_app.connection_or_acquire() as connection:
            connection.ensure_connection(max_retries=0)
        return {"status": "ok"}
    except Exception as exc:  # pragma: no cover - defensive
        return {"status": "degraded", "detail": str(exc)}


def overall_status(checks: Iterable[Dict[str, Any]]) -> str:
    """
    Compute an aggregated status from all checks.
    """
    has_error = any(check.get("status") == "error" for check in checks)
    if has_error:
        return "error"
    has_degraded = any(check.get("status") == "degraded" for check in checks)
    return "degraded" if has_degraded else "ok"
