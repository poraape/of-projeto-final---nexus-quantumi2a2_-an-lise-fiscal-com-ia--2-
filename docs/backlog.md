# Backlog Prioritário — Nexus QuantumI2A2

> Estruturado em épicos → estórias. Cada estória contém critérios de aceite mensuráveis e métricas alvo. Timebox sugerida para primeiras fases (ver `docs/audit-report.md` §7).

## Épico E1 — Fundação do Backend Seguro
- **Meta**: Entregar APIs REST v1, persistência confiável e processamento assíncrono.
- **KPIs**: Tempo de ingestão p95 ≤ 200 ms (request), conclusão de auditoria ≤ 3 min p95, taxa erro jobs ≤ 0,5%.

### Estória E1-S1 — Provisionar Infraestrutura Base
- **Descrição**: Configurar FastAPI, Celery, PostgreSQL, Redis (DEV/QA).
- **Status**: Em progresso — esqueleto FastAPI, health checks, Alembic inicial e `docker-compose` com Postgres/Redis já disponíveis.
- **Próximos passos**: instrumentar OpenTelemetry (export console) e configurar pipeline CI/CD backend.
- **Critérios**:
  - [ ] `docker-compose` com serviços backend operando localmente.
  - [ ] Healthchecks (`/healthz`, `/readiness`) respondem em <50 ms.
  - [ ] Código instrumentado com OpenTelemetry (export console em DEV).
  - [ ] Pipeline GitHub Actions backend (lint, testes, build) em execução.
- **Métricas**: Cobertura unitária ≥ 70%; tempo CI ≤ 10 min.

### Estória E1-S2 — Implementar Upload Assíncrono
- **Descrição**: API `POST /v1/audits` aceita arquivos, valida e enfileira job.
- **Status**: Em progresso — POST /api/v1/audits disponível com idempotência e enfileiramento Celery; falta persistir arquivos e validar payloads complexos.
- **Critérios**:
  - [ ] Suporta `multipart/form-data`, `Idempotency-Key`.
  - [ ] Retorna `202 Accepted` com `job_id`.
  - [ ] Eventos publicados no Redis; job executado por worker.
  - [ ] Testes contrato (schemathesis) cobrindo erros (413, 415, 422).
- **Métricas**: p95 request ≤ 250 ms; taxa de retry < 2%.

### Estória E1-S3 — Persistir Resultado da Auditoria
- **Descrição**: Gravar relatórios em PostgreSQL; disponibilizar `GET /v1/audits/{id}`.
- **Status**: Iniciado — tabela `audit_jobs` criada (SQLAlchemy + Alembic); endpoints de consulta ainda pendentes.
- **Critérios**:
  - [ ] Modelo normalizado (NF, itens, métricas, insights).
  - [ ] Migração Alembic com rollback testado.
  - [ ] Consulta protegida por OAuth2 (escopos).
  - [ ] Teste integrado compara dados importados vs resposta API.
- **Métricas**: Consulta p95 ≤ 180 ms; nenhum `SELECT` sem índice.

## Épico E2 — Observabilidade e Resiliência
- **Meta**: Garantir visibilidade ponta a ponta e tolerância a falhas controlada.
- **KPIs**: Cobertura de tracing ≥ 95%, tempo de detecção (MTTD) < 5 min.

### Estória E2-S1 — Instrumentação OpenTelemetry
- **Critérios**:
  - [ ] Tracing habilitado em BFF, serviços, workers, SPA.
  - [ ] Correlation ID propagado (`traceparent`).
  - [ ] Dashboards padrão (latência p50/p95, taxa erro, queue depth).
- **Métricas**: 100% das requisições críticas com span `http.server`.

### Estória E2-S2 — Implementar Circuit Breaker & Retries
- **Critérios**:
  - [ ] Bibliotecas (Tenacity/Resilience4j) wrap em chamadas IA, DB, fila.
  - [ ] Backoff exponencial configurável; DLQ habilitado.
  - [ ] Testes de caos simulando indisponibilidade IA validate fallback.
- **Métricas**: Nenhum job falho sem ao menos 3 tentativas controladas.

## Épico E3 — Segurança e Compliance
- **Meta**: Proteger dados fiscais e cumprir LGPD.
- **KPIs**: 0 vulnerabilidades críticas/altas, 100% tokens com MFA.

### Estória E3-S1 — Integrar OIDC/RBAC
- **Critérios**:
  - [ ] Fluxo login PKCE implementado no frontend (sem quebra UI).
  - [ ] BFF valida tokens e aplica RBAC (scopes).
  - [ ] Logs de auditoria (`login_success`, `login_failure`).
- **Métricas**: Testes automáticos cobrem 100% das rotas protegidas.

### Estória E3-S2 — Segredos e Gestão de Chaves
- **Critérios**:
  - [ ] Gemini/API keys em Secret Manager (não no repo).
  - [ ] Rotação automática ≤ 90 dias documentada.
  - [ ] Auditoria que detecta acesso inválido.
- **Métricas**: Falhas de rotação = 0.

## Épico E4 — Experiência do Usuário Estável
- **Meta**: Preservar UI atual, adicionar feature flags e performance.
- **KPIs**: Web Vitals (LCP < 2.5s, CLS < 0.1), nulidade de regressões UI.

### Estória E4-S1 — BFF/Frontend Integração v1
- **Status**: Em progresso — painel `BackendJobPanel` envia uploads para FastAPI e lista jobs; resta migrar Dashboard completo e SSE.
- **Critérios**:
  - [ ] SPA consome `GET /v1/audits/{id}` para dashboards.
  - [ ] Progress UI via WebSocket SSE do backend.
  - [ ] Feature flag `use_backend_pipeline` permite rollback para worker local (somente dev).
- **Métricas**: Medir tempo total pipeline (upload → relatório) com e sem cache.

### Estória E4-S2 — Caching e Paginação
- **Critérios**:
  - [ ] Endpoints retornam paginação (cursor) para documentos/insights.
  - [ ] Cache HTTP (ETag) no BFF para relatórios estáticos.
- **Métricas**: Redução ≥ 40% na latência de `GET /v1/audits/{id}` repetidos.

## Épico E5 — Qualidade Contínua e Automação
- **Meta**: Garantir regressões mínimas via testes e pipelines.
- **KPIs**: Cobertura unitária ≥ 80%, falhas em produção < 0,5% jobs.

### Estória E5-S1 — Pipeline CI/CD Multi-stage
- **Status**: Em progresso — pipeline backend (`backend-ci.yml`) executa pytest com uploads persistidos; próximos passos incluem linting/SAST e etapas de deploy.
- **Critérios**:
  - [ ] Workflows separados (frontend, backend, infra).
  - [ ] Stages: lint → testes → build → scan → deploy (blue/green).
  - [ ] Quality gates (cobertura, SAST, DAST) bloqueiam merges.
- **Métricas**: 100% PRs passam pipeline; tempo < 25 min.

### Estória E5-S2 — Automação de Testes de Carga
- **Critérios**:
  - [ ] Script k6 cobrindo upload, status polling, consulta relatório.
  - [ ] Execução automatizada em nightly build com comparação baseline.
  - [ ] Relatório arquivado (p95, erro, throughput).
- **Métricas**: Desvio p95 ≤ +10% vs baseline; throughput mínimo 50 jobs/min.

---

**Observações**:
- Cada estória deve ter DoD incluindo atualização de documentação (`docs/`), dashboards, runbooks e checklist de release.
- Priorizar épicos E1 → E2 → E3; E4/E5 em paralelo conforme capacidade.

