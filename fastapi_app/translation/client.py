"""
Local translation client using transformers (no external HF Inference API).
- Loads model from HF_MODEL (default: facebook/nllb-200-distilled-600M).
- Short codes(en, ko, ja, zh 등)을 NLLB lang_code로 매핑해 강제 BOS를 올바르게 설정합니다.
"""

import os
from typing import Optional, Dict

from dotenv import load_dotenv
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
import torch

# NLLB 전용 토크나이저 우선 사용 (lang_code_to_id 보장)
try:
    from transformers import NllbTokenizer
except ImportError:  # transformers 버전에 따라 없을 수 있음
    NllbTokenizer = None

load_dotenv()


class TranslationClient:
    def __init__(self):
        model_name = os.getenv("HF_MODEL", "facebook/nllb-200-distilled-600M")
        self.model_name = model_name
        tokenizer_cls = AutoTokenizer
        if NllbTokenizer and "nllb" in model_name.lower():
            tokenizer_cls = NllbTokenizer

        # use_fast=False to ensure lang_code_to_id is available
        self.tokenizer = tokenizer_cls.from_pretrained(model_name, use_fast=False)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        self.lang_map = self._init_lang_map()
        self._ensure_lang_code_ids()

    def _ensure_lang_code_ids(self):
        """
        일부 토크나이저(캐시/버전 차이)에서 lang_code_to_id가 비어있을 수 있어,
        additional_special_tokens를 기반으로 직접 매핑을 구성합니다.
        """
        if getattr(self.tokenizer, "lang_code_to_id", None):
            return
        specials = getattr(self.tokenizer, "additional_special_tokens", None)
        if specials:
            mapping = {}
            for tok in specials:
                tok_id = self.tokenizer.convert_tokens_to_ids(tok)
                if tok_id is not None:
                    mapping[tok] = tok_id
            if mapping:
                self.tokenizer.lang_code_to_id = mapping

    def _init_lang_map(self) -> Dict[str, str]:
        """
        사용자 입력 언어코드를 NLLB 코드로 정규화합니다.
        필요한 언어는 여기에 추가하세요.
        """
        return {
            "en": "eng_Latn",
            "ko": "kor_Hang",
            "ja": "jpn_Jpan",
            "zh": "zho_Hans",
            "zh-cn": "zho_Hans",
            "zh-tw": "zho_Hant",
            "fr": "fra_Latn",
            "es": "spa_Latn",
            "de": "deu_Latn",
            "ru": "rus_Cyrl",
        }

    def _normalize_lang(self, code: str) -> str:
        if not code:
            return code
        key = code.lower()
        return self.lang_map.get(key, code)

    def _get_forced_bos(self, target_lang: str) -> Optional[int]:
        lang_map = getattr(self.tokenizer, "lang_code_to_id", None)
        if lang_map and target_lang in lang_map:
            return lang_map[target_lang]
        return None

    def translate(self, text: str, source_lang: str, target_lang: str, timeout: int = 30) -> str:
        # 언어 코드 정규화
        source_lang = self._normalize_lang(source_lang)
        target_lang = self._normalize_lang(target_lang)

        # NLLB 계열일 경우 소스 언어 설정
        if hasattr(self.tokenizer, "src_lang"):
            self.tokenizer.src_lang = source_lang

        # lang_code_to_id가 없는 모델이면 바로 에러 (NLLB 아닌 모델 방지)
        if not getattr(self.tokenizer, "lang_code_to_id", None):
            raise ValueError(f"Tokenizer has no lang_code_to_id; model may not be NLLB. model={self.model_name}")

        inputs = self.tokenizer(text, return_tensors="pt")
        forced_bos = self._get_forced_bos(target_lang)
        # target_lang이 유효하지 않으면 기본 영어로 강제 (eng_Latn). 그래도 없으면 에러.
        if forced_bos is None:
            lang_map = getattr(self.tokenizer, "lang_code_to_id", None)
            if lang_map:
                forced_bos = self._get_forced_bos("eng_Latn")
                if forced_bos is None:
                    raise ValueError(f"Unsupported target_lang for this tokenizer: {target_lang} (model={self.model_name})")
            else:
                raise ValueError(f"Tokenizer has no lang_code_to_id; model may not be NLLB. model={self.model_name}")

        with torch.no_grad():
            generated = self.model.generate(
                **inputs,
                forced_bos_token_id=forced_bos,
                max_length=256,
            )
        return self.tokenizer.decode(generated[0], skip_special_tokens=True)
