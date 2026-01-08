import os
import uuid
import json
import subprocess
import logging
import hashlib
import requests
from shutil import which
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.db.models import F, Q
from django.utils import timezone
from rest_framework import parsers, exceptions, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from .models import Shortform, ShortformLike, ShortformComment, ShortformView, TranslationEntry
from .serializers import ShortformSerializer, ShortformCommentSerializer
from langdetect import detect, LangDetectException

logger = logging.getLogger(__name__)

# 언어 코드 매핑 (langdetect code -> NLLB code)
LANG_CODE_MAP = {
    'ko': 'kor_Hang',
    'en': 'eng_Latn',
    'ja': 'jpn_Jpan',
    'zh-cn': 'zho_Hans',
    'zh-tw': 'zho_Hans',
    # 필요 시 추가
}

def detect_language(text):
    """
    텍스트의 언어를 감지하여 NLLB 코드로 반환.
    감지 실패 시 기본값 'kor_Hang' 반환.
    """
    if not text or not text.strip():
        return 'kor_Hang'
    try:
        detected = detect(text)
        return LANG_CODE_MAP.get(detected, 'kor_Hang') # 매핑 없으면 한국어로 가정 (또는 eng_Latn)
    except LangDetectException:
        return 'kor_Hang'


# FastAPI 검색 서버
FASTAPI_SEARCH_URL = "http://fastapi:8000/api/search"

# FastAPI 번역 서버 (분리됨: Port 8003)
FASTAPI_TRANSLATE_URL = "http://fastapi-ai-translation:8003/api/ai/translate"


def resolve_bin(name, env_var):
    """
    실행할 바이너리 경로를 결정한다.
    - 환경변수(env_var) 우선
    - 없으면 PATH에서 탐색
    """
    env_path = os.getenv(env_var)
    if env_path:
        return env_path
    found = which(name)
    return found


def get_default_user():
    """
    개발 단계에서 인증이 없으므로 기본으로 사용할 관리자(superuser)를 찾는다.
    반환: User 인스턴스 (없으면 ValueError 발생)
    """
    User = get_user_model()
    user = User.objects.filter(is_superuser=True).first()
    if not user:
        raise ValueError("No superuser found. Create a superuser to own uploaded shortforms.")
    return user


# 인증 연동 전까지는 모든 작성자/소유자를 superuser로 처리
def get_action_user(request):
    """
    인증 연동 시 교체 예정.
    - 현재: request.user가 인증된 경우 해당 사용자 사용.
    - 미인증: superuser fallback (get_default_user) 사용.
    TODO: 실제 인증 도입 시 소유자/작성자 검증 로직으로 대체.
    """
    if hasattr(request, "user") and getattr(request.user, "is_authenticated", False):
        return request.user
    return get_default_user()


def call_fastapi_translate(text: str, source_lang: str, target_lang: str, timeout: int = 20):
    """
    FastAPI 번역 엔드포인트 호출. 실패 시 APIException 발생.
    로컬 개발 환경(docker-compose 외부)을 고려해 localhost 포트도 Fallback으로 시도.
    """
    payload = {
        "text": text,
        "source_lang": source_lang,
        "target_lang": target_lang,
    }
    
    # 1. 시도: 설정된 URL (Docker Internal or Env)
    try:
        # (connect timeout, read timeout)
        resp = requests.post(FASTAPI_TRANSLATE_URL, json=payload, timeout=(3, timeout))
        resp.raise_for_status()
        data = resp.json()
        return data.get("translated_text"), data.get("provider", "fastapi")
    except Exception as first_error:
        # 2. 시도: 로컬호스트 Fallback (개발 편의성)
        # 만약 기본 URL이 'fastapi:8000' 형태라면, 로컬 8003포트로 재시도
        if "fastapi" in FASTAPI_TRANSLATE_URL:
            fallback_url = "http://127.0.0.1:8003/api/ai/translate"  # Port 8003으로 수정됨
            try:
                logger.info(f"Primary translation URL failed. Retrying fallback: {fallback_url}")
                resp = requests.post(fallback_url, json=payload, timeout=timeout)
                resp.raise_for_status()
                data = resp.json()
                return data.get("translated_text"), data.get("provider", "fastapi-local")
            except Exception:
                # Fallback도 실패하면 원래 에러 로깅
                pass
        
        logger.error(f"Translation failed: {first_error}")
        raise exceptions.APIException(f"Translation service failed: {first_error}")


