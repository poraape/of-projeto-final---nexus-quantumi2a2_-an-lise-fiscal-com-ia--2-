#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Audit job model used to track pipeline executions."""

from __future__ import annotations

import uuid
from enum import Enum

from sqlalchemy import Column, DateTime, JSON, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.types import Enum as SQLEnum

from ..base import Base


class AuditJobStatus(str, Enum):
    """Allowed states for audit jobs."""

    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class AuditJob(Base):
    """Represents a fiscal audit execution request."""

    __tablename__ = "audit_jobs"
    __table_args__ = (
        UniqueConstraint(
            "idempotency_key",
            name="uq_audit_jobs_idempotency_key",
        ),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    idempotency_key = Column(String(length=128), nullable=False, index=True)
    status = Column(
        SQLEnum(AuditJobStatus, name="audit_job_status"),
        nullable=False,
        index=True,
        default=AuditJobStatus.PENDING,
    )
    input_summary = Column(String(length=255), nullable=True)
    storage_path = Column(String(length=255), nullable=True)
    input_payload = Column(JSONB().with_variant(JSON(), "sqlite"), nullable=True)
    result_payload = Column(JSONB().with_variant(JSON(), "sqlite"), nullable=True)
    error_payload = Column(JSONB().with_variant(JSON(), "sqlite"), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    def mark_running(self) -> None:
        self.status = AuditJobStatus.RUNNING

    def mark_completed(self, result: dict | None = None) -> None:
        self.status = AuditJobStatus.COMPLETED
        if result is not None:
            self.result_payload = result

    def mark_failed(self, error: dict | None = None) -> None:
        self.status = AuditJobStatus.FAILED
        if error is not None:
            self.error_payload = error
