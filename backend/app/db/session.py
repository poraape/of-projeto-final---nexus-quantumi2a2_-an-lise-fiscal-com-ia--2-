# SPDX-License-Identifier: MIT
"""
Async SQLAlchemy session management.

This module keeps session creation in a single place so the same engine
configuration is shared across API handlers, workers and scripts.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from ..core.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    future=True,
    echo=settings.environment == "development",
    pool_pre_ping=True,
)

AsyncSessionFactory = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides an AsyncSession.
    """
    async with AsyncSessionFactory() as session:
        yield session
__all__ = ["engine", "get_async_session", "AsyncSessionFactory"]
