"""번역 결과를 간단히 메모리에 캐싱하는 유틸."""

import time
from typing import Optional, Tuple


class TranslationCache:
    """단순 메모리 캐시(TTL 적용)."""

    def __init__(self, ttl_seconds: int = 0):
        self.ttl = ttl_seconds
        self.store = {}  # key -> (expiry_ts, translated_text, provider)

    def make_key(self, text: str, src: str, tgt: str) -> str:
        """텍스트/언어 조합으로 캐시 키 생성."""
        return f"{src}|{tgt}|{text}"

    def get(self, text: str, src: str, tgt: str) -> Optional[Tuple[str, str]]:
        """캐시 조회: 없거나 만료 시 None, 있으면 (번역문, provider)."""
        key = self.make_key(text, src, tgt)
        if key not in self.store:
            return None
        expiry, translated_text, provider = self.store[key]
        if expiry < time.time():
            self.store.pop(key, None)
            return None
        return translated_text, provider

    def set(self, text: str, src: str, tgt: str, translated_text: str, provider: str):
        """캐시에 번역 결과 저장."""
        key = self.make_key(text, src, tgt)
        self.store[key] = (time.time() + self.ttl, translated_text, provider)