def translate_and_cache(text, entity_type, entity_id, field, source_lang, target_lang):
    """
    TranslationEntry 캐시 조회 후 FastAPI 번역 요청. 결과를 DB에 저장해 재사용.
    """
    if not text or source_lang == target_lang:
        return text
    entry = TranslationEntry.objects.filter(
        entity_type=entity_type,
        entity_id=entity_id,
        field=field,
        target_lang=target_lang,
    ).first()
    if entry:
        entry.last_used_at = timezone.now()
        entry.save(update_fields=["last_used_at"])
        return entry.translated_text

    try:
        translated_text, provider = call_fastapi_translate(text, source_lang, target_lang)
        TranslationEntry.objects.create(
            entity_type=entity_type,
            entity_id=entity_id,
            field=field,
            source_lang=source_lang,
            target_lang=target_lang,
            source_hash=hashlib.sha256(text.encode("utf-8")).hexdigest(),
            translated_text=translated_text,
            provider=provider or "fastapi",
            model=os.getenv("HF_MODEL", "facebook/nllb-200-distilled-600M"),
            last_used_at=timezone.now(),
        )
        return translated_text
    except Exception as e:
        logger.error(f"Translation failed for {entity_type}:{entity_id}:{field}. Error: {e}")
        # 번역 실패 시 원본 텍스트 반환 (500 에러 방지)
        return text


def save_video_file(uploaded_file):
    """
    업로드된 파일을 로컬 MEDIA_ROOT 아래에 저장하고, 저장된 URL을 반환한다.
    """
    ext = os.path.splitext(uploaded_file.name)[1] or '.mp4'
    filename = f"{uuid.uuid4()}{ext}"
    saved_path = default_storage.save(os.path.join('shortforms', 'videos', filename), uploaded_file)
    saved_url = default_storage.url(saved_path)
    return saved_path, saved_url


def extract_metadata(file_path):
    """
    ffprobe를 사용해 영상 메타데이터를 추출한다.
    반환: dict(duration, width, height) / 실패 시 {}
    """
    ffprobe_bin = resolve_bin("ffprobe", "FFPROBE_BIN")
    if not ffprobe_bin:
        logger.warning("ffprobe not found (set FFPROBE_BIN env or add to PATH)")
        return {}
    try:
        cmd = [
            ffprobe_bin,
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height,duration",
            "-of", "json",
            file_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout or "{}")
        stream = (data.get("streams") or [{}])[0]
        duration = stream.get("duration")
        width = stream.get("width")
        height = stream.get("height")
        return {
            "duration": int(float(duration)) if duration is not None else None,
            "width": int(width) if width is not None else None,
            "height": int(height) if height is not None else None,
        }
    except Exception as e:
        logger.warning("ffprobe metadata extraction failed for %s: %s", file_path, e)
        return {}


def generate_thumbnail(file_path):
    """
    ffmpeg로 썸네일(첫 1초 부근 프레임)을 생성한다.
    반환: (relative_path, url) / 실패 시 (None, None)
    """
    ffmpeg_bin = resolve_bin("ffmpeg", "FFMPEG_BIN")
    if not ffmpeg_bin:
        logger.warning("ffmpeg not found (set FFMPEG_BIN env or add to PATH)")
        return None, None
    try:
        thumb_name = f"{uuid.uuid4()}.jpg"
        rel_path = os.path.join('shortforms', 'thumbnails', thumb_name)
        abs_path = default_storage.path(rel_path)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        cmd = [
            ffmpeg_bin,
            "-y",
            "-ss", "00:00:01",
            "-i", file_path,
            "-vframes", "1",
            "-vf", "scale=320:-1",
            abs_path,
        ]
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        return rel_path, default_storage.url(rel_path)
    except Exception as e:
        logger.warning("ffmpeg thumbnail generation failed for %s: %s", file_path, e)
        return None, None


