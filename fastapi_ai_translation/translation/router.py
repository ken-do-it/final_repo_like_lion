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


def warmup_model():
    """
    모델 가중치를 메모리에 로드하고 추론 엔진을 예열하기 위해 더미 번역을 수행합니다.
    이 작업을 통해 첫 번째 사용자 요청이 느려지는 것을 방지할 수 있습니다.
    """
    if client:
        try:
            logger.info("🔥 Warming up AI Translation Model...")
            # Translate a simple "Hello" to force model loading
            client.translate("Hello", "eng_Latn", "kor_Hang")
            logger.info("✅ Model Warm-up Completed!")
        except Exception as e:
            logger.warning(f"⚠️ Model Warm-up Failed (Non-critical): {e}")


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
    
    print(f"DEBUG: translate_batch called with {len(req.texts)} texts. Client Type: {type(client)}", flush=True)

    try:
        translated_list = client.translate_batch(req.texts, req.source_lang, req.target_lang)
        print(f"DEBUG: Client returned: {translated_list}", flush=True)
        return {"translations": translated_list, "provider": "local-transformers-batch"}
    except ValueError as e:
        logger.warning("Batch translation validation error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Batch translation failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Batch translation failed: {e}")
