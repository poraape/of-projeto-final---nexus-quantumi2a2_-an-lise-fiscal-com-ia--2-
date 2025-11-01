# Nexus QuantumI2A2 — Auditoria Técnica Arquitetural

## 1. Sumário executivo
- O repositório atual contém **apenas uma SPA React com lógica de negócio executada no Web Worker**; não existe backend funcional apesar de haver diretórios `backend/`, `nginx/` e `docker-compose.yml` sugerindo o contrário.
- **Todos os objetivos estabelecidos (p95 ≤ 250 ms, erro ≤ 0,5%, >99,9% uptime, contratos versionados, observabilidade, CI/CD completo)** estão inviáveis no estado atual porque:
  - Não há APIs reais, persistência, autenticação/autorização, filas ou integração com sistemas externos.
  - O processamento pesado (OCR, classificação, auditoria, reconciliação) é feito no navegador, expondo dados sensíveis e a chave do Google Gemini diretamente ao cliente.
  - Não existem métricas, logs estruturados, tracing, testes significativos, pipeline de entrega para backend nem infraestrutura como código.
- A ausência de backend impede: controle de latência, escalabilidade, segurança, idempotência, versionamento de contratos e consistência dos dados.
- Recomendamos **replataformar o backend com FastAPI + PostgreSQL + Redis + Celery**, expor APIs RESTful documentadas (OpenAPI v1/v2) e mover toda a IA/ETL para servidores controlados.
- Devem ser estabelecidos **pipelines CI/CD independentes (frontend, backend, infra)**, com testes unitários/integrados/contrato, scanners SAST/DAST, observabilidade (OpenTelemetry), runbooks e feature flags.

## 2. Metodologia de auditoria
1. Varredura da árvore do repositório (`Get-ChildItem`, `Format-Hex`, leitura de fontes TS/TSX/Python).
2. Revisão de `README`, `package.json`, `tsconfig`, `CI pipeline`, `worker.ts`, `services/`, `utils/`.
3. Inspeção do diretório `backend/` (arquivos vazios/corrompidos/placeholder).
4. Análise dos fluxos críticos (pipeline de auditoria, chat IA, reconciliação, uploads).
5. Avaliação de segurança, observabilidade, deployment e qualidade.
6. Consolidação em matriz de riscos, objetivos vs. realidade e plano de remediação.

## 3. Radiografia do estado atual
### 3.1 Frontend (React + Vite)
- SPA (`App.tsx`) orquestra upload, pipeline, dashboards e chat; hooks em `hooks/useAgentOrchestrator.ts`.
- Serviços (`services/geminiService.ts`, `services/apiClient.ts`) gerenciam Web Worker e chamadas diretas ao SDK `@google/genai`.
- `worker.ts` executa todo fluxo (OCR, auditoria, classificação, reconciliação, interação com IA) no cliente, sem comunicação com servidor.
- Testes unitários: apenas `components/ChatPanel.test.tsx`; cobertura mínima, sem vitest config dedicado.
- Tailwind referenciado via classes utilitárias, mas sem `tailwind.config.js` nem pipeline de build CSS.

### 3.2 Backend
- Diretório `backend/` contém arquivos vazios ou com texto placeholder (“full contents of…”); `main.py` possui bytes binários inválidos. Não há código executável.
- `requirements.txt` inexistente de fato; `docker-compose.yml` sobe somente o frontend.
- Ausência total de APIs, modelos de dados, migrações, ou configuração de mensageria.

### 3.3 Infraestrutura / CI-CD
- `.github/workflows/ci.yml` executa `npm ci`, `npm test`, `npm run build` para o frontend somente.
- Sem pipelines para backend, infraestrutura, segurança ou deploy.
- Não há `Dockerfile`, `Terraform/Ansible` ou scripts de provisionamento apesar de README afirmar o contrário.
- Variáveis sensíveis (`GEMINI_API_KEY`) armazenadas em `.env.local` e expostas no cliente.

