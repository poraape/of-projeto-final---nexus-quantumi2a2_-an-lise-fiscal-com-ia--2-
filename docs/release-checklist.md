# Checklist de Release — Nexus QuantumI2A2

> Utilizar para cada promoção de versão (DEV → QA → PROD). Marcar itens como concluídos em PR/Issue tracker.

## 1. Pré-release técnica
- [ ] Branch estabilizada (sem commits pendentes, CI verde).
- [ ] Versionamento atualizado (`CHANGELOG.md`, tags semânticas).
- [ ] ADRs relevantes aprovados e documentados.
- [ ] Feature flags configuradas (novas features off por padrão).
- [ ] Dependências revisadas (npm/pip audit sem vulnerabilidades críticas/altas).
- [ ] Migrações migradas em staging (`alembic upgrade head`) e rollback testado (`alembic downgrade`).

## 2. Qualidade
- [ ] **Testes unitários** (frontend + backend) 100% executados (`npm test`, `pytest`/`coverage`).
- [ ] **Testes de contrato** (schemathesis / Dredd) aprovados para APIs v1/v2.
- [ ] **Testes de integração** (pipeline e2e com dados sintéticos) concluídos.
- [ ] **Testes E2E UI** (Playwright/Cypress) executados contra ambiente QA.
- [ ] **Testes de carga/regressão** (k6/JMeter) >= baseline anterior; p95 ≤ 250 ms, erro ≤ 0,5%.
- [ ] **SAST** (Semgrep, Sonar) sem findings críticos/altos.
- [ ] **DAST** (OWASP ZAP) sem findings críticos/altos.
- [ ] **Security checks** (dependency review, secrets scanning) concluídos.

## 3. Observabilidade & Operação
- [ ] Dashboards atualizados (métricas novas documentadas).
- [ ] Alertas configurados/revisados (p95, erro, queue depth, quota IA).
- [ ] Runbooks atualizados (`docs/runbooks/`), time on-call alinhado.
- [ ] Post-deploy smoke automation preparada (job GitHub Actions ou Argo).
- [ ] Planos de rollback validados (ver `docs/runbooks/rollback-blue-green.md`).

## 4. Compliance & Dados
- [ ] Revisão de uso de dados sensíveis (LGPD): pseudonimização/anonimização aplicada.
- [ ] Retenção configurada (`data_retention_policy`), limpeza de dados temporários validada.
- [ ] Consentimentos de usuários armazenados (se aplicável).
- [ ] Auditoria habilitada (trails no PostgreSQL e logs imutáveis).

## 5. Aprovação & Comunicação
- [ ] Checklist assinado por: Engenheiro responsável, QA, Segurança, Produto.
- [ ] Janela de deploy reservada e comunicada.
- [ ] Plano de comunicação pós-release definido (release notes, status page).
- [ ] Monitoramento ativo agendado (responsáveis escalados).

## 6. Pós-release
- [ ] Smoke tests pós-deploy aprovados.
- [ ] Métricas chave monitoradas por 30 min (latência, erros, filas, custos IA).
- [ ] Registrar lições aprendidas e atualizar documentação.
