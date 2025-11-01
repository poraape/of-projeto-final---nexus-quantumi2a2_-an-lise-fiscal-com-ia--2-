# ADR 003 — Camada Unificada de Autenticação e Autorização (OAuth2/OIDC + RBAC)

- **Status**: Proposto (31/10/2025)
- **Contexto**: O sistema não implementa qualquer autenticação ou autorização. Os requisitos exigem controle de acesso (RBAC), auditoria, rate limiting e proteção dos dados fiscais. Também é necessário garantir compatibilidade futura com integrações externas.
- **Decisão**:
  - Adotar **OAuth2/OIDC** com um provedor externo (ex.: Keycloak, Auth0, Azure AD) para login, emissão de `access_token` (JWT RS256) e `refresh_token`.
  - Implementar **BFF/API Gateway** como enforcement point, validando tokens e injetando `X-User-Context`.
  - Definir **papéis**: `finance-admin`, `fiscal-analyst`, `auditor-external`, `viewer`. Mapear claims nos tokens.
  - Aplicar **políticas de autorização** no backend via decorators (FastAPI dependencies) e, quando necessário, ABAC com atributos complementares (ex.: tenant).
  - Armazenar segredos (client secrets, signing keys) em **Vault** com rotação automatizada.
- **Motivadores**:
  - Conformidade com LGPD (controle de acesso, rastreabilidade).
  - Possibilidade de auditoria e segregação de perfis (interno vs externo).
  - Suporte a MFA, políticas de senha, e integração com diretórios corporativos.
- **Consequências**:
  - Introduz dependência em IdP e necessidade de gerenciar tokens.
  - Exige atualização do frontend para fluxo PKCE, guarda silenciosa de tokens e refresh automático.
  - Habilita monitoramento de segurança (falhas de login, ataques).
- **Ações**:
  1. Selecionar IdP e configurar realms/clients.
  2. Implementar middleware no BFF para validação de tokens e mapping de claims.
  3. Criar testes de contrato e integração cobrindo rotas protegidas.
  4. Configurar monitoramento de segurança (falhas de autenticação, bloqueios, rotação).
