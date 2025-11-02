from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.api.v1.endpoints import ai
from app.config import settings

app = FastAPI(
    title="Nexus QuantumI2A2 API",
    description="Backend services for the Nexus QuantumI2A2 fiscal analysis platform.",
    version="1.0.0",
    # Desativa a documentação em produção, conforme a variável de ambiente
    docs_url="/api/docs" if settings.ENABLE_DOCS else None,
    redoc_url="/api/redoc" if settings.ENABLE_DOCS else None,
)

# Configuração de CORS (Cross-Origin Resource Sharing)
# Permite que o frontend (em outro domínio/porta) acesse a API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, restrinja para o domínio do seu frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclui os routers da API
app.include_router(ai.router, prefix="/api/v1/ai", tags=["AI Services"])


@app.get("/api/v1/health/live", tags=["Health"])
def health_check():
    """Verifica se a API está online."""
    return {"status": "ok"}