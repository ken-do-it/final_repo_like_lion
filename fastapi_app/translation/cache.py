"""
번역 결과를 저장하는 단순 인메모리 캐시.
실서비스에서는 Redis 등 영속 캐시로 교체(TODO).
"""

import time
from typing import Optional, Tuple


class TranslationCache:
    def __init__(self, ttl_seconds: int = 3600):
        self.ttl = ttl_seconds
        self.store = {}  # key -> (expiry_ts, translated_text, provider)

    def make_key(self, text: str, src: str, tgt: str) -> str:
        return f"{src}|{tgt}|{text}"

    def get(self, text: str, src: str, tgt: str) -> Optional[Tuple[str, str]]:
        key = self.make_key(text, src, tgt)
        if key not in self.store:
            return None
        expiry, translated_text, provider = self.store[key]
        if expiry < time.time():
            self.store.pop(key, None)
            return None
        return translated_text, provider

    def set(self, text: str, src: str, tgt: str, translated_text: str, provider: str):
        key = self.make_key(text, src, tgt)
        self.store[key] = (time.time() + self.ttl, translated_text, provider)
