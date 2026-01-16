import os
import requests
import logging
import hashlib
from django.utils import timezone
from django.db.models import Q
from rest_framework import exceptions
from contents.models import TranslationEntry
from langdetect import detect, LangDetectException

logger = logging.getLogger(__name__)

# FastAPI 번역 서버 (분리됨: Port 8003)
FASTAPI_TRANSLATE_URL = "http://fastapi-ai-translation:8003/api/ai/translate"

# 언어 코드 매핑 (langdetect code -> NLLB code)
LANG_CODE_MAP = {
    'ko': 'kor_Hang',
    'en': 'eng_Latn',
    'ja': 'jpn_Jpan',
    'zh-cn': 'zho_Hans',
    'zh-tw': 'zho_Hans',
}

class TranslationService:
    @staticmethod
    def _get_current_model_name():
        engine = os.getenv("AI_ENGINE", "nllb")
        if engine == "openai":
            return os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        elif engine == "ollama":
            return os.getenv("OLLAMA_MODEL", "llama3")
        else:
            return os.getenv("HF_MODEL", "facebook/nllb-200-distilled-600M")

    @staticmethod
    def detect_language(text):
        """
        텍스트의 언어를 감지하여 NLLB 코드로 반환.
        감지 실패 시 기본값 'kor_Hang' 반환.
        """
        if not text or not text.strip():
            return 'kor_Hang'
        try:
            detected = detect(text)
            return LANG_CODE_MAP.get(detected, 'kor_Hang')
        except LangDetectException:
            return 'kor_Hang'

    @staticmethod
    def call_fastapi_translate(text: str, source_lang: str, target_lang: str, timeout: int = 20):
        """
        FastAPI 번역 엔드포인트 호출. 실패 시 APIException 발생.
        """
        payload = {
            "text": text,
            "source_lang": source_lang,
            "target_lang": target_lang,
        }
        
        try:
            # 1. Primary URL
            resp = requests.post(FASTAPI_TRANSLATE_URL, json=payload, timeout=(3, timeout))
            resp.raise_for_status()
            data = resp.json()
            return data.get("translated_text"), data.get("provider", "fastapi")
        except Exception as first_error:
            # 2. Localhost Fallback
            if "fastapi" in FASTAPI_TRANSLATE_URL:
                fallback_url = "http://127.0.0.1:8003/api/ai/translate"
                try:
                    logger.info(f"Primary failed. Retrying fallback: {fallback_url}")
                    resp = requests.post(fallback_url, json=payload, timeout=timeout)
                    resp.raise_for_status()
                    data = resp.json()
                    return data.get("translated_text"), data.get("provider", "fastapi-local")
                except Exception:
                    pass
            
            logger.error(f"Translation failed: {first_error}")
            raise exceptions.APIException(f"Translation service failed: {first_error}")

    @staticmethod
    def call_fastapi_translate_batch(texts: list[str], source_lang: str, target_lang: str, timeout: int = 60):
        payload = {
            "texts": texts,
            "source_lang": source_lang,
            "target_lang": target_lang,
        }
        url = f"{FASTAPI_TRANSLATE_URL.replace('/translate', '')}/translate/batch"
        
        try:
            resp = requests.post(url, json=payload, timeout=(3, timeout))
            resp.raise_for_status()
            data = resp.json()
            return data.get("translations", []), data.get("provider", "fastapi-batch")
        except Exception as first_error:
            logger.warning(f"Primary batch failed: {first_error}. Retrying fallback...")
            fallback_url = "http://127.0.0.1:8003/api/ai/translate/batch"
            try:
                resp = requests.post(fallback_url, json=payload, timeout=timeout)
                resp.raise_for_status()
                data = resp.json()
                return data.get("translations", []), data.get("provider", "fastapi-local-batch")
            except Exception as e:
                logger.error(f"Fallback batch failed: {e}")
                raise exceptions.APIException(f"Translation service failed: {first_error}")

    @staticmethod
    def invalidate_cache(entity_type, entity_id):
        try:
            TranslationEntry.objects.filter(entity_type=entity_type, entity_id=entity_id).delete()
        except Exception as e:
            logger.error(f"Cache invalidation failed: {e}")

    # Note: Logic logic for applying translation to list/batch is specific to current View structure
    # but strictly belongs here. I will move the core logic here.

    @staticmethod
    def apply_translation_sequential(data, target_lang):
        if not target_lang: return data
        items = TranslationService._normalize_data(data)
        if not items: return data

        for item in items:
            if not isinstance(item, dict): continue
            
            src_lang = item.get("source_lang") or "kor_Hang"
            if src_lang == target_lang:
                item["title_translated"] = item.get("title", "")
                item["content_translated"] = item.get("content", "")
                continue

            entity_id = item.get("id") or 0
            
            # Title
            t_text = item.get("title") or ""
            item["title_translated"] = TranslationService._translate_field_single(entity_id, "title", t_text, src_lang, target_lang)
            
            # Content
            c_text = item.get("content") or ""
            item["content_translated"] = TranslationService._translate_field_single(entity_id, "content", c_text, src_lang, target_lang)
            
        return data

    @staticmethod
    def _translate_field_single(entity_id, field, text, src_lang, target_lang):
        if not text: return ""
        
        entry = TranslationEntry.objects.filter(
            entity_type="shortform", entity_id=entity_id, field=field, target_lang=target_lang
        ).first()
        
        if entry:
            return entry.translated_text
        
        try:
            translated_text, provider = TranslationService.call_fastapi_translate(text, src_lang, target_lang)
            TranslationEntry.objects.create(
                entity_type="shortform", entity_id=entity_id, field=field,
                source_lang=src_lang, target_lang=target_lang,
                source_hash=hashlib.sha256(text.encode("utf-8")).hexdigest(),
                translated_text=translated_text, provider=provider,

                model=TranslationService._get_current_model_name(),
                last_used_at=timezone.now(),
            )
            return translated_text
        except Exception as e:
            logger.error(f"Sequential translation failed: {e}")
            return text

    @staticmethod
    def apply_translation_batch(data, target_lang):
        if not target_lang: return data
        items = TranslationService._normalize_data(data)
        if not items: return data

        requests_map = {} 
        for item in items:
            if not isinstance(item, dict): continue
            src_lang = item.get("source_lang") or "kor_Hang"
            
            if src_lang == target_lang:
                item["title_translated"] = item.get("title", "")
                item["content_translated"] = item.get("content", "")
                continue

            entity_id = item.get("id") or 0
            
            # Title
            t_text = item.get("title") or ""
            if t_text:
                key = ("shortform", entity_id, "title", target_lang)
                if key not in requests_map: requests_map[key] = {'text': t_text, 'consumers': [], 'src': src_lang}
                requests_map[key]['consumers'].append((item, "title_translated"))
            else:
                item["title_translated"] = ""

            # Content (Shortform)
            if 'shortform' in item: # Check if it's a ShortformComment (which has 'shortform' field)
                 # Comment Content
                c_text = item.get("content") or ""
                if c_text:
                    # Use 'shortform_comment' as entity type
                    key = ("shortform_comment", entity_id, "content", target_lang)
                    if key not in requests_map: requests_map[key] = {'text': c_text, 'consumers': [], 'src': src_lang}
                    requests_map[key]['consumers'].append((item, "content")) # Overwrite 'content' or use new field? User said "shown in Korean.. automatic translate". Usually better to keep original and translate, or overwrite if display-only. User implied replacement. Let's overwrite 'content' for now as existing UI uses it.
            else:
                # Content (Shortform Video)
                c_text = item.get("content") or ""
                if c_text:
                    key = ("shortform", entity_id, "content", target_lang)
                    if key not in requests_map: requests_map[key] = {'text': c_text, 'consumers': [], 'src': src_lang}
                    requests_map[key]['consumers'].append((item, "content_translated"))
                else:
                    item["content_translated"] = ""

        if not requests_map: return data

        # Check Cache
        q_objs = Q()
        for (etype, eid, field, tlang) in requests_map.keys():
            q_objs |= Q(entity_type=etype, entity_id=eid, field=field, target_lang=tlang)
        
        cached_entries = TranslationEntry.objects.filter(q_objs)
        entry_map = {(e.entity_type, e.entity_id, e.field, e.target_lang): e for e in cached_entries}

        api_call_keys = []
        
        for key, info in requests_map.items():
            entry = entry_map.get(key)
            if entry:
                # Hit
                for (it, field_name) in info['consumers']:
                    it[field_name] = entry.translated_text
            else:
                # Miss
                api_call_keys.append(key)

        if not api_call_keys: return data

        # Batch Call by Language
        batches_by_lang = {}
        for key in api_call_keys:
            src = requests_map[key]['src']
            if src not in batches_by_lang: batches_by_lang[src] = {'texts': [], 'keys': []}
            batches_by_lang[src]['texts'].append(requests_map[key]['text'])
            batches_by_lang[src]['keys'].append(key)

        new_entries = []
        for src_lang, batch_data in batches_by_lang.items():
            texts = batch_data['texts']
            keys = batch_data['keys']
            
            try:
                translations, provider = TranslationService.call_fastapi_translate_batch(texts, src_lang, target_lang)
            except Exception as e:
                logger.error(f"Batch Error: {e}")
                translations = texts
                provider = "error_fallback"

            for i, t_text in enumerate(translations):
                if i >= len(keys): break
                key = keys[i]
                original_text = texts[i]
                
                for (it, field_name) in requests_map[key]['consumers']:
                    it[field_name] = t_text
                
                if provider == "error_fallback": continue

                (etype, eid, fld, tlang) = key
                new_entries.append(TranslationEntry(
                    entity_type=etype, entity_id=eid, field=fld,
                    source_lang=src_lang, target_lang=tlang,
                    source_hash=hashlib.sha256(original_text.encode("utf-8")).hexdigest(),
                    translated_text=t_text, provider=provider,

                    model=TranslationService._get_current_model_name(),
                    last_used_at=timezone.now(),
                ))
        
        if new_entries:
            TranslationEntry.objects.bulk_create(new_entries, ignore_conflicts=True)

        return data

    @staticmethod
    def _normalize_data(data):
        if isinstance(data, dict):
            if 'results' in data and isinstance(data['results'], list): return data['results']
            return [data]
        elif isinstance(data, list):
            return data
        return None
