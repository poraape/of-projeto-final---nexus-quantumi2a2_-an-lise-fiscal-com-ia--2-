# SPDX-License-Identifier: MIT
"""Pydantic schemas for audit job operations."""

from __future__ import annotations

from datetime import datetime
from typing import Any, List
from uuid import UUID

from pydantic import BaseModel, Field
from pydantic.config import ConfigDict

from ..db.models.audit_job import AuditJobStatus


class AuditJobResponse(BaseModel):
    """API representation of an audit job."""

    id: UUID
    status: AuditJobStatus
    idempotency_key: str = Field(min_length=1, max_length=128)
    input_summary: str | None = None
    storage_path: str | None = None
    input_payload: list[dict[str, Any]] | None = None
    result_payload: dict[str, Any] | None = None
    error_payload: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditJobListResponse(BaseModel):
    """Paginated list of audit jobs."""

    items: List[AuditJobResponse]
    total: int
    limit: int
    offset: int
