# SPDX-License-Identifier: MIT
"""Health and readiness endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_async_session
from ...services.health import check_celery, check_database, overall_status

router = APIRouter(tags=["health"])


@router.get(
    "/health/live",
    summary="Liveness probe",
    response_model=dict,
)
async def liveness_probe() -> dict:
    """
    Quick liveness probe used by load balancers.
    """
    return {"status": "ok"}


@router.get(
    "/health/ready",
    summary="Readiness probe",
    response_model=dict,
)
async def readiness_probe(
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    """
    Validate that critical dependencies are ready to serve traffic.
    """
    database_status = await check_database(session)
    celery_status = check_celery()

    checks = {"database": database_status, "celery": celery_status}

    return {
        "status": overall_status(checks.values()),
        "checks": checks,
    }
