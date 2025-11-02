import google.generativeai as genai
import json
from fastapi import HTTPException, status

from app.config import settings
from app.schemas.ai_schemas import ExtractionResult

# Configure the Gemini client
genai.configure(api_key=settings.GOOGLE_API_KEY)


async def extract_structured_data_from_text(text: str) -> ExtractionResult:
    """
    Uses Google Gemini to extract structured fiscal data from a raw text block.

    Args:
        text: The raw text from a document.

    Returns:
        An ExtractionResult object with the parsed data.

    Raises:
        HTTPException: If the AI service fails or returns invalid data.
    """
    # Truncate text to avoid exceeding token limits, keeping the most relevant parts.
    truncated_text = text[:15000]

    # The schema is now defined by the Pydantic model `ExtractionResult`
    json_schema = ExtractionResult.model_json_schema()

    prompt = f"""
      You are a data extraction system (OCR/NLP) specialized in Brazilian fiscal documents.
      Analyze the following text and extract the structured information according to the provided JSON schema.
      - If a field is not found, omit it or use null.
      - Convert all monetary values to numbers (e.g., "1.234,56" becomes 1234.56).
      - If multiple items are found, list all of them in the 'items' array.
      - Ensure that any double quotes within text values (like 'produto_nome') are properly escaped.
      - The output MUST be a valid JSON object that conforms to the schema.

      JSON Schema:
      ---
      {json.dumps(json_schema, indent=2)}
      ---

      Text for analysis:
      ---
      {truncated_text}
      ---
    """

    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = await model.generate_content_async(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
            )
        )
        
        # The response is already a JSON string, parse it and validate with Pydantic
        return ExtractionResult.model_validate_json(response.text)

    except Exception as e:
        # Log the error properly in a real scenario (e.g., using a logger)
        print(f"AI service error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The AI service failed to process the request."
        )