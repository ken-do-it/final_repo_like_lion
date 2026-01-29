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
    engine = os.getenv("AI_ENGINE", "ollama")  # Default to Ollama now
    if engine == "openai":
        logger.info("OpenAI \uC5B4\uB311\uD130 \uCD08\uAE30\uD654 \uC911...")
        client = OpenAIAdapter()
    elif engine == "ollama":
        logger.info("Ollama \uC5B4\uB311\uD130 \uCD08\uAE30\uD654 \uC911...")
        client = OllamaAdapter()
    else:
        logger.info("NLLB \uD074\uB77C\uC774\uC5B8\uD2B8 \uCD08\uAE30\uD654 \uC911...")
        client = TranslationClient()
except Exception as e:
    logger.error(f"TranslationClient init failed (engine={os.getenv('AI_ENGINE')}): {e}", exc_info=True)
    client = None


def warmup_model():
    """
    \uBAA8\uB378 \uAC00\uC911\uCE58\uB97C \uBA54\uBAA8\uB9AC\uC5D0 \uB85C\uB4DC\uD558\uACE0 \uCD94\uB860 \uC5D4\uC9C4\uC744 \uC608\uC5F4\uD558\uAE30 \uC704\uD574 \uB354\uBBF8 \uBC88\uC5ED\uC744 \uC218\uD589\uD569\uB2C8\uB2E4.
    \uC774 \uC791\uC5C5\uC744 \uD1B5\uD574 \uCCAB \uBC88\uC9F8 \uC0AC\uC6A9\uC790 \uC694\uCCAD\uC774 \uB290\uB824\uC9C0\uB294 \uAC83\uC744 \uBC29\uC9C0\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.
    \uC601\uBB38\uB2F5\uC774 \uAC00\uB9CC\uD788 \uC138\uD305\uB418\uC5B4 \uC788\uC5B4 \uCD08\uAE30 \uC751\uB2F5 \uC9C0\uC5F0\uC744 \uC904\uC77C \uC218 \uC788\uC2B5\uB2C8\uB2E4.
    """
    if client:
        try:
            logger.info("AI \uBC88\uC5ED \uBAA8\uB378 \uC6CC\uC5C5 \uC911...")
            # Translate a simple "Hello" to force model loading
            client.translate("Hello", "eng_Latn", "kor_Hang")
            logger.info("\uBAA8\uB378 \uC6CC\uC5C5 \uC644\uB8CC!")
        except Exception as e:
            logger.warning(f"Model warm-up failed (non-critical): {e}")

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
        raise HTTPException(status_code=500, detail="번역 클라이언트가 초기화되지 않았습니다. (HF_MODEL 확인)")

    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="텍스트가 필요합니다.")

    cached = cache.get(text, req.source_lang, req.target_lang)
    if cached:
        translated_text, provider = cached
        return {"translated_text": translated_text, "cached": True, "provider": provider}

    try:
        translated = client.translate(text, req.source_lang, req.target_lang)
        cache.set(text, req.source_lang, req.target_lang, translated, provider="local-transformers")
        return {"translated_text": translated, "cached": False, "provider": "local-transformers"}
    except ValueError as e:
        logger.warning("번역 검증 오류: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("로컬 번역 실패: %s", e)
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
        raise HTTPException(status_code=500, detail="번역 클라이언트가 초기화되지 않았습니다.")
    
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
        logger.warning("배치 번역 검증 오류: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("배치 번역 실패: %s", e)
        raise HTTPException(status_code=502, detail=f"Batch translation failed: {e}")
