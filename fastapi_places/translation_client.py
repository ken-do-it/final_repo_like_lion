import httpx
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

import os
import zlib

# Docker uses "http://django:8000", Local uses "http://localhost:8000"
# Docker uses "http://django:8000", Local uses "http://localhost:8000"
DJANGO_URL = os.getenv("DJANGO_API_URL", "http://django:8000")

NLLB_LANG_MAP = {
    "ko": "kor_Hang",
    "en": "eng_Latn",
    "jp": "jpn_Jpan",
    "ja": "jpn_Jpan",
    "zh": "zho_Hans",
    "zh-cn": "zho_Hans",
    "zh-tw": "zho_Hant"
}

async def translate_batch_proxy(items: List[Dict[str, Any]], target_lang: str) -> Dict[int, str]:
    """
    Django의 TranslationBatchView를 호출하여 번역을 수행합니다.
    
    Args:
        items: [{"text": "...", "entity_type": "...", "entity_id": ..., "field": "..."}] 형태의 리스트
        target_lang: 타겟 언어 코드 (예: 'eng_Latn')
        
    Returns:
        Dict[index, translated_text]: 원본 리스트의 인덱스를 키로 하는 번역 결과 맵
    """
    if not items or not target_lang:
        return {}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            payload = {
                "items": items,
                "source_lang": "kor_Hang", # 기본값 (대부분 한국어 데이터)
                "target_lang": NLLB_LANG_MAP.get(target_lang, target_lang)
            }
            
            response = await client.post(
                f"{DJANGO_URL}/api/translations/batch/",
                json=payload
            )
            
            if response.status_code == 200:
                data = response.json()
                # Django View returns {"results": {"0": "text", "1": "text"}}
                # Keys are strings in JSON, need to convert to int if needed, but we can just return as is
                results = data.get("results", {})
                return {int(k): v for k, v in results.items()}
            else:
                logger.error(f"Translation API Error: {response.status_code} {response.text}")
                return {}
                
                return {}
                
    except Exception as e:
        logger.error(f"Translation Proxy Failed: {e}")
        return {}


async def translate_texts(texts: List[str], target_lang: str) -> List[str]:
    """
    단순 텍스트 리스트를 번역합니다. (entity_type='raw' 사용)
    
    Args:
        texts: 번역할 텍스트 리스트
        target_lang: 타겟 언어 코드
        
    Returns:
        List[str]: 번역된 텍스트 리스트 (순서 유지, 실패 시 원본)
    """
    if not texts:
        return []
        
    # Django Batch View에 맞는 형식으로 변환
    # entity_id=0을 사용하면 중복 문제(캐시 충돌)가 발생하므로, 텍스트의 해시값을 ID로 사용
    items = []
    for text in texts:
        # adler32는 빠르고 32비트 정수를 반환하므로 ID로 적합 (음수 방지 위해 & 0xffffffff)
        text_id = zlib.adler32(text.encode('utf-8')) & 0xffffffff
        items.append({
            "text": text,
            "entity_type": "raw",
            "entity_id": text_id,
            "field": "text"
        })
    
    # 번역 요청
    translated_map = await translate_batch_proxy(items, target_lang)
    
    # 순서대로 결과 구성
    result = []
    for i, original_text in enumerate(texts):
        # 번역 결과가 있으면 사용, 없으면 원본 반환
        result.append(translated_map.get(i, original_text))
        
    return result
