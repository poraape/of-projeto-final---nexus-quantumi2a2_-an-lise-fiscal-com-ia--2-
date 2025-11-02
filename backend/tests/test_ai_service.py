import pytest
import json
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException

from app.services import ai_service
from app.schemas.ai_schemas import ExtractionResult

# Marca todos os testes neste arquivo como assíncronos para o pytest-asyncio
pytestmark = pytest.mark.asyncio


@pytest.fixture
def mock_gemini_model(mocker: MagicMock) -> MagicMock:
    """
    Fixture que mocka a classe GenerativeModel do SDK do Google Gemini.
    Isso nos permite controlar o que o modelo de IA retorna durante os testes,
    sem fazer chamadas de rede reais.
    """
    mock_model = MagicMock()
    # generate_content_async é um método assíncrono, então usamos AsyncMock para seu retorno
    mock_model.generate_content_async = AsyncMock()

    # Patch no local onde 'genai' é usado (dentro do ai_service)
    mock_generative_model_class = mocker.patch('app.services.ai_service.genai.GenerativeModel')
    mock_generative_model_class.return_value = mock_model
    return mock_model


async def test_extract_structured_data_from_text_success(mock_gemini_model: MagicMock):
    """
    Testa o caminho feliz: a API do Gemini retorna um JSON válido e o serviço
    o converte para o schema ExtractionResult com sucesso.
    """
    # Arrange: Prepara o mock da resposta da IA
    sample_text = "Texto de uma nota fiscal para análise."
    mock_response_data = {
        "data_emissao": "25/12/2023",
        "valor_total_nfe": 123.45,
        "emitente_nome": "Empresa Exemplo LTDA",
        "emitente_cnpj": "12.345.678/0001-99",
        "items": [
            {"produto_nome": "Produto A", "produto_valor_total": 100.00},
            {"produto_nome": "Produto B", "produto_valor_total": 23.45},
        ]
    }
    # O SDK do Gemini retorna um objeto com um atributo 'text' contendo o JSON
    mock_gemini_model.generate_content_async.return_value = MagicMock(text=json.dumps(mock_response_data))

    # Act: Executa a função a ser testada
    result = await ai_service.extract_structured_data_from_text(sample_text)

    # Assert: Verifica se o resultado está correto
    assert isinstance(result, ExtractionResult)
    assert result.valor_total_nfe == 123.45
    assert result.emitente_nome == "Empresa Exemplo LTDA"
    assert len(result.items) == 2
    assert result.items[0].produto_nome == "Produto A"
    mock_gemini_model.generate_content_async.assert_awaited_once()


async def test_extract_structured_data_from_text_api_failure(mock_gemini_model: MagicMock):
    """
    Testa o cenário de falha: a chamada para a API do Gemini levanta uma exceção.
    O serviço deve capturar e levantar uma HTTPException com status 503.
    """
    # Arrange: Configura o mock para levantar uma exceção
    mock_gemini_model.generate_content_async.side_effect = Exception("Erro de conexão com a API")

    # Act & Assert: Verifica se a exceção correta é levantada
    with pytest.raises(HTTPException) as exc_info:
        await ai_service.extract_structured_data_from_text("qualquer texto")

    assert exc_info.value.status_code == 503
    assert "AI service failed" in exc_info.value.detail


async def test_extract_structured_data_from_text_invalid_json_response(mock_gemini_model: MagicMock):
    """
    Testa o cenário de resposta inválida: a API do Gemini retorna um texto que não é um JSON válido.
    O serviço deve falhar ao fazer o parse e levantar uma HTTPException 503.
    """
    # Arrange: Configura o mock para retornar uma string JSON malformada
    mock_gemini_model.generate_content_async.return_value = MagicMock(text="{'json_invalido': True,}")

    # Act & Assert
    with pytest.raises(HTTPException) as exc_info:
        await ai_service.extract_structured_data_from_text("qualquer texto")

    assert exc_info.value.status_code == 503