class ShortformViewSet(viewsets.ModelViewSet):
    """
    list/retrieve/create 숏폼 처리 (인증 없이 superuser를 작성자로 사용).
    """

    queryset = Shortform.objects.order_by('-created_at')
    serializer_class = ShortformSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def perform_create(self, serializer):
        try:
            user = get_action_user(self.request)
        except ValueError as e:
            raise exceptions.ValidationError({"detail": str(e)})

        video_file = self.request.FILES.get('video_file') or serializer.validated_data.get('video_file')
        if not video_file:
            raise exceptions.ValidationError({"video_file": ["This field is required."]})

        saved_path, saved_url = save_video_file(video_file)
        abs_path = default_storage.path(saved_path)
        meta = extract_metadata(abs_path)
        thumb_path, thumb_url = generate_thumbnail(abs_path)

        # 언어 자동 감지
        title = serializer.validated_data.get('title', '')
        content = serializer.validated_data.get('content', '')
        full_text = f"{title} {content}".strip()
        detected_lang = detect_language(full_text)

        serializer.save(
            user=user,
            video_url=saved_url,
            file_size=video_file.size,
            duration=meta.get("duration"),
            width=meta.get("width"),
            height=meta.get("height"),
            thumbnail_url=thumb_url,
            source_lang=detected_lang,
        )

    def _apply_translation_sequential(self, data, target_lang):
        """
        [DEMO]: 하나씩 순차적으로 번역 API를 호출하는 느린 버전 (최적화 전)
        """
        if not target_lang:
            return data

        # 1. 데이터 정규화 (리스트로 변환)
        items = []
        if isinstance(data, dict):
            if 'results' in data and isinstance(data['results'], list):
                items = data['results']
            else:
                items = [data]
        elif isinstance(data, list):
            items = data
        else:
            return data
        
        if not items:
            return data

        # 2. 순차적으로 하나씩 처리
        for item in items:
            if not isinstance(item, dict):
                continue

            src_lang = item.get("source_lang") or "kor_Hang"
            if src_lang == target_lang:
                item["title_translated"] = item.get("title", "")
                item["content_translated"] = item.get("content", "")
                continue

            entity_id = item.get("id") or 0
            
            # Title Processing
            t_text = item.get("title") or ""
            if t_text:
                # 2-1. DB 캐시 확인
                entry = TranslationEntry.objects.filter(
                    entity_type="shortform", entity_id=entity_id, field="title", target_lang=target_lang
                ).first()
                
                if entry:
                    item["title_translated"] = entry.translated_text
                else:
                    # 2-2. API 호출 (Single) - 여기서 시간이 걸림!
                    try:
                        translated_text, provider = call_fastapi_translate(t_text, src_lang, target_lang)
                        # DB 저장
                        TranslationEntry.objects.create(
                            entity_type="shortform", entity_id=entity_id, field="title",
                            source_lang=src_lang, target_lang=target_lang,
                            source_hash=hashlib.sha256(t_text.encode("utf-8")).hexdigest(),
                            translated_text=translated_text, provider=provider,
                            model=os.getenv("HF_MODEL", "facebook/nllb-200-distilled-600M"),
                            last_used_at=timezone.now(),
                        )
                        item["title_translated"] = translated_text
                    except Exception as e:
                        logger.error(f"Sequential translation failed: {e}")
                        item["title_translated"] = t_text # Fallback
            else:
                item["title_translated"] = ""

            # Content Processing (위와 동일 반복)
            c_text = item.get("content") or ""
            if c_text:
                entry = TranslationEntry.objects.filter(
                    entity_type="shortform", entity_id=entity_id, field="content", target_lang=target_lang
                ).first()
                if entry:
                    item["content_translated"] = entry.translated_text
                else:
                    try:
                        translated_text, provider = call_fastapi_translate(c_text, src_lang, target_lang)
                        TranslationEntry.objects.create(
                            entity_type="shortform", entity_id=entity_id, field="content",
                            source_lang=src_lang, target_lang=target_lang,
                            source_hash=hashlib.sha256(c_text.encode("utf-8")).hexdigest(),
                            translated_text=translated_text, provider=provider,
                            model=os.getenv("HF_MODEL", "facebook/nllb-200-distilled-600M"),
                            last_used_at=timezone.now(),
                        )
                        item["content_translated"] = translated_text
                    except Exception:
                        item["content_translated"] = c_text

        return data

    def _apply_translation_batch(self, data, target_lang):
        """
        serializer.data(dict 또는 list)에 title/content 번역 필드를 추가.
        (Batch API 사용 버전)
        """
        if not target_lang:
            return data

        # 1. 데이터 정규화 (리스트로 변환)
        items = []
        if isinstance(data, dict):
            if 'results' in data and isinstance(data['results'], list):
                items = data['results']
            else:
                items = [data]
        elif isinstance(data, list):
            items = data
        else:
            return data
        
        if not items:
            return data

        # 2. 번역 대상 수집
        # to_translate: list of dict {'item_idx': i, 'type': 'title'|'content', 'text': str, 'original_item': item}
        to_translate_tasks = []
        
        # 결과 매핑을 위한 임시 저장소 (cache_map[hash] = translated_text)
        # 키는 (entity_type, entity_id, field, target_lang)가 정확하겠지만
        # 여기서는 간단히 나중에 순서대로 채워넣거나, map을 미리 만들어둔다.
        # 편의상 "item 내부"에 직접 값을 할당하는 식으로 한다.
        
        # Batch 요청을 위한 준비
        # requests_map: needed_text -> list of (item, field_name)
        # 이렇게 하면 같은 텍스트가 여러번 나와도 한번만 번역함.
        requests_map = {} 

        for item in items:
            if not isinstance(item, dict):
                continue
            
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
                if key not in requests_map:
                    requests_map[key] = {'text': t_text, 'consumers': []}
                requests_map[key]['consumers'].append((item, "title_translated"))
            else:
                item["title_translated"] = ""

            # Content
            c_text = item.get("content") or ""
            if c_text:
                key = ("shortform", entity_id, "content", target_lang)
                if key not in requests_map:
                    requests_map[key] = {'text': c_text, 'consumers': []}
                requests_map[key]['consumers'].append((item, "content_translated"))
            else:
                item["content_translated"] = ""

        if not requests_map:
            return data

        # 3. DB 캐시 조회
        # WHERE (entity_type, entity_id, field, target_lang) IN (...)
        # Django ORM으로 tuple in query가 복잡하므로, 
        # 간단히 loop 돌며 확인커나, id list로 가져와서 메모리 필터링한다.
        # 여기선 간단히 쿼리 최적화보다 로직 정확성을 위해 '필요한 키' 목록을 순회하며 확인한다.
        # (서비스 규모가 커지면 IN 쿼리 최적화 필요)
        
        # 개선: 한번에 가져오기 위해 Q 객체 생성
        q_objs = Q()
        for (etype, eid, field, tlang) in requests_map.keys():
            q_objs |= Q(entity_type=etype, entity_id=eid, field=field, target_lang=tlang)
        
        cached_entries = TranslationEntry.objects.filter(q_objs)
        # Memory map for quick lookup
        entry_map = {
            (e.entity_type, e.entity_id, e.field, e.target_lang): e 
            for e in cached_entries
        }

        # 4. 캐시 없는 것들 분류 (API 호출 대상)
        api_call_texts = []
        api_call_keys = [] # 나중에 순서대로 매핑하기 위함

        for key, info in requests_map.items():
            entry = entry_map.get(key)
            if entry:
                # Cache Hit
                translated = entry.translated_text
                # Update Last Used
                # (성능상 bulk update가 좋지만 여기선 skip or simple update)
                # entry.last_used_at = timezone.now(); entry.save() # 생략 가능
                
                # Apply to items
                for (it, field_name) in info['consumers']:
                    it[field_name] = translated
            else:
                # Cache Miss -> API Call Needed
                api_call_texts.append(info['text'])
                api_call_keys.append(key)

        # 5. Batch API 호출 (한번만!)
        if api_call_texts:
            # source_lang은 item마다 다를 수 있지만, 
            # 현재 로직상 하나의 Batch 요청은 source_lang이 통일되어야 함.
            # 하지만 여기서는 '다국어 섞인 리스트'일 수 있음.
            # call_fastapi_translate_batch spec을 보면 source_lang을 하나만 받음.
            # 따라서 source_lang 별로 그룹핑해야 완벽함.
            # *Assumption*: 숏폼 리스트는 대부분 같은 언어(예: 한국어)일 확률이 높음.
            # 만약 섞여 있다면 그룹핑 로직이 필요.
            
            # 그룹핑 추가: (source_lang) -> list of keys
            batches_by_lang = {}
             # requests_map 순회하며 source_lang 확인 필요
             # 하지만 requests_map key에는 source_lang이 없음. 
             # -> item에서 가져와야 함. consumers[0]의 item을 참조.
            
            pending_keys = []
            
            # 재분류
            for key in api_call_keys:
                # Find source lang from one consumer
                # requests_map[key]['consumers'][0][0] is item
                item = requests_map[key]['consumers'][0][0]
                src = item.get("source_lang") or "kor_Hang"
                
                if src not in batches_by_lang:
                    batches_by_lang[src] = {'texts': [], 'keys': []}
                
                batches_by_lang[src]['texts'].append(requests_map[key]['text'])
                batches_by_lang[src]['keys'].append(key)

            # 각 언어별로 배치 호출
            new_entries = []
            
            for src_lang, batch_data in batches_by_lang.items():
                texts = batch_data['texts']
                keys = batch_data['keys']
                
                try:
                    translations, provider = call_fastapi_translate_batch(texts, src_lang, target_lang)
                except Exception as e:
                    logger.error(f"Batch translation error for {src_lang}->{target_lang}: {e}")
                    # 실패 시 원본 그대로 채움
                    translations = texts # Fallback to original
                    provider = "error_fallback"

                # 결과 매핑 및 DB 저장 준비
                for i, t_text in enumerate(translations):
                    if i >= len(keys): break
                    key = keys[i]
                    original_text = texts[i]
                    
                    # Apply to consumers
                    for (it, field_name) in requests_map[key]['consumers']:
                        it[field_name] = t_text
                    
                    if provider == "error_fallback":
                         # 번역 실패 시 캐시 저장하지 않음 (다음 요청 때 재시도)
                         continue

                    # Prepare Entry
                    (etype, eid, fld, tlang) = key
                    new_entries.append(TranslationEntry(
                        entity_type=etype,
                        entity_id=eid,
                        field=fld,
                        source_lang=src_lang,
                        target_lang=tlang,
                        source_hash=hashlib.sha256(original_text.encode("utf-8")).hexdigest(),
                        translated_text=t_text,
                        provider=provider,
                        model=os.getenv("HF_MODEL", "facebook/nllb-200-distilled-600M"),
                        last_used_at=timezone.now(),
                    ))

            # 6. Bulk Create
            if new_entries:
                TranslationEntry.objects.bulk_create(new_entries, ignore_conflicts=True)

        return data

    def list(self, request, *args, **kwargs):
        resp = super().list(request, *args, **kwargs)
        target_lang = request.query_params.get("lang")
        use_batch = request.query_params.get("batch", "true") == "true"
        
        if target_lang:
            try:
                if use_batch:
                    resp.data = self._apply_translation_batch(resp.data, target_lang)
                else:
                    resp.data = self._apply_translation_sequential(resp.data, target_lang)
            except Exception as e:
                logger.exception(f"Graceful handled: Error in translation (batch={use_batch}) during list")
        return resp

    def retrieve(self, request, *args, **kwargs):
        resp = super().retrieve(request, *args, **kwargs)
        target_lang = request.query_params.get("lang")
        use_batch = request.query_params.get("batch", "true") == "true"      

        if target_lang:
            try:
                if use_batch:
                    resp.data = self._apply_translation_batch(resp.data, target_lang)
                else:
                    resp.data = self._apply_translation_sequential(resp.data, target_lang)
            except Exception as e:
                logger.exception(f"Graceful handled: Error in translation (batch={use_batch}) during retrieve")
        return resp

    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        """
        POST: 좋아요 추가 (이미 좋아요면 그대로 유지)
        """
        shortform = self.get_object()
        try:
            user = get_action_user(request)
        except ValueError as e:
            raise exceptions.ValidationError({"detail": str(e)})

        obj, created = ShortformLike.objects.get_or_create(shortform=shortform, user=user)
        if created:
            Shortform.objects.filter(pk=shortform.pk).update(total_likes=F('total_likes') + 1)
            shortform.refresh_from_db(fields=['total_likes'])
        return Response({"liked": True, "total_likes": shortform.total_likes})

    @action(detail=True, methods=['delete'])
    def unlike(self, request, pk=None):
        """
        DELETE: 좋아요 취소 (없으면 무시)
        """
        shortform = self.get_object()
        try:
            user = get_action_user(request)
        except ValueError as e:
            raise exceptions.ValidationError({"detail": str(e)})

        deleted, _ = ShortformLike.objects.filter(shortform=shortform, user=user).delete()
        if deleted:
            Shortform.objects.filter(pk=shortform.pk, total_likes__gt=0).update(total_likes=F('total_likes') - 1)
            shortform.refresh_from_db(fields=['total_likes'])
        return Response({"liked": False, "total_likes": shortform.total_likes})

    @action(detail=True, methods=['get', 'post'])
    def comments(self, request, pk=None):
        """
        GET: 댓글 리스트
        POST: 댓글 작성 (superuser 작성자로 사용)
        """
        shortform = self.get_object()
        if request.method.lower() == 'get':
            comments = ShortformComment.objects.filter(shortform=shortform).order_by('-created_at')
            serializer = ShortformCommentSerializer(comments, many=True)
            return Response(serializer.data)

        # POST
        try:
            user = get_action_user(request)
        except ValueError as e:
            raise exceptions.ValidationError({"detail": str(e)})

        serializer = ShortformCommentSerializer(data=request.data)
        if serializer.is_valid():
            comment = serializer.save(shortform=shortform, user=user)
            Shortform.objects.filter(pk=shortform.pk).update(total_comments=F('total_comments') + 1)
            shortform.refresh_from_db(fields=['total_comments'])
            return Response(ShortformCommentSerializer(comment).data, status=201)

        return Response(serializer.errors, status=400)

    @action(detail=True, methods=['post'])
    def view(self, request, pk=None):
        """
        POST: 조회수 기록 (user 또는 ip 기준 중복 방지)
        """
        shortform = self.get_object()
        ip = request.META.get('REMOTE_ADDR')
        try:
            user = get_action_user(request)
        except ValueError:
            user = None  # superuser가 없을 때는 익명으로 기록

        if user:
            exists = ShortformView.objects.filter(
                shortform=shortform
            ).filter(Q(user=user) | Q(ip_address=ip)).exists()
        else:
            exists = ShortformView.objects.filter(shortform=shortform, ip_address=ip).exists()

        if not exists:
            ShortformView.objects.create(shortform=shortform, user=user, ip_address=ip)
            Shortform.objects.filter(pk=shortform.pk).update(total_views=F('total_views') + 1)
            shortform.refresh_from_db(fields=['total_views'])

        return Response({"viewed": True, "total_views": shortform.total_views})


