# SPDX-License-Identifier: MIT
"""Version 1 API routers."""

from .audits import router as audits_router
from .health import router as health_router

__all__ = ["audits_router", "health_router"]
