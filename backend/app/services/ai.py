from fastapi import APIRouter, status, Depends

from app.schemas.ai_schemas import AIAnalysisRequest, ExtractionResult
from app.services import ai_service
# from app.api.dependencies import get_current_user # Placeholder for future authentication

router = APIRouter()

@router.post(
    "/extract-text",
    response_model=ExtractionResult,
    status_code=status.HTTP_200_OK,
    summary="Extract Structured Data from Text",
    description="Receives a block of raw text and uses an AI model to extract structured fiscal data.",
    # dependencies=[Depends(get_current_user)] # Uncomment when auth is implemented
)
async def extract_text(
    request: AIAnalysisRequest,
):
    """
    Encapsulates the call to the Gemini API for secure text extraction.
    The frontend should call this endpoint instead of the Gemini SDK directly.
    """
    extracted_data = await ai_service.extract_structured_data_from_text(request.text)
    return extracted_data
