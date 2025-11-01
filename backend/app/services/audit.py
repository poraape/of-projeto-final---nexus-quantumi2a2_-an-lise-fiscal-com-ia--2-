# SPDX-License-Identifier: MIT
"""Audit job domain services."""

from __future__ import annotations

import hashlib
import secrets
import shutil
from pathlib import Path
from typing import Sequence, Tuple
from uuid import UUID

import structlog
from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import get_settings
from ..db.models import AuditJob
from ..workers import celery_app

logger = structlog.get_logger(__name__)

_AUDIT_PROCESS_TASK = "audits.process"
_CHUNK_SIZE = 1024 * 1024  # 1 MiB


async def _get_by_idempotency_key(
    session: AsyncSession, idempotency_key: str
) -> AuditJob | None:
    result = await session.execute(
        select(AuditJob).where(AuditJob.idempotency_key == idempotency_key)
    )
    return result.scalars().first()


async def get_audit_job(session: AsyncSession, job_id: UUID) -> AuditJob | None:
    """
    Retrieve a single audit job by its identifier.
    """
    return await session.get(AuditJob, job_id)


async def list_audit_jobs(
    session: AsyncSession, *, limit: int = 20, offset: int = 0
) -> tuple[list[AuditJob], int]:
    """
    Return a slice of audit jobs ordered by creation date (desc) along with total count.
    """
    jobs_stmt = (
        select(AuditJob)
        .order_by(AuditJob.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    total_stmt = select(func.count(AuditJob.id))

    jobs_result = await session.execute(jobs_stmt)
    total_result = await session.execute(total_stmt)

    jobs = list(jobs_result.scalars().all())
    total = total_result.scalar_one()
    return jobs, total


def _humanize_bytes(size: int) -> str:
    if size < 1024:
        return f"{size} B"
    for unit in ["KB", "MB", "GB", "TB"]:
        size /= 1024
        if size < 1024:
            return f"{size:.1f} {unit}"
    return f"{size:.1f} PB"


async def _persist_files(job_id: UUID, files: Sequence[UploadFile]) -> tuple[list[dict], str, str]:
    settings = get_settings()
    base_dir = settings.uploads_dir_path
    job_dir = base_dir / str(job_id)
    job_dir.mkdir(parents=True, exist_ok=True)

    stored: list[dict] = []
    total_size = 0
    max_files = settings.max_upload_files
    max_file_bytes = settings.max_upload_file_bytes
    max_job_bytes = settings.max_upload_job_bytes
    allowed_extensions = settings.allowed_upload_extensions or []

    if max_files and len(files) > max_files:
        raise ValueError(f"Limite máximo de {max_files} arquivos por auditoria excedido.")

    try:
        for upload in files:
            original_name = upload.filename or "arquivo-sem-nome"
            extension = Path(original_name).suffix.lower().lstrip(".")

            if allowed_extensions and extension not in allowed_extensions:
                raise ValueError(
                    f"O arquivo '{original_name}' possui extensão não suportada. "
                    f"Permitidos: {', '.join(allowed_extensions)}."
                )

            suffix = Path(upload.filename or "").suffix
            stored_name = f"{secrets.token_hex(16)}{suffix}"
            destination = job_dir / stored_name

            sha256 = hashlib.sha256()
            size = 0

            with destination.open("wb") as buffer:
                while True:
                    chunk = await upload.read(_CHUNK_SIZE)
                    if not chunk:
                        break
                    buffer.write(chunk)
                    size += len(chunk)
                    sha256.update(chunk)

                    if max_file_bytes and size > max_file_bytes:
                        raise ValueError(
                            f"O arquivo '{original_name}' excede o limite de {max_file_bytes / (1024 * 1024):.0f} MB."
                        )

                total_after_file = total_size + size
                if max_job_bytes and total_after_file > max_job_bytes:
                    raise ValueError(
                        f"O volume total da auditoria excede o limite de {max_job_bytes / (1024 * 1024):.0f} MB."
                    )

            await upload.seek(0)
            total_size += size

            stored.append(
                {
                    "original_name": upload.filename,
                    "stored_name": stored_name,
                    "content_type": upload.content_type,
                    "size": size,
                    "sha256": sha256.hexdigest(),
                    "stored_path": str(destination.relative_to(base_dir)),
                }
            )
    except Exception:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise

    summary = f"{len(stored)} file(s) • {_humanize_bytes(total_size)}"
    storage_path = str(job_dir.relative_to(base_dir))
    return stored, summary, storage_path


async def create_or_get_audit_job(
    session: AsyncSession,
    *,
    idempotency_key: str,
    files: Sequence[UploadFile],
) -> Tuple[AuditJob, bool]:
    """Create a new audit job or return the existing one for the idempotency key."""

    existing = await _get_by_idempotency_key(session, idempotency_key)
    if existing:
        logger.info(
            "audit_job_reused",
            job_id=str(existing.id),
            idempotency_key=idempotency_key,
        )
        return existing, False

    job = AuditJob(idempotency_key=idempotency_key)
    session.add(job)

    try:
        await session.flush()
        stored_payload, summary, storage_path = await _persist_files(job.id, files)
        job.input_payload = stored_payload
        job.input_summary = summary
        job.storage_path = storage_path
        await session.commit()
    except IntegrityError:
        await session.rollback()
        existing = await _get_by_idempotency_key(session, idempotency_key)
        if existing:
            logger.info(
                "audit_job_reused_after_race",
                job_id=str(existing.id),
                idempotency_key=idempotency_key,
            )
            return existing, False
        raise
    except ValueError:
        await session.rollback()
        raise
    except Exception:
        await session.rollback()
        raise

    await session.refresh(job)
    logger.info(
        "audit_job_created",
        job_id=str(job.id),
        idempotency_key=idempotency_key,
    )
    return job, True


def enqueue_audit_job(job_id: UUID) -> None:
    """Send the audit job to the Celery queue for processing."""
    celery_app.send_task(_AUDIT_PROCESS_TASK, args=[str(job_id)])
    logger.info("audit_job_enqueued", job_id=str(job_id))