class TranslationProxyView(APIView):
    """
    Django -> FastAPI 번역 프록시.
    1) TranslationEntry DB 캐시 조회
    2) 캐시 없으면 FastAPI 호출 후 DB 저장
    """
    permission_classes = [AllowAny]

    def post(self, request):
        text = request.data.get("text")
        source_lang = request.data.get("source_lang") or "kor_Hang"
        target_lang = request.data.get("target_lang") or "eng_Latn"
        entity_type = request.data.get("entity_type") or "raw"
        entity_id = request.data.get("entity_id") or 0
        field = request.data.get("field") or "text"

        if not text:
            return Response({"detail": "text is required"}, status=status.HTTP_400_BAD_REQUEST)

        entry = TranslationEntry.objects.filter(
            entity_type=entity_type,
            entity_id=entity_id,
            field=field,
            target_lang=target_lang,
        ).first()
        if entry:
            entry.last_used_at = timezone.now()
            entry.save(update_fields=["last_used_at"])
            return Response(
                {
                    "translated_text": entry.translated_text,
                    "cached": True,
                    "provider": entry.provider,
                    "model": entry.model,
                }
            )

        translated_text, provider = call_fastapi_translate(text, source_lang, target_lang)
        entry = TranslationEntry.objects.create(
            entity_type=entity_type,
            entity_id=entity_id,
            field=field,
            source_lang=source_lang,
            target_lang=target_lang,
            source_hash=hashlib.sha256(text.encode("utf-8")).hexdigest(),
            translated_text=translated_text,
            provider=provider or "fastapi",
            model=os.getenv("HF_MODEL", "facebook/nllb-200-distilled-600M"),
            last_used_at=timezone.now(),
        )

        return Response(
            {
                "translated_text": entry.translated_text,
                "cached": False,
                "provider": entry.provider,
                "model": entry.model,
            },
            status=status.HTTP_200_OK,
        )
        return Response(
            {
                "translated_text": entry.translated_text,
                "cached": False,
                "provider": entry.provider,
                "model": entry.model,
            },
            status=status.HTTP_200_OK,
        )


