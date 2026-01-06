"""Local transformers-based translator (NLLB-200 by default)."""

import os
from typing import Optional, Dict, Set

from dotenv import load_dotenv
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
import torch

# Prefer NllbTokenizer for NLLB models when available
try:
    from transformers import NllbTokenizer
except ImportError:
    NllbTokenizer = None

load_dotenv()


class TranslationClient:
    """Thin wrapper around an NLLB seq2seq model with lang validation."""

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
        self.supported_langs: Set[str] = set(getattr(self.tokenizer, "lang_code_to_id", {}).keys())

    def _ensure_lang_code_ids(self):
        """Ensure lang_code_to_id exists even when only additional_special_tokens are present."""
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
        """Normalize common short codes to NLLB codes."""
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
        """Map shorthand language code to the NLLB code if possible."""
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
        """
        Translate a single text using the local NLLB model.
        Validates lang codes against tokenizer.lang_code_to_id.
        """
        if not text or not text.strip():
            raise ValueError("Text is empty")

        source_lang = self._normalize_lang(source_lang)
        target_lang = self._normalize_lang(target_lang)

        # Validate languages against tokenizer
        if self.supported_langs:
            if target_lang not in self.supported_langs:
                raise ValueError(f"Unsupported target_lang: {target_lang}")
            if hasattr(self.tokenizer, "src_lang") and source_lang not in self.supported_langs:
                raise ValueError(f"Unsupported source_lang: {source_lang}")

        # Set source language for NLLB tokenizers
        if hasattr(self.tokenizer, "src_lang"):
            self.tokenizer.src_lang = source_lang

        # Guard: require lang_code_to_id for NLLB models
        if not getattr(self.tokenizer, "lang_code_to_id", None):
            raise ValueError(f"Tokenizer has no lang_code_to_id; model may not be NLLB. model={self.model_name}")

        inputs = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
        forced_bos = self._get_forced_bos(target_lang)

        # Fallback to English if target_lang not supported
        if forced_bos is None:
            forced_bos = self._get_forced_bos("eng_Latn")
            if forced_bos is None:
                raise ValueError(f"Unsupported target_lang: {target_lang} (model={self.model_name})")

        with torch.no_grad():
            generated = self.model.generate(
                **inputs,
                forced_bos_token_id=forced_bos,
                max_length=256,
            )
        return self.tokenizer.decode(generated[0], skip_special_tokens=True)

    def translate_batch(self, texts: list[str], source_lang: str, target_lang: str) -> list[str]:
        """
        Translate a list of texts using batch processing.
        """
        if not texts:
            return []
        
        source_lang = self._normalize_lang(source_lang)
        target_lang = self._normalize_lang(target_lang)

        # Validate languages (same as single mode)
        if self.supported_langs:
            if target_lang not in self.supported_langs:
                raise ValueError(f"Unsupported target_lang: {target_lang}")
            if hasattr(self.tokenizer, "src_lang") and source_lang not in self.supported_langs:
                raise ValueError(f"Unsupported source_lang: {source_lang}")

        if hasattr(self.tokenizer, "src_lang"):
            self.tokenizer.src_lang = source_lang

        # Guard
        if not getattr(self.tokenizer, "lang_code_to_id", None):
             # Fallback to single loop if something is wrong with tokenizer
            return [self.translate(t, source_lang, target_lang) for t in texts]

        # Batch Tokenization
        inputs = self.tokenizer(texts, return_tensors="pt", padding=True, truncation=True, max_length=512)
        forced_bos = self._get_forced_bos(target_lang)
        
        if forced_bos is None:
             forced_bos = self._get_forced_bos("eng_Latn")

        with torch.no_grad():
            generated = self.model.generate(
                **inputs,
                forced_bos_token_id=forced_bos,
                max_length=256,
            )
        
        # Batch Decode
        return self.tokenizer.batch_decode(generated, skip_special_tokens=True)
