# SPDX-License-Identifier: MIT
"""
Central logging configuration using structlog.

The logging configuration is reusable across FastAPI and Celery
components so structured logs share the same format.
"""

import logging
from logging.config import dictConfig
from typing import Any, Dict

import structlog


def _build_logging_config(level: str) -> Dict[str, Any]:
    """Return a dictConfig-compatible logging configuration."""
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "plain": {
                "()": structlog.stdlib.ProcessorFormatter,
                "processor": structlog.processors.JSONRenderer(),
                "foreign_pre_chain": [
                    structlog.processors.TimeStamper(fmt="iso"),
                    structlog.processors.add_log_level,
                    structlog.processors.add_logger_name,
                ],
            }
        },
        "handlers": {
            "default": {
                "class": "logging.StreamHandler",
                "formatter": "plain",
            }
        },
        "loggers": {
            "": {
                "handlers": ["default"],
                "level": level,
            },
            "uvicorn": {"handlers": ["default"], "level": level, "propagate": False},
            "uvicorn.error": {
                "handlers": ["default"],
                "level": level,
                "propagate": False,
            },
            "uvicorn.access": {
                "handlers": ["default"],
                "level": level,
                "propagate": False,
            },
        },
    }


def configure_logging(level: str | None = None) -> None:
    """Configure structlog and standard logging."""
    from .config import get_settings

    settings = get_settings()
    effective_level = level or settings.log_level.upper()

    dictConfig(_build_logging_config(effective_level))

    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, effective_level, logging.INFO)
        ),
        context_class=dict,
        cache_logger_on_first_use=True,
    )
