# Runbook — Falha no Pipeline de Auditoria

- **Objetivo**: Restaurar execução do pipeline (ingestão → OCR → auditoria → IA) quando jobs falharem ou ficarem presos.
- **Escopo**: Serviços `ingestion-service`, `audit-service`, `ai-service`, `celery-workers`, Redis, PostgreSQL.
- **KPIs monitorados**: `audit_job_failure_rate`, `queue_depth`, `worker_heartbeat`, `audit_duration_seconds`, `gemini_error_rate`.

## 1. Detecção
1. Alertas automáticos via Prometheus:
   - `audit_job_failure_rate > 0.5%` em 5 min.
   - `queue_depth > 100` por 10 min.
   - `worker_heartbeat_missed > 3`.
2. Alertas via Loki (logs): erro contendo `PIPELINE_ERROR`, `celery.worker.hang`, `gemini quota`.
3. Notificação manual: suporte reporta atraso > 5 min na UI (progress bar travada).

## 2. Diagnóstico rápido
1. Validar saúde dos serviços:
   - `kubectl get pods -l app=audit-service` (status).
   - `celery -A audit.tasks inspect stats`.
   - `redis-cli ping`, `redis-cli llen audit:queue`.
2. Conferir logs filtrados por `correlation_id` do job (`kubectl logs` ou Loki).
3. Verificar limites/quotas da IA (`gemini_quota_remaining`).

## 3. Resolução
| Sintoma | Ação imediata |
| --- | --- |
| Workers parados | `kubectl rollout restart deployment audit-workers` ou `celery multi restart`. Verificar secret/credenciais. |
| Fila saturada | Escalar workers (`kubectl scale deployment audit-workers --replicas=N`). Repriorizar jobs críticos. |
| Falha no OCR | Enviar job para DLQ (`redis-cli rpoplpush audit:queue audit:dlq`). Abrir bug no serviço OCR. |
| Erro no Gemini (429) | Ativar fallback IA (feature flag `ai_fallback_enabled`) e reprocessar via Celery `retry`. Notificar squad IA. |
| Timeout em DB | Verificar conexão (`pg_stat_activity`), aplicar throttling no BFF, considerar vertical scaling. |

## 4. Recuperação
1. Reprocessar jobs em DLQ (`celery -A audit.tasks control.retry queue=audit:dlq`).
2. Validar que métricas retornaram a níveis normais (latência p95, queue depth).
3. Registrar incidente no postmortem template (`docs/runbooks/postmortem-template.md` se existir).

## 5. Comunicação
- Atualizar status page interna a cada 15 min.
- Enviar resumo final com: causa raiz, jobs impactados, tempo de indisponibilidade, ações corretivas.

## 6. Prevenção
- Revisar alertas: thresholds adequados? tempos?
- Adicionar testes de caos (simular indisponibilidade do Gemini).
- Priorizar melhorias listadas no backlog (ex.: auto-scaling baseado em fila).