## 4. Gaps frente aos objetivos
| Objetivo | Situação atual | Lacuna principal |
| --- | --- | --- |
| p95 ≤ 250 ms | Inatingível; pipeline roda no navegador com OCR/LLM em JS, sem controle de hardware | Processamento deve ser movido para backend com filas, caching e precomputação |
| Erro ≤ 0,5% | Sem métricas ou validações server-side | Necessário monitorar SLA por operação, validação, retries, DLQ |
| Throughput escalável | Limitado ao browser; não há horizontalização | Requer serviços stateless, filas e auto scaling |
| Contratos API versionados | Não existem APIs | Definir OpenAPI v1/v2, versionamento semântico, testes de contrato |
| Persistência resiliente | Nenhum banco configurado | Modelar schema relacional, migrações, seeds controlados |
| Segurança (authn/z, secrets) | Chave da IA exposta, sem auth | Introduzir OAuth2/OIDC, RBAC, Secret Manager/Vault, TLS mútuo |
| Observabilidade completa | Logger client-side apenas | Implementar OpenTelemetry (traces, métricas, logs estruturados) |
| CI/CD confiável | Pipeline parcial focado em frontend | Implementar pipelines multi-stage, quality gates, deploy automatizado |
| Compatibilidade UI | Mantida | Deve ser mantida via BFF/feature flags |

## 5. Matriz de riscos (RAG)
| ID | Risco | Impacto | Probabilidade | Severidade | Mitigação recomendada |
| --- | --- | --- | --- | --- | --- |
| R1 | Processamento local expõe dados fiscais e chave Gemini | Alto | Alto | **Crítico** | Migrar pipeline para backend; usar segredo em vault; isolar em VPC |
| R2 | Ausência de backend impede SLA p95/uptime | Alto | Certo | **Crítico** | Construir APIs FastAPI + Worker Celery com autoscaling |
| R3 | Sem persistência nem histórico auditável | Alto | Alto | **Crítico** | Projetar PostgreSQL com migrações (Alembic), FKs, índice |
| R4 | Falta de observabilidade/alertas | Alto | Alto | **Crítico** | OpenTelemetry, Prometheus/Grafana, alertas p95/p99, erros, filas |
| R5 | CI/CD incompleto (sem testes/qualidade) | Médio | Alto | **Alto** | Pipelines separados, testes multi-nível, SAST/DAST |
| R6 | Sem resiliência (retries, DLQ, circuit breaker) | Médio | Médio | **Alto** | Implementar retries idempotentes, backoff exponencial, DLQ em Redis/Cloud queue |
| R7 | Contratos não definidos → clientes quebram | Alto | Médio | **Alto** | Definir OpenAPI versionado, gateway com contrato e testes |
| R8 | Falta de compliance LGPD (dados sensíveis no client) | Alto | Alto | **Crítico** | Processar dados no servidor, anonimizar, políticas de retenção |
| R9 | Sem runbooks / rollback testado | Médio | Alto | **Alto** | Criar runbooks (ver docs/runbooks), validar rollback via blue/green |
| R10 | Sem gerenciamento de feature flag | Médio | Médio | **Médio** | Introduzir LaunchDarkly/ConfigCat ou toggles customizados no backend |

## 6. Arquitetura alvo recomendada
### 6.1 Macrovisão
1. **Frontend (React)**: permanece, consome APIs versionadas `api.nexus.com/v1`. Usa BFF para agregação e caching. Feature flags e fallback para manter UI estável.
2. **BFF (Node.js ou FastAPI)**: orquestra chamadas de microsserviços, aplica caching HTTP (ETag), rate limiting e autenticação centralizada.
3. **Serviço de Ingestão & OCR (FastAPI + Celery workers)**: recebe uploads, valida, envia para fila (Redis/RabbitMQ), executa OCR/parse no worker.
4. **Serviço de Auditoria Fiscal**: processa regras determinísticas, cross-validation, grava resultados no PostgreSQL.
5. **Serviço de IA (FastAPI)**: encapsula chamadas ao Gemini; tokens armazenados em Secret Manager; responses serializados via protobuf/msgpack.
6. **Banco de dados**: PostgreSQL com schema normalizado (notas, itens, auditorias, reconciliações, usuários). Migrations Alembic; seeds idempotentes.
7. **Mensageria/Cache**: Redis para filas Celery, caching de sessões e rate limiting. Dead-letter queue para falhas.
8. **Observabilidade**: OpenTelemetry Collector → Prometheus/Grafana (métricas), Loki/ELK (logs), Tempo/Jaeger (traces). Correlation ID propagado via headers.
9. **CI/CD**: GitHub Actions multi-pipeline (lint/test/build → container build → deploy). Deploy blue/green em Kubernetes/Cloud Run. Terraform para IaC.

