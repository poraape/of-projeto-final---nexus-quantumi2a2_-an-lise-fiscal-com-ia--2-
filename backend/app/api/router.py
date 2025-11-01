# SPDX-License-Identifier: MIT
"""Root API router for public endpoints."""

from fastapi import APIRouter

from .v1 import audits_router, health_router

api_router = APIRouter()
api_router.include_router(health_router, prefix="/health")
api_router.include_router(audits_router)
