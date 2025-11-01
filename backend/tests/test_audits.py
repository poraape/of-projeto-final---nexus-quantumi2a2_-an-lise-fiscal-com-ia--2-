from __future__ import annotations

from pathlib import Path
from uuid import UUID

import pytest
import schemathesis
from httpx import AsyncClient

from app.core.config import get_settings
from app.db.models import AuditJob
from app.db.session import AsyncSessionFactory
from app.main import app


@pytest.mark.anyio
async def test_create_audit_job_persists_files(client: AsyncClient, captured_tasks: list[dict]) -> None:
    response = await client.post(
        "/api/v1/audits",
        headers={"Idempotency-Key": "11111111-1111-1111-1111-111111111111"},
        files={"files": ("sample.xml", b"<xml>data</xml>", "text/xml")},
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["status"] == "PENDING"
    assert payload["idempotency_key"] == "11111111-1111-1111-1111-111111111111"
    assert captured_tasks == [
        {
            "task": "audits.process",
            "args": [payload["id"]],
            "kwargs": {},
        }
    ]

    async with AsyncSessionFactory() as session:
        job = await session.get(AuditJob, UUID(payload["id"]))
        assert job is not None
        assert job.input_payload
        assert job.storage_path

        settings = get_settings()
        stored_file_info = job.input_payload[0]
        stored_path = settings.uploads_dir_path / Path(stored_file_info["stored_path"])
        assert stored_path.exists()
        assert stored_path.read_bytes() == b"<xml>data</xml>"
        assert stored_file_info["sha256"]
        assert job.input_summary.startswith("1 file(s)")


@pytest.mark.anyio
async def test_idempotent_request_returns_existing_job(client: AsyncClient, captured_tasks: list[dict]) -> None:
    headers = {"Idempotency-Key": "22222222-2222-2222-2222-222222222222"}
    files = {"files": ("sample.csv", b"id,name\n1,test", "text/csv")}

    first = await client.post("/api/v1/audits", headers=headers, files=files)
    assert first.status_code == 202
    job_id = first.json()["id"]
    assert len(captured_tasks) == 1

    second = await client.post("/api/v1/audits", headers=headers, files=files)
    assert second.status_code == 200
    assert second.json()["id"] == job_id
    # Celery task should not be enqueued again
    assert len(captured_tasks) == 1


@pytest.mark.anyio
async def test_get_audit_job_returns_job(client: AsyncClient) -> None:
    headers = {"Idempotency-Key": "44444444-4444-4444-4444-444444444444"}
    files = {"files": ("a.txt", b"foo", "text/plain")}
    create_response = await client.post("/api/v1/audits", headers=headers, files=files)
    job_id = create_response.json()["id"]

    response = await client.get(f"/api/v1/audits/{job_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == job_id
    assert data["input_payload"][0]["original_name"] == "a.txt"


@pytest.mark.anyio
async def test_list_audit_jobs_returns_items(client: AsyncClient) -> None:
    headers = {"Idempotency-Key": "55555555-5555-5555-5555-555555555555"}
    files = {"files": ("b.txt", b"bar", "text/plain")}
    first = await client.post("/api/v1/audits", headers=headers, files=files)
    job_id = first.json()["id"]

    response = await client.get("/api/v1/audits?limit=10&offset=0")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] >= 1
    assert any(item["id"] == job_id for item in payload["items"])


@pytest.mark.anyio
async def test_get_unknown_job_returns_404(client: AsyncClient) -> None:
    unknown_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    response = await client.get(f"/api/v1/audits/{unknown_id}")
    assert response.status_code == 404


@pytest.mark.anyio
async def test_missing_idempotency_header_returns_400(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/audits",
        files={"files": ("file.txt", b"content", "text/plain")},
    )
    assert response.status_code == 400


@pytest.mark.anyio
async def test_missing_files_returns_400(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/audits",
        headers={"Idempotency-Key": "33333333-3333-3333-3333-333333333333"},
        files={},
    )
    assert response.status_code == 400


schema = schemathesis.openapi.from_asgi("/api/v1/openapi.json", app)


@schema.parametrize()
def test_openapi_contract(case, captured_tasks):
    if case.method == "POST" and case.path == "/api/v1/audits":
        pytest.skip("Multipart body generation not yet supported in contract tests")
    response = case.call_asgi()
    case.validate_response(response)
