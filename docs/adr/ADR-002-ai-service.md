# ADR 002 — Serviço Dedicado para IA e Gestão de Prompts

- **Status**: Proposto (31/10/2025)
- **Contexto**: A SPA chama diretamente o SDK `@google/genai`, expondo a chave de API e deixando prompts/quotas sem governança. Precisamos de controle de custos, compliance e versionamento de prompts, além de observabilidade fine-grained.
- **Decisão**:
  - Criar **serviço de IA** (FastAPI) que receba requisições autenticadas do BFF, construa prompts seguros, e invoque o Google Gemini usando uma service account com segredos armazenados em vault.
  - Implementar **cache de respostas** (Redis) quando possível e mecanismos de **fallback** (respostas determinísticas) para indisponibilidade da IA.
  - Versionar prompts e esquemas de resposta (protobuf/msgpack) para manter compatibilidade.
  - Enriquecer telemetria (latência, tokens consumidos, taxa de erro) via OpenTelemetry.
- **Motivadores**:
  - Requisitos de segurança (LGPD) e sigilo: dados fiscais não podem sair do domínio controlado.
  - Facilidade para trocar modelo (Gemini → Vertex, OpenAI) sem alterar frontend.
  - Necessidade de rate limiting e circuito aberto/fechado (circuit breaker) independente.
- **Consequências**:
  - Overhead adicional (manter serviço e cache).
  - Requer definição clara de contratos e esquemas de dados.
  - Permite aplicar políticas de custo (limitar tokens por cliente) e auditoria.
- **Ações**:
  1. Definir schema de requests/responses e publicar em OpenAPI v1.
  2. Configurar segredos em Secret Manager; proibir chave da IA no cliente.
  3. Implementar logging estruturado + métricas (tokens, tempo, erro).
  4. Integrar com feature flags para ativar/desativar features IA dinamicamente.