def call_fastapi_translate_batch(texts: list[str], source_lang: str, target_lang: str, timeout: int = 60):
    """
    FastAPI 배치 번역 엔드포인트 호출
    """
    payload = {
        "texts": texts,
        "source_lang": source_lang,
        "target_lang": target_lang,
    }
    
    url = f"{FASTAPI_TRANSLATE_URL.replace('/translate', '')}/translate/batch"
    
    # 1. 시도: Docker Internal URL
    # 로컬 개발 환경(Window/Mac Host)에서는 이 URL 접근 불가하여 TimeOut 발생 가능성 높음
    # 따라서 connect timeout을 짧게 설정하여 빠르게 Fallback으로 넘어가도록 함.
    try:
        # (connect timeout, read timeout)
        resp = requests.post(url, json=payload, timeout=(3, timeout))
        resp.raise_for_status()
        data = resp.json()
        return data.get("translations", []), data.get("provider", "fastapi-batch")
    except Exception as first_error:
        # 2. 시도: 로컬호스트 Fallback (Port 8003)
        # 만약 Docker DNS 해석 실패(NameResolutionError)나 연결 거부 시 로컬 포트로 재시도
        logger.warning(f"Primary translation URL failed ({url}): {first_error}. Retrying local fallback...")
        
        fallback_url = "http://127.0.0.1:8003/api/ai/translate/batch"
        try:
            resp = requests.post(fallback_url, json=payload, timeout=timeout)
            resp.raise_for_status()
            data = resp.json()
            logger.info(f"Fallback translation successful via {fallback_url}")
            return data.get("translations", []), data.get("provider", "fastapi-local-batch")
        except Exception as second_error:
            # Fallback도 실패하면 원래 에러 로깅
            logger.error(f"Fallback translation also failed: {second_error}")
            pass
        
        logger.error(f"Batch translation finally failed: {first_error}")
        raise exceptions.APIException(f"Translation service failed: {first_error}")