### 6.2 Contratos e padrões
- **OpenAPI v1** (operações atuais), **OpenAPI v2** (futuras extensões). Documentar esquemas JSON; gerar clients automáticos.
- **Idempotência** via cabeçalho `Idempotency-Key` nas operações POST/PUT.
- **Rate limiting** (ex.: 100 req/min por tenant) + `Retry-After`.
- **CORS** restrito a domínios confiáveis.
- **Authenticação**: OAuth2/OIDC (Keycloak/Auth0). Refresh token + access token JWT assinado (RS256), claims customizadas para RBAC.
- **Autorização**: RBAC (Administrador Financeiro, Auditor, Visualizador). Escopos aplicados no gateway/BFF.
- **Serialização**: REST JSON padrão; streaming NDJSON para grandes volumes; protobuf/msgpack interno entre serviços.

## 7. Plano de implementação faseado
| Fase | Horizonte | Entregas chave |
| --- | --- | --- |
| 0 — Hardening imediato | 1-2 semanas | Remover chave Gemini do frontend; bloquear upload de dados reais; criar landing de indisponibilidade controlada |
| 1 — Fundação backend | 4-6 semanas | Implementar FastAPI + PostgreSQL + Redis; endpoints v1 (upload, auditoria async, consultas); migrations e seeds; testes unitários/integrados; CI/CD backend |
| 2 — Observabilidade & Segurança | +3 semanas | OpenTelemetry full stack, dashboards, alertas; OAuth2/OIDC; rate limiting/CORS; secrets em vault |
| 3 — Performance & Resiliência | +3 semanas | Cache multi-camada, prefetch de relatórios, filas DLQ, circuit breaker (Tenacity/Resilience4j), tuning p95 |
| 4 — QA e Confiabilidade | +2 semanas | Testes E2E (Playwright/Cypress), testes de contrato (schemathesis), carga (k6), caos engineering básico, runbooks validados |
| 5 — Deploy escalável | +2 semanas | Docker multi-stage, Terraform (GKE/EKS/AKS), blue-green/canary, rollback automatizado, compliance LGPD |

## 8. Métricas e SLOs propostos
- **Latência**: p50 ≤ 120 ms, p95 ≤ 250 ms, p99 ≤ 400 ms para operações críticas (upload init, auditoria status, consulta relatório).
- **Taxa de erro**: ≤ 0,5% (HTTP 5xx + falhas de job). Monitorar `audit_job_failure_rate`, `ocr_retry_count`.
- **Throughput**: dimensionar 100 jobs simultâneos; monitorar `queue_depth`, `worker_utilization`.
- **Disponibilidade**: SLO 99,9%/30 dias; SLA 99,5%. Alertas se `error_budget_consumption > 25%`.
- **Segurança**: 0 vulnerabilidades críticas/altas em SAST/DAST; rotação de segredos ≤ 90 dias; MFA obrigatório.
- **Observabilidade**: cobertura de tracing ≥ 95% das rotas críticas; logs estruturados JSON com campo `correlation_id`.

## 9. Próximas ações imediatas
1. Comunicar stakeholders sobre inexistência de backend e risco de exposição de dados.
2. Congelar uploads de documentos reais até migração para backend seguro.
3. Criar task force para fase 1 (backend foundation) com squads multidisciplinares.
4. Validar backlog priorizado (ver `docs/backlog.md`) e ADRs (`docs/adr/`).
5. Configurar repositório `docs/` como fonte única de documentação; atualizar a cada iteração.
6. [x] Fundamentos iniciais do backend levantados
7. [x] Persistência server-side inicial dos uploads concluída (armazenamento em disco versionado, idempotência e payload para o worker).
8. [x] Painel MVP no frontend roteando uploads para FastAPI e exibindo jobs persistidos.
9. [ ] Expandir dashboard principal e substituir Web Worker por backend com SSE e resultados completos.
8. [ ] Evoluir validações avançadas (antivírus, quotas) e políticas de retenção/expurgo automatizado.

---

**Referências complementares**
- `docs/c4-architecture.md` — visão C4 atualizada.
- `docs/adr/` — decisões arquiteturais aprovadas.
- `docs/runbooks/` — procedimentos de incidente e rollback.
- `docs/release-checklist.md` — checklist de release.
- `docs/backlog.md` — épicos, estórias e métricas associadas.
