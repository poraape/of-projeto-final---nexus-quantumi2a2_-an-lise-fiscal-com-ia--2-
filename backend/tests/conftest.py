import asyncio
import os
import shutil
import tempfile
from pathlib import Path
from typing import AsyncGenerator

import pytest
from httpx import AsyncClient

# Configure environment before importing application modules
_DB_DIR = Path(tempfile.mkdtemp(prefix="nexus_backend_db_"))
_DB_PATH = _DB_DIR / "test.db"
_UPLOADS_DIR = Path(tempfile.mkdtemp(prefix="nexus_backend_uploads_"))

os.environ.setdefault("ENVIRONMENT", "test")
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_DB_PATH.as_posix()}"
os.environ["UPLOADS_DIR"] = _UPLOADS_DIR.as_posix()

from app.core.config import get_settings
from app.db.base import Base
from app.db.models import AuditJob
from app.db.session import AsyncSessionFactory, engine
from app.main import app
from sqlalchemy import delete

get_settings.cache_clear()


@pytest.fixture(scope="session")
def event_loop() -> AsyncGenerator[asyncio.AbstractEventLoop, None]:
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
async def prepare_database() -> AsyncGenerator[None, None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()
    shutil.rmtree(_DB_DIR, ignore_errors=True)
    shutil.rmtree(_UPLOADS_DIR, ignore_errors=True)


@pytest.fixture(autouse=True)
async def cleanup_state() -> AsyncGenerator[None, None]:
    yield
    async with AsyncSessionFactory() as session:
        await session.execute(delete(AuditJob))
        await session.commit()
    for item in get_settings().uploads_dir_path.iterdir():
        if item.is_dir():
            shutil.rmtree(item, ignore_errors=True)
        else:
            item.unlink(missing_ok=True)


@pytest.fixture()
async def client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(app=app, base_url="http://testserver") as async_client:
        yield async_client


@pytest.fixture()
def captured_tasks(monkeypatch: pytest.MonkeyPatch) -> list[dict]:
    tasks: list[dict] = []

    def _fake_send(task_name: str, args=None, kwargs=None):
        tasks.append({"task": task_name, "args": args or [], "kwargs": kwargs or {}})

    monkeypatch.setattr("app.services.audit.celery_app.send_task", _fake_send)
    return tasks
