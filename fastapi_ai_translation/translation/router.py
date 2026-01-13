"""Translation API: local transformers inference with in-memory cache."""

import logging
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from .client import TranslationClient
from .adapter import OllamaAdapter
from .openai_adapter import OpenAIAdapter
from .cache import TranslationCache

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory cache (TTL 5 minutes)
cache = TranslationCache(ttl_seconds=300)

try:
    engine = os.getenv("AI_ENGINE", "ollama") # Default to Ollama now
    if engine == "openai":
         logger.info("Initializing OpenAI Adapter...")
         client = OpenAIAdapter()
    elif engine == "ollama":
        logger.info("Initializing Ollama Adapter...")
        client = OllamaAdapter()
    else:
        logger.info("Initializing NLLB Client...")
        client = TranslationClient()
except Exception as e:
    logger.error(f"TranslationClient init failed (engine={os.getenv('AI_ENGINE')}): {e}", exc_info=True)
    client = None


class TranslateRequest(BaseModel):
    text: str
    source_lang: str = "kor_Hang"
    target_lang: str = "eng_Latn"


@router.post("/translate")
def translate(req: TranslateRequest):
    """
    POST /api/ai/translate
    Request body:
    {
        "text": "string",
        "source_lang": "kor_Hang",
        "target_lang": "eng_Latn"
    }
    """
    if client is None:
        raise HTTPException(status_code=500, detail="Translation client not initialized (check HF_MODEL).")

    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    cached = cache.get(text, req.source_lang, req.target_lang)
    if cached:
        translated_text, provider = cached
        return {"translated_text": translated_text, "cached": True, "provider": provider}

    try:
        translated = client.translate(text, req.source_lang, req.target_lang)
        cache.set(text, req.source_lang, req.target_lang, translated, provider="local-transformers")
        return {"translated_text": translated, "cached": False, "provider": "local-transformers"}
    except ValueError as e:
        logger.warning("Translation validation error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Local translation failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Translation failed: {e}")


class TranslateBatchRequest(BaseModel):
    texts: list[str]
    source_lang: str = "kor_Hang"
    target_lang: str = "eng_Latn"


@router.post("/translate/batch")
def translate_batch(req: TranslateBatchRequest):
    """
    POST /api/ai/translate/batch
    Request body:
    {
        "texts": ["string1", "string2"],
        "source_lang": "kor_Hang",
        "target_lang": "eng_Latn"
    }
    """
    if client is None:
        raise HTTPException(status_code=500, detail="Translation client not initialized.")
    
    if not req.texts:
        return {"translations": [], "provider": "local-transformers"}

    # Filter out empty strings to save compute, but maintain order?
    # For simplicity, we just pass everything to the client, let it handle empty checks if needed,
    # but client.translate_batch might error on empty. 
    # Let's simple pass-through. The client handles empty lists, but maybe not empty in list for some tokenizers.
    
    try:
        translated_list = client.translate_batch(req.texts, req.source_lang, req.target_lang)
        return {"translations": translated_list, "provider": "local-transformers-batch"}
    except ValueError as e:
        logger.warning("Batch translation validation error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Batch translation failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Batch translation failed: {e}")
