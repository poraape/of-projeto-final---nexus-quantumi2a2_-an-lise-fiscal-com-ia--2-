# SPDX-License-Identifier: MIT
"""Audit endpoints."""

from __future__ import annotations

from typing import Annotated

import asyncio
import json
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Header,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import AsyncSessionFactory, get_async_session
from ...schemas import AuditJobListResponse, AuditJobResponse
from ...services import (
    create_or_get_audit_job,
    enqueue_audit_job,
    get_audit_job,
    list_audit_jobs,
)

router = APIRouter(prefix="/audits", tags=["audits"])


@router.post(
    "",
    response_model=AuditJobResponse,
    summary="Create a new fiscal audit",
)
async def create_audit_job(
    response: Response,
    files: list[UploadFile] = File(..., description="Upload files to be audited."),
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    session: AsyncSession = Depends(get_async_session),
) -> AuditJobResponse:
    """Upload files and enqueue the audit pipeline."""

    if idempotency_key is None or not idempotency_key.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Header 'Idempotency-Key' is required.",
        )

    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Send at least one file for audit.",
        )

    normalized_key = idempotency_key.strip()
    try:
        job, created = await create_or_get_audit_job(
            session,
            idempotency_key=normalized_key,
            files=files,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    if created:
        enqueue_audit_job(job.id)
        response.status_code = status.HTTP_202_ACCEPTED
    else:
        response.status_code = status.HTTP_200_OK

    return AuditJobResponse.model_validate(job)


@router.get(
    "/{job_id}",
    response_model=AuditJobResponse,
    summary="Retrieve an audit job by id",
)
async def retrieve_audit_job(
    job_id: UUID,
    session: AsyncSession = Depends(get_async_session),
) -> AuditJobResponse:
    job = await get_audit_job(session, job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audit job '{job_id}' not found.",
        )
    return AuditJobResponse.model_validate(job)


@router.get(
    "",
    response_model=AuditJobListResponse,
    summary="List audit jobs",
)
async def list_audits(
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    session: AsyncSession = Depends(get_async_session),
) -> AuditJobListResponse:
    jobs, total = await list_audit_jobs(session, limit=limit, offset=offset)
    return AuditJobListResponse(
        items=[AuditJobResponse.model_validate(job) for job in jobs],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{job_id}/events",
    summary="Stream audit job updates (SSE)",
)
async def stream_audit_job(job_id: UUID) -> StreamingResponse:
    return StreamingResponse(
        _stream_job_updates(job_id),
        media_type="text/event-stream",
    )
TERMINAL_STATUSES = {"COMPLETED", "FAILED", "CANCELLED"}


async def _stream_job_updates(job_id: UUID):
    last_payload = None
    while True:
        # create a fresh session per iteration to keep connection short-lived
        async with AsyncSessionFactory() as session:
            job = await get_audit_job(session, job_id)

        if job is None:
            data = json.dumps({"error": f"Audit job '{job_id}' not found."})
            yield f"event: error\ndata: {data}\n\n"
            return

        serialized = AuditJobResponse.model_validate(job).model_dump()

        if serialized != last_payload:
            last_payload = serialized
            yield f"data: {json.dumps(serialized, default=str)}\n\n"

        if serialized["status"] in TERMINAL_STATUSES:
            yield "event: end\ndata: done\n\n"
            return

        await asyncio.sleep(1.5)
