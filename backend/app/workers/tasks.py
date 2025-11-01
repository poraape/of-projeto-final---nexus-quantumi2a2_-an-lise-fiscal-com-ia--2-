# SPDX-License-Identifier: MIT
"""
Celery task definitions.

Real implementations will evolve as the pipeline migrates from the
frontend worker to server-side processing.
"""

from __future__ import annotations

import asyncio
import uuid
from pathlib import Path

import structlog
from celery import shared_task

from ..core.config import get_settings
from ..db.models import AuditJob
from ..db.session import AsyncSessionFactory
from .outcome import create_report_payload, summarise_job

logger = structlog.get_logger(__name__)
settings = get_settings()


@shared_task(name="health.ping")
def ping() -> str:
    """Simple ping task used for smoke tests."""
    return "pong"


@shared_task(name="audits.process")
def process_audit_job(job_id: str) -> None:
    """Process an audit job (placeholder)."""
    asyncio.run(_process_audit_job(job_id))


async def _process_audit_job(job_id: str) -> None:
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        logger.error("audit_job_invalid_uuid", job_id=job_id)
        return

    async with AsyncSessionFactory() as session:
        job = await session.get(AuditJob, job_uuid)
        if job is None:
            logger.warning("audit_job_not_found", job_id=job_id)
            return

        try:
            job.mark_running()
            await session.commit()

            files = job.input_payload or []
            for file_entry in files:
                stored_path = file_entry.get("stored_path")
                if not stored_path:
                    continue
                absolute = settings.uploads_dir_path / Path(stored_path)
                logger.info(
                    "audit_job_file_ready",
                    job_id=job_id,
                    file=str(absolute),
                    sha256=file_entry.get("sha256"),
                )

            # Placeholder implementation: mark ascompleted imediatamente.
            summary = summarise_job(job)
            report_payload = create_report_payload(job)
            job.mark_completed({
                "message": "Processamento backend concluído.",
                "files": job.input_payload or [],
                "summary": summary,
                "report": report_payload,
            })
            await session.commit()
            logger.info("audit_job_completed_placeholder", job_id=job_id)
        except Exception as exc:  # pragma: no cover - defensive branch
            await session.rollback()
            job = await session.get(AuditJob, job_uuid)
            if job is None:
                logger.exception(
                    "audit_job_failed_missing_after_rollback",
                    job_id=job_id,
                    error=str(exc),
                )
                return
            job.mark_failed({"error": str(exc)})
            await session.commit()
            logger.exception("audit_job_failed", job_id=job_id, error=str(exc))
