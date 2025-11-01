# ADR 001 — Replataforma do Backend para FastAPI/Celery

- **Status**: Proposto (31/10/2025)
- **Contexto**: O projeto atual executa todo processamento (OCR, auditoria, IA) no cliente via Web Worker. Não há backend funcional, impossibilitando SLAs de latência, segurança, persistência ou observabilidade. A meta é oferecer pipeline seguro, resiliente e escalável mantendo a UI existente.
- **Decisão**:
  - Adotar **FastAPI** como framework principal do backend, com **Uvicorn + Gunicorn** para servir APIs síncronas e assíncronas.
  - Introduzir **Celery** com **Redis** (ou RabbitMQ) para processamento assíncrono de auditorias, OCR, conciliações.
  - Centralizar persistência em **PostgreSQL** com **SQLAlchemy + Alembic** (migrações versionadas).
  - Estruturar serviços: `ingestion-service`, `audit-service`, `ai-service`, `reporting-service`, coordenados via BFF/API Gateway.
- **Motivadores**:
  - Necessidade de **idempotência**, **retries** e **backpressure** (via filas).
  - Separação de responsabilidades e escalabilidade horizontal (workers).
  - Ecosistema FastAPI oferece OpenAPI nativo, integração com pydantic, fácil instrumentação com OpenTelemetry.
  - Python já utilizado nos scripts existentes; facilita leverage de bibliotecas fiscais/IA.
- **Consequências**:
  - Aumenta complexidade operacional (deploy, monitoramento de workers).
  - Requer planejamento de custos (infra PaaS, mensageria).
  - Permite implementar requisitos de segurança, auditoria e métricas exigidos.
- **Ações**:
  1. Criar monorepo ou multi-repo com serviços isolados e camada BFF.
  2. Especificar OpenAPI v1 (upload, auditoria) e pipeline de testes.
  3. Provisionar ambientes (DEV/QA/PROD) com Terraform.
  4. Migrar lógica do `worker.ts` gradualmente para workers Celery.
