"""AI generation endpoints (server-side proxy to Google Generative AI)."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import google.generativeai as genai


class GenerateRequest(BaseModel):
    prompt: str
    model: str | None = "gemini-1.5-flash"
    temperature: float | None = 0.4


router = APIRouter(tags=["ai"])


@router.post("/ai/generate", response_model=dict)
async def generate(req: GenerateRequest) -> dict:
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Server AI key not configured")

    genai.configure(api_key=api_key)
    try:
        model = genai.GenerativeModel(req.model or "gemini-1.5-flash")
        resp = await model.generate_content_async(req.prompt, generation_config={"temperature": req.temperature})
        # Standardize minimal response
        text = getattr(resp, "text", None) or "".join(getattr(part, "text", "") for part in getattr(resp, "candidates", []) or [])
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI backend error: {e}")

