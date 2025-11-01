# Nexus QuantumI2A2: Análise Fiscal com IA (Full-Stack)

**Nexus QuantumI2A2** é uma plataforma de análise fiscal interativa que processa dados de Notas Fiscais Eletrônicas (NFe) e gera insights acionáveis através de um sistema de IA que simula múltiplos agentes especializados.

Esta aplicação evoluiu para uma **arquitetura full-stack**, onde um frontend em React altamente responsivo se comunica com um backend robusto em FastAPI (Python) para realizar o processamento pesado de dados e as interações com a IA.

---

## ✨ Funcionalidades Principais

*   **Pipeline Multiagente no Backend:** Uma cadeia de agentes especializados (Importação/OCR, Auditor, Classificador, Agente de Inteligência, Contador) processa os arquivos em etapas, de forma assíncrona, no servidor.
*   **Upload Flexível de Arquivos:** Suporte para múltiplos formatos, incluindo `XML`, `CSV`, `XLSX`, `PDF`, imagens (`PNG`, `JPG`) e arquivos `.ZIP` contendo múltiplos documentos.
*   **Análise Fiscal Aprofundada por IA:** Geração de um relatório detalhado com:
    *   **Resumo Executivo e Recomendações Estratégicas** gerados por IA.
    *   **Detecção de Anomalias por IA** que vai além de regras fixas.
    *   **Validação Cruzada (Cross-Validation)** entre documentos para encontrar discrepâncias sutis.
*   **Busca Inteligente (Smart Search):** Interaja com seus dados através de perguntas em linguagem natural diretamente no dashboard.
*   **Chat Interativo com IA:** Um assistente de IA, contextualizado com os dados do relatório, permite explorar os resultados e gera visualizações de dados sob demanda.
*   **Dashboards Dinâmicos:** Painéis interativos com KPIs, gráficos e filtros para uma visão aprofundada dos dados fiscais.
*   **Exportação de Relatórios:** Exporte a análise completa ou as conversas do chat para formatos como `PDF`, `DOCX`, `HTML` e `Markdown`.

---

## 🏗️ Arquitetura: Full-Stack (React + FastAPI)

A aplicação é dividida em dois componentes principais que operam de forma independente e se comunicam via APIs.

### Frontend (React/TypeScript)

O frontend é uma Single Page Application (SPA) construída com React e TypeScript.
*   **Responsabilidades:** Gerenciar a interface do usuário, o estado da UI, e a comunicação em tempo real (via WebSockets/HTTP) com o backend.
*   **Tecnologias:** React, TypeScript, TailwindCSS.

### Backend (FastAPI/Python)

O backend é construído com FastAPI, aproveitando o ecossistema Python para análise de dados e performance.
*   **Responsabilidades:** Orquestrar o pipeline de análise, processar arquivos, gerenciar a persistência de dados (banco de dados, cache), e interagir com a API do Google Gemini.
*   **Tecnologias:** FastAPI, Uvicorn, Python-JOSE (para JWT).

---

## 🐳 Docker & Deployment

Esta aplicação está totalmente conteinerizada para garantir consistência entre ambientes de desenvolvimento e produção.

### Executando com Docker Compose

A maneira mais simples de executar a aplicação localmente é usando o Docker Compose.

1.  **Pré-requisitos:** Docker e Docker Compose instalados.
2.  **Construa e inicie o container:**
    ```bash
    docker-compose up --build
    ```
3.  Acesse a aplicação em `http://localhost:8080`.

### Construção Manual do Docker
Se preferir construir a imagem manualmente:
```bash
docker build -t nexus-quantum-frontend .
docker run -p 8080:80 nexus-quantum-frontend
```

### 🚀 Pipeline de CI/CD

O projeto inclui um pipeline de Integração Contínua configurado em `.github/workflows/ci.yml`. Este workflow é acionado a cada `push` e `pull request` e executa as seguintes verificações de qualidade:
1.  **Instalação de Dependências:** Garante que o projeto não tenha dependências quebradas.
2.  **Testes Unitários:** Executa todos os testes (`*.test.tsx`) para validar a funcionalidade dos componentes.
3.  **Build de Produção:** Compila a aplicação para garantir que não há erros de tipagem ou sintaxe.

### 📈 Escalabilidade Futura

A conteinerização implementada é o primeiro passo para uma arquitetura de microserviços escalável. O `Dockerfile` e a configuração do Nginx são "production-ready". Quando a lógica de negócios atualmente no Web Worker for migrada para um serviço de backend (conforme o plano de refatoração), esse serviço pode ser conteinerizado de forma similar e orquestrado via Kubernetes ou implantado em plataformas serverless como Google Cloud Run, permitindo escalar horizontalmente o poder de processamento conforme a demanda.

---

## 🚀 Execução do Projeto

### No AI Studio
1.  **Configure a Chave de API:** Certifique-se de que sua chave de API do Google Gemini está configurada corretamente nas variáveis de ambiente do projeto.
2.  **Execute o Frontend:** Clique no botão "Run" ou "Executar".
3.  Uma nova aba será aberta com a aplicação em funcionamento. Como não há backend, ela está pronta para uso imediato.

### Localmente (Sem Docker)
1.  **Clone o repositório.**
2.  **Configure as Variáveis de Ambiente:**
    ```sh
    # .env
    VITE_GOOGLE_API_KEY=SUA_CHAVE_DE_API_AQUI
    VITE_API_BASE_URL=http://localhost:8000/api/v1
    # Opcional: habilita o pipeline antigo em Web Worker
    VITE_USE_LEGACY_WORKER=false
    ```
3.  **Inicie o Servidor de Desenvolvimento:**

   ```bash
   # Instale as dependências
   npm install
   # Inicie o servidor
   npm run dev
   ```
4.  Acesse a URL fornecida (geralmente `http://localhost:5173`).

---

## 📁 Estrutura de Pastas

```
/
├── .github/workflows/  # Pipelines de CI/CD (GitHub Actions)
├── backend/            # Lógica do servidor FastAPI
├── nginx/              # Configuração do Nginx para o container
├── src/
│   ├── agents/         # Lógica de negócios de cada agente IA
│   ├── components/     # Componentes React reutilizáveis
│   ├── hooks/          # Hooks React customizados (ex: useAgentOrchestrator)
│   ├── services/       # Serviços (chamadas à API Gemini, logger)
│   ├── utils/          # Funções utilitárias (parsers, exportação, regras)
│   ├── App.tsx         # Componente principal da aplicação
│   └── types.ts        # Definições de tipos TypeScript
├── .dockerignore       # Arquivos a serem ignorados pelo Docker
├── docker-compose.yml  # Orquestração do container para desenvolvimento
├── Dockerfile          # Definição do container de produção
├── index.html          # Arquivo HTML principal
└── README.md           # Este arquivo
```
