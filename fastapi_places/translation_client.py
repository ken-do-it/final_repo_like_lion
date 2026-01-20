import httpx
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

DJANGO_URL = "http://django:8000"

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
                "target_lang": target_lang
            }
            
            response = await client.post(
                f"{DJANGO_URL}/translations/batch/",
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
                
    except Exception as e:
        logger.error(f"Translation Proxy Failed: {e}")
        return {}