class TranslationBatchView(APIView):
    """
    배치 번역 프록시.
    1) 요청받은 텍스트 리스트 중 DB 캐시 확인
    2) 없는 것만 추려서 FastAPI Batch API 호출
    3) 결과 병합하여 반환
    """
    permission_classes = [AllowAny]

    def post(self, request):
        items = request.data.get("items", [])  # List of {text, entity_type, entity_id, field}
        source_lang = request.data.get("source_lang") or "kor_Hang"
        target_lang = request.data.get("target_lang") or "eng_Latn"

        if not items:
            return Response({"results": []})

        # 1. 캐시 조회
        results = {}  # index -> translated_text
        to_translate_indices = []
        to_translate_texts = []

        for idx, item in enumerate(items):
            text = item.get("text", "")
            if not text:
                results[idx] = ""
                continue

            # NEW: 소스 언어와 타겟 언어가 같으면 번역 건너뛰기
            src_lang = source_lang
            if src_lang == target_lang:
                results[idx] = text
                continue
            
            entity_type = item.get("entity_type", "raw")
            entity_id = item.get("entity_id", 0)
            field = item.get("field", "text")

            entry = TranslationEntry.objects.filter(
                entity_type=entity_type,
                entity_id=entity_id,
                field=field,
                target_lang=target_lang,
            ).first()

            if entry:
                # Cache hit
                entry.last_used_at = timezone.now()
                entry.save(update_fields=["last_used_at"])
                results[idx] = entry.translated_text
            else:
                # Cache miss
                to_translate_indices.append(idx)
                to_translate_texts.append(text)

        # 2. 외부 API 호출 (Batch)
        if to_translate_texts:
            translated_list, provider = call_fastapi_translate_batch(to_translate_texts, source_lang, target_lang)
            
            # 3. DB 저장 및 결과 매핑
            for internal_idx, translated_text in enumerate(translated_list):
                original_idx = to_translate_indices[internal_idx]
                original_item = items[original_idx]
                results[original_idx] = translated_text
                
                if provider == "error_fallback":
                    continue

                # DB Save
                TranslationEntry.objects.create(
                    entity_type=original_item.get("entity_type", "raw"),
                    entity_id=original_item.get("entity_id", 0),
                    field=original_item.get("field", "text"),
                    source_lang=source_lang,
                    target_lang=target_lang,
                    source_hash=hashlib.sha256(original_item.get("text").encode("utf-8")).hexdigest(),
                    translated_text=translated_text,
                    provider=provider,
                    model=os.getenv("HF_MODEL", "facebook/nllb-200-distilled-600M"),
                    last_used_at=timezone.now(),
                )

        # 4. 순서대로 정렬하여 반환
        final_list = [results.get(i, "") for i in range(len(items))]
        return Response({"translations": final_list})
