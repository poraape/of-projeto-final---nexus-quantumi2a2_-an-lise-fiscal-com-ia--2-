# SPDX-License-Identifier: MIT
"""Initial schema for audit jobs."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20251031_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "RUNNING",
                "COMPLETED",
                "FAILED",
                "CANCELLED",
                name="audit_job_status",
            ),
            nullable=False,
        ),
        sa.Column("input_summary", sa.String(length=255), nullable=True),
        sa.Column("storage_path", sa.String(length=255), nullable=True),
        sa.Column("input_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("result_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("idempotency_key", name="uq_audit_jobs_idempotency_key"),
    )
    op.create_index("ix_audit_jobs_idempotency_key", "audit_jobs", ["idempotency_key"])
    op.create_index("ix_audit_jobs_status", "audit_jobs", ["status"])


def downgrade() -> None:
    op.drop_index("ix_audit_jobs_status", table_name="audit_jobs")
    op.drop_index("ix_audit_jobs_idempotency_key", table_name="audit_jobs")
    op.drop_table("audit_jobs")
    op.execute("DROP TYPE IF EXISTS audit_job_status")
