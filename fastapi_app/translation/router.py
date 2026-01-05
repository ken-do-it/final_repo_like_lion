"""
FastAPI 라우터: 로컬 transformers 기반 번역 엔드포인트
- 요청: text, source_lang, target_lang
- 캐시: 메모리 캐시(TranslationCache) 사용
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from .client import TranslationClient
from .cache import TranslationCache

logger = logging.getLogger(__name__)

router = APIRouter()

# 단순 메모리 캐시 (추후 Redis 대체 가능)
cache = TranslationCache(ttl_seconds=0) #3600초 = 1시간를 개발할때 0으로 바꿔서 테스트 가능

# 번역 클라이언트 초기화
try:
    client = TranslationClient()
except Exception as e:
    logger.error("TranslationClient 초기화 실패: %s", e)
    client = None


class TranslateRequest(BaseModel):
    text: str
    source_lang: str = "kor_Hang"
    target_lang: str = "eng_Latn"


@router.post("/translate")
def translate(req: TranslateRequest):
    """
    POST /api/ai/translate
    - 캐시 히트 시 cached=True
    - 캐시 미스 시 로컬 transformers로 번역 후 저장
    """
    if client is None:
        raise HTTPException(status_code=500, detail="Translation client not initialized (HF_MODEL 확인).")

    cached = cache.get(req.text, req.source_lang, req.target_lang)
    if cached:
        translated_text, provider = cached
        return {"translated_text": translated_text, "cached": True, "provider": provider}

    try:
        translated = client.translate(req.text, req.source_lang, req.target_lang)
        cache.set(req.text, req.source_lang, req.target_lang, translated, provider="local-transformers")
        return {"translated_text": translated, "cached": False, "provider": "local-transformers"}
    except Exception as e:
        logger.error("로컬 번역 실패: %s", e)
        raise HTTPException(status_code=502, detail=f"Translation failed: {e}")
