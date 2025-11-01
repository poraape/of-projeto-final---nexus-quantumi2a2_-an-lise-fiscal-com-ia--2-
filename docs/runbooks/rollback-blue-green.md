# Runbook — Rollback Blue/Green Deployment

- **Objetivo**: Reverter rapidamente uma release problemática preservando a disponibilidade (>99,9%).
- **Contexto**: Deploys acontecem via GitHub Actions → ArgoCD (ou outro controlador) usando estratégia blue/green em Kubernetes/Cloud Run.

## Pré-requisitos
1. Versionamento semântico da aplicação (`frontend`, `bff`, `ingestion`, `audit`, `ai`).
2. Artefatos containerizados armazenados no registro (`registry/nexus/{service}:{tag}`).
3. ConfigMap/Secret versionados; feature flags controladas por LaunchDarkly/Config service.
4. Observabilidade ativa (dashboards p95, erros, queue depth, logs).

## Passo a passo de rollback
1. **Identificar release ruim**: usar tag da última implantação (`v2025.10.31-1`). Confirmar métricas degradadas.
2. **Verificar estado atual**:
   - `kubectl get svc -l component=nexus --show-labels` (qual versão está servindo tráfego?).
   - `argocd app get nexus-audit` (histórico).
3. **Executar rollback**:
   - Via ArgoCD: `argocd app rollback nexus-audit <revision>` (mesmo para frontend/BFF).
   - Alternativa manual: `kubectl patch svc nexus-audit --type='json' -p='[{"op":"replace","path":"/spec/selector/version","value":"v2025.10.24"}]'`.
4. **Validar saúde pós-rollback**:
   - Dashboards p95/p99 e taxa de erro em 5 min.
   - `kubectl get pods -l version=v2025.10.24`.
   - Tests smoke automatizados: `robot tests/smoke/rollback.robot`.
5. **Comunicar**:
   - Atualizar status page → "Rollback executado, monitoramento ativo."
   - Registrar no canal #deploys com referência ao incidente.

## Pós-rollback
1. Congelar releases até RCA ser concluída.
2. Coletar artefatos de debug (logs, traces) da release problemática.
3. Abrir tarefa no backlog para cobrir gaps que permitiram regressão (testes, feature flag, etc.).
4. Atualizar `docs/release-checklist.md` se nova verificação for necessária.

## Checklist rápido
- [ ] Rollback executado no serviço afetado (frontend? backend? ambos?).
- [ ] Tráfego roteado 100% para versão estável.
- [ ] Métricas estabilizadas.
- [ ] Comunicação realizada.
- [ ] RCA agendado (<48h).
