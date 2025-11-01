# Backend Service - Nexus Quantum I2A2

This directory hosts the FastAPI-based backend that will power the Nexus Quantum I2A2 platform. The goal is to provide a secure, observable and scalable execution environment for the fiscal analysis pipeline while keeping the existing React UI unchanged.

## Stack highlights

- FastAPI for the HTTP layer (REST/GraphQL ready).
- SQLAlchemy 2.x with async sessions for PostgreSQL.
- Celery + Redis for background jobs and orchestration.
- Structlog for structured logging.
- Pydantic Settings for environment-based configuration.
- Alembic for safe schema migrations.

## Layout

```
backend/
|-- app/
|   |-- api/          # Routers and versioned endpoints
|   |-- core/         # Settings, logging, shared utils
|   |-- db/           # Engine, sessions and base models
|   |-- schemas/      # Pydantic response/request models
|   |-- services/     # Domain/application services
|   `-- workers/      # Celery app and worker tasks
|-- main.py           # ASGI entrypoint used by uvicorn
|-- Dockerfile        # Backend container definition
|-- alembic.ini       # Alembic configuration (async)
`-- requirements.txt  # Backend dependencies
```

### API endpoints

- `POST /api/v1/audits`
  - Headers: `Idempotency-Key: <uuid>`
  - Body: `multipart/form-data` with one or more `files`
  - Responses:
    - `202 Accepted` when a new job is created and enqueued
    - `200 OK` when the same `Idempotency-Key` is re-used (idempotent replay)
  - Example:
    ```bash
    curl -X POST http://localhost:8000/api/v1/audits \
      -H "Idempotency-Key: 123e4567-e89b-12d3-a456-426614174000" \
      -F "files=@sample.xml"
    ```
- `GET /api/v1/audits/{id}`
  - Retorna o job com metadados e status atuais
- `GET /api/v1/audits`
  - Parâmetros: `limit`, `offset`
  - Retorna lista paginada com total

- Health probes:
  - `GET /api/v1/health/live`
  - `GET /api/v1/health/ready`

## Running locally

### Using Docker Compose

```
docker compose up --build
```

This spins up:
- `nexus-frontend` (React UI, exposed on http://localhost:8080)
- `nexus-backend` (FastAPI, exposed on http://localhost:8000)
- `nexus-worker` (Celery worker)
- `postgres` (PostgreSQL 16)
- `redis` (Redis 7, used for Celery broker/cache)

After the containers are healthy, apply the initial database schema:

```
docker compose exec nexus-backend alembic upgrade head
```

### Environment variables

Key settings (override via .env or environment variables):

- `DATABASE_URL`: URL do banco (ex.: `postgresql+asyncpg://nexus:nexus@localhost:5432/nexus`).
- `REDIS_URL`: Broker/resultado do Celery. Configure redis ou outro backend suportado.
- `UPLOADS_DIR`: Diretório base para os arquivos persistidos (padrão `storage/uploads`).
- `MAX_UPLOAD_FILES`: Limite de arquivos por auditoria (padrão 25).
- `MAX_UPLOAD_FILE_BYTES`: Limite em bytes por arquivo (padrão 25 MB).
- `MAX_UPLOAD_JOB_BYTES`: Limite total em bytes por auditoria (padrão 100 MB).
- `ALLOWED_UPLOAD_EXTENSIONS`: Lista de extensões aceitas (ex.: `xml,csv,xlsx,pdf,png,jpg`).
- `ENABLE_DOCS`: Habilita Swagger/Redoc em ambientes de desenvolvimento.
- `ENVIRONMENT`: Define `development`, `test` ou `production`.

### Local development without containers

1. Create a virtualenv and install dependencies:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. Export environment variables (see `.env.example`) and ensure PostgreSQL/Redis are running.
3. Run the API:
   ```bash
   uvicorn app.main:app --reload
   ```
4. Run the Celery worker:
   ```bash
   celery -A app.workers.celery_app.celery_app worker --loglevel=info
   ```

## Next steps

- Add authenticated API endpoints for creating and tracking audit jobs.
- Wire the Celery pipeline to persist job state and stream updates to the frontend.
- Expand Alembic migrations with domain tables (documents, reconciliations, users).
- Instrument the service with OpenTelemetry and Prometheus exporters.

## Tests

```bash
pip install -r requirements-dev.txt
pytest
```
