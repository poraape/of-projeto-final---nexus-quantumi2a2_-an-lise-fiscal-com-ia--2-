# SPDX-License-Identifier: MIT
"""
Celery application factory.

Centralising Celery instantiation makes it easier to share the same
configuration across worker processes and the FastAPI runtime when it
needs to trigger background tasks.
"""

from celery import Celery

from ..core.config import get_settings


def create_celery_app() -> Celery:
    """Instantiate and configure the Celery application."""
    settings = get_settings()

    celery = Celery(
        "nexus_quantum",
        broker=settings.celery_broker_url,
        backend=settings.celery_backend_url,
        include=["app.workers.tasks"],
    )

    celery.conf.update(
        task_default_queue="audit_default",
        worker_hijack_root_logger=False,
        task_track_started=True,
        task_time_limit=60 * 10,
        result_expires=60 * 60,
    )

    return celery


celery_app = create_celery_app()
