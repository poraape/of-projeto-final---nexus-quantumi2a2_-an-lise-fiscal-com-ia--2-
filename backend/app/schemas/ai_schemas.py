from pydantic import BaseModel, Field
from typing import List, Optional

# --- Request Schemas ---

class AIAnalysisRequest(BaseModel):
    """Request model for text analysis by the AI service."""
    text: str = Field(
        ...,
        min_length=20,
        title="Text for Analysis",
        description="The raw text extracted from a document (e.g., PDF, image) to be analyzed by the AI."
    )


# --- Response Schemas ---

class ExtractedItem(BaseModel):
    """Represents a single item extracted from a fiscal document."""
    produto_nome: str
    produto_ncm: Optional[str] = None
    produto_cfop: Optional[str] = None
    produto_qtd: Optional[float] = None
    produto_valor_unit: Optional[float] = None
    produto_valor_total: Optional[float] = None
    produto_valor_icms: Optional[float] = None
    produto_valor_pis: Optional[float] = None
    produto_valor_cofins: Optional[float] = None
    produto_valor_iss: Optional[float] = None


class ExtractionResult(BaseModel):
    """
    Represents the structured data extracted by the AI.
    Mirrors the `nlpExtractionSchema` from the original frontend agent.
    """
    data_emissao: Optional[str] = None
    valor_total_nfe: Optional[float] = None
    emitente_nome: Optional[str] = None
    emitente_cnpj: Optional[str] = None
    destinatario_nome: Optional[str] = None
    destinatario_cnpj: Optional[str] = None
    items: List[ExtractedItem] = []