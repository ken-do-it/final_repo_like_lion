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
# [Security] API Key (Must match FastAPI's settings)
AI_SERVICE_API_KEY = os.getenv("AI_SERVICE_API_KEY", "secure-api-key-1234")

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
        1. 한글/가나 포함 여부 확인 (Regex)
        2. langdetect 라이브러리 사용
        3. 실패 시 기본값 'eng_Latn' (영어) 반환 (기존 'kor_Hang'에서 변경)
        """
        if not text or not text.strip():
            return 'eng_Latn'
        
        import re
        # 1. Regex Heuristics
        if re.search(r'[가-힣]', text):
            return 'kor_Hang'
        
        # 2. Korean Jamo Only (ㅋㅋㅋ, ㅇㄻㅇ etc.) - Cannot be translated
        # Consonants: ㄱ-ㅎ, Vowels: ㅏ-ㅣ
        if re.search(r'[ㄱ-ㅎㅏ-ㅣ]', text):
            # Check if text contains only jamo and whitespace
            text_without_jamo = re.sub(r'[ㄱ-ㅎㅏ-ㅣ\s]', '', text)
            if not text_without_jamo:  # Only jamo and spaces
                return 'unknown'  # Untranslatable text
        
        # 3. Mixed Jamo/Syllable Validation (e.g., "ㅇㄴㅁ러나ㅣㅁ리")
        # Check if text has both jamo and syllables but is likely nonsense
        has_complete_syllables = bool(re.search(r'[가-힣]', text))
        has_jamo = bool(re.search(r'[ㄱ-ㅎㅏ-ㅣ]', text))
        
        if has_complete_syllables and has_jamo:
            # Mixed text - check if it's mostly jamo (likely gibberish)
            jamo_count = len(re.findall(r'[ㄱ-ㅎㅏ-ㅣ]', text))
            syllable_count = len(re.findall(r'[가-힣]', text))
            total_korean = jamo_count + syllable_count
            
            # If more than 30% is jamo, treat as untranslatable
            if total_korean > 0 and (jamo_count / total_korean) > 0.3:
                return 'unknown'
        
        
        if re.search(r'[\u3040-\u309F\u30A0-\u30FF]', text): # Hiragana/Katakana
            return 'jpn_Jpan'
            
        # 2. Library Detect
        try:
            detected = detect(text)
            return LANG_CODE_MAP.get(detected, 'eng_Latn') # Default to English if unknown code
        except LangDetectException:
            return 'eng_Latn'

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
            headers = {"x-ai-api-key": AI_SERVICE_API_KEY}
            resp = requests.post(FASTAPI_TRANSLATE_URL, json=payload, headers=headers, timeout=(3, timeout))
            resp.raise_for_status()
            data = resp.json()
            return data.get("translated_text"), data.get("provider", "fastapi")
        except Exception as first_error:
            # 2. Localhost Fallback
            if "fastapi" in FASTAPI_TRANSLATE_URL:
                fallback_url = "http://127.0.0.1:8003/api/ai/translate"
                try:
                    logger.info(f"Primary failed. Retrying fallback: {fallback_url}")
                    resp = requests.post(fallback_url, json=payload, headers=headers, timeout=timeout)
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
            headers = {"x-ai-api-key": AI_SERVICE_API_KEY}
            resp = requests.post(url, json=payload, headers=headers, timeout=(3, timeout))
            resp.raise_for_status()
            data = resp.json()
            return data.get("translations", []), data.get("provider", "fastapi-batch")
        except Exception as first_error:
            logger.warning(f"Primary batch failed: {first_error}. Retrying fallback...")
            fallback_url = "http://127.0.0.1:8003/api/ai/translate/batch"
            try:
                resp = requests.post(fallback_url, json=payload, headers=headers, timeout=timeout)
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
            # Title 해시 계산
            t_hash = hashlib.sha256(t_text.encode("utf-8")).hexdigest() if t_text else None
            item["title_translated"] = TranslationService._translate_field_single(entity_id, "title", t_text, src_lang, target_lang, t_hash)
            
            # Content
            c_text = item.get("content") or ""
            c_hash = hashlib.sha256(c_text.encode("utf-8")).hexdigest() if c_text else None
            item["content_translated"] = TranslationService._translate_field_single(entity_id, "content", c_text, src_lang, target_lang, c_hash)

            # Location
            l_text = item.get("location") or ""
            l_hash = hashlib.sha256(l_text.encode("utf-8")).hexdigest() if l_text else None
            item["location_translated"] = TranslationService._translate_field_single(entity_id, "location", l_text, src_lang, target_lang, l_hash)
            
        return data

    @staticmethod
    def _translate_field_single(entity_id, field, text, src_lang, target_lang, current_hash=None):
        if not text: return ""
        
        entry = TranslationEntry.objects.filter(
            entity_type="shortform", entity_id=entity_id, field=field, target_lang=target_lang
        ).first()
        
        if entry:
            # 해시 확인 (자가 치유)
            if current_hash and entry.source_hash != current_hash:
                logger.info(f"Cache Hash Mismatch for {field}:{entity_id}. Invalidating...")
                entry.delete()
            else:
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
    def apply_translation_batch(data, target_lang, entity_type="shortform", fields=None):
        """
        데이터 목록에 대해 일괄 번역을 적용합니다.
        
        :param data: 번역할 데이터 (List or Dict)
        :param target_lang: 타겟 언어 코드 (예: eng_Latn)
        :param entity_type: 엔티티 타입 (기본값: shortform, travel_plan 등 사용 가능)
        :param fields: 번역할 필드 매핑 (Dict: {source_field: target_field})
                       None일 경우 기본값: {'title': 'title_translated', 'content': 'content_translated', 'location': 'location_translated'}
        """
        if not target_lang: return data
        items = TranslationService._normalize_data(data)
        if not items: return data

        if fields is None:
            fields = {
                'title': 'title_translated',
                'content': 'content_translated', 
                'location': 'location_translated'
            }

        requests_map = {} 
        for item in items:
            if not isinstance(item, dict): continue
            
            # 1. Source Language Detection (if not present, default to Korean)
            src_lang = item.get("source_lang") or "kor_Hang"
            entity_id = item.get("id") or 0
            
            # 2. Iterate through requested fields
            for src_field, tgt_field in fields.items():
                original_text = item.get(src_field) or ""
                
                # Skip empty text
                if not original_text:
                    item[tgt_field] = ""
                    continue
                
                # Special Handling for Location and Comments (Detect language of text itself)
                current_src_lang = src_lang
                if src_field == 'location' or (entity_type == 'plan_comment' and src_field == 'content'):
                    current_src_lang = TranslationService.detect_language(original_text)

                # Skip translation for unknown/invalid text (e.g., Korean jamo only: ㅋㅋㅋ, ㅇㄻㅇ)
                if current_src_lang == 'unknown':
                    item[tgt_field] = original_text
                    continue

                # Skip translation for very short text (≤3 chars, likely emoticons/slang)
                # But allow location field (city names can be short like "대전", "서울")
                if len(original_text.strip()) <= 3 and src_field != 'location':
                    item[tgt_field] = original_text
                    continue

                # If source == target, copy text
                if current_src_lang == target_lang:
                    item[tgt_field] = original_text
                else:
                    # Special Handling for Shortform Comments
                    # (This preserves existing specific logic for nested shortform structures if necessary,
                    # but assumes 'shortform' key indicates a structure that might need unique handling.
                    # For now, we generalize standard fields. If complex nested logic is needed, it should be handled by caller or mapped differently.)
                    
                    # Note: Original code had specific logic for 'shortform' in item which implied a Comment object.
                    # We will support standard field mapping here. 
                    # If specific logic for comments is needed, we should pass entity_type="shortform_comment"
                    
                    # For Shortform Comments logic preservation:
                    if entity_type == "shortform" and 'shortform' in item and src_field == 'content':
                        # It's a comment
                        key = ("shortform_comment", entity_id, "content", target_lang)
                         # Comments often modify 'content' in-place or use a specific target. 
                         # The original code mapped it to 'content' (in-place) or 'content_translated'.
                         # To be safe, we follow the passed `tgt_field`. 
                         # But original logic used "shortform_comment" as entity_type for comments.
                        if key not in requests_map: requests_map[key] = {'text': original_text, 'consumers': [], 'src': src_lang}
                        requests_map[key]['consumers'].append((item, tgt_field))
                        continue

                    # Standard Logic
                    key = (entity_type, entity_id, src_field, target_lang)
                    if key not in requests_map: 
                        requests_map[key] = {
                            'text': original_text, 
                            'consumers': [], 
                            'src': current_src_lang
                        }
                    requests_map[key]['consumers'].append((item, tgt_field))
                    
                    # 검증을 위한 해시 저장
                    if not original_text:
                        requests_map[key]['hash'] = None
                    else:
                        requests_map[key]['hash'] = hashlib.sha256(original_text.encode("utf-8")).hexdigest()

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
                # 해시 확인 (자가 치유)
                text_hash = info.get('hash')
                requested_src = info.get('src')
                
                # Hash match check
                hash_mismatch = (text_hash and entry.source_hash != text_hash)
                # Source Lang match check (e.g., detection logic changed)
                lang_mismatch = (requested_src and entry.source_lang != requested_src)

                if hash_mismatch or lang_mismatch:
                     if lang_mismatch:
                         logger.info(f"Cache Lang Mismatch for {key}. Cache:{entry.source_lang} vs Req:{requested_src}. Invalidating...")
                     
                     # 해시/언어 불일치 -> Miss로 처리 (강제 업데이트)
                     entry.delete()
                     api_call_keys.append(key)
                else:
                     # Hit
                     for (it, field_name) in info['consumers']:
                         it[field_name] = entry.translated_text
            else:
                # Miss
                api_call_keys.append(key)

        if not api_call_keys: return data

        # Batch Call by Language (Parallelized)
        batches_by_lang = {}
        for key in api_call_keys:
            src = requests_map[key]['src']
            if src not in batches_by_lang: batches_by_lang[src] = {'texts': [], 'keys': []}
            batches_by_lang[src]['texts'].append(requests_map[key]['text'])
            batches_by_lang[src]['keys'].append(key)

        new_entries = []
        
        # 병렬 처리를 위한 Executor
        import concurrent.futures
        
        # 배치 크기 설정 (OpenAI 최적화를 위해 작게 나눔)
        BATCH_SIZE = 15 
        
        def process_chunk(chunk_texts, chunk_keys, src_lang, target_lang):
            try:
                t_texts, provider = TranslationService.call_fastapi_translate_batch(chunk_texts, src_lang, target_lang)
                return t_texts, provider, chunk_keys, chunk_texts
            except Exception as e:
                logger.error(f"Chunk Batch Error: {e}")
                return chunk_texts, "error_fallback", chunk_keys, chunk_texts

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            future_to_chunk = {}
            
            for src_lang, batch_data in batches_by_lang.items():
                all_texts = batch_data['texts']
                all_keys = batch_data['keys']
                
                # Split into chunks
                for i in range(0, len(all_texts), BATCH_SIZE):
                    chunk_texts = all_texts[i:i + BATCH_SIZE]
                    chunk_keys = all_keys[i:i + BATCH_SIZE]
                    
                    future = executor.submit(process_chunk, chunk_texts, chunk_keys, src_lang, target_lang)
                    future_to_chunk[future] = src_lang

            # Collect results
            for future in concurrent.futures.as_completed(future_to_chunk):
                translations, provider, chunk_keys, chunk_original_texts = future.result()
                
                for i, t_text in enumerate(translations):
                    if i >= len(chunk_keys): break
                    key = chunk_keys[i]
                    original_text = chunk_original_texts[i]

                    for (it, field_name) in requests_map[key]['consumers']:
                        it[field_name] = t_text

                    if provider == "error_fallback": continue

                    (etype, eid, fld, tlang) = key
                    new_entries.append(TranslationEntry(
                        entity_type=etype, entity_id=eid, field=fld,
                        source_lang=future_to_chunk[future], target_lang=tlang,
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
