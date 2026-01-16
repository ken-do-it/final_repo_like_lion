import os
import logging
import hashlib
from django.db.models import F, Q
from django.utils import timezone
from rest_framework import exceptions, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticatedOrReadOnly

from .models import Shortform, ShortformLike, ShortformComment, ShortformView, TranslationEntry
from .serializers import ShortformSerializer, ShortformCommentSerializer
from .permissions import IsOwnerOrReadOnly

from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes

# 서비스 레이어 임포트
from .services.video_service import VideoService
from .services.translation_service import TranslationService

logger = logging.getLogger(__name__)

class ShortformViewSet(viewsets.ModelViewSet):
    """
    list/retrieve/create 숏폼 처리.
    비지니스 로직은 Service Layer로 위임됨.
    """
    queryset = Shortform.objects.order_by('-created_at')
    serializer_class = ShortformSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    @extend_schema(
        summary="숏폼 업로드 (Create Shortform)",
        description="동영상 파일을 업로드하면 자동으로 메타데이터(길이, 크기)를 추출하고 썸네일을 생성하며, 제목/내용의 언어를 감지하여 저장합니다.",
        request={
            'multipart/form-data': {
                'type': 'object',
                'properties': {
                    'video_file': {'type': 'string', 'format': 'binary'},
                    'title': {'type': 'string'},
                    'content': {'type': 'string'},
                    'visibility': {'type': 'string', 'enum': ['PUBLIC', 'PRIVATE', 'UNLISTED']}
                },
                'required': ['video_file']
            }
        },
        responses={201: ShortformSerializer}
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @extend_schema(
        summary="숏폼 목록 조회 (List Shortforms)",
        description="업로드된 숏폼 영상 목록을 조회합니다. `lang` 파라미터를 통해 실시간 번역된 결과를 받을 수 있습니다.",
        parameters=[
            OpenApiParameter(name='lang', description='타겟 언어 코드 (예: eng_Latn, jpn_Jpan)', required=False, type=str),
            OpenApiParameter(name='batch', description='배치 번역 사용 여부 (true/false) (기본값: true)', required=False, type=bool),
        ]
    )

    def perform_create(self, serializer):
        user = self.request.user
        if not user.is_authenticated:
            raise exceptions.NotAuthenticated("Authentication required to upload.")

        video_file = self.request.FILES.get('video_file') or serializer.validated_data.get('video_file')
        if not video_file:
            raise exceptions.ValidationError({"video_file": ["This field is required."]})

        # [서비스 레이어] 비디오 처리
        saved_path, saved_url = VideoService.save_video_file(video_file)
        
        # VideoService는 내부적으로 절대 경로를 생성하지만, extract_metadata는 전체 경로가 필요함
        from django.core.files.storage import default_storage
        abs_path = default_storage.path(saved_path)
        
        meta = VideoService.extract_metadata(abs_path)
        thumb_path, thumb_url = VideoService.generate_thumbnail(abs_path)

        # [서비스 레이어] 언어 감지
        title = serializer.validated_data.get('title', '')
        content = serializer.validated_data.get('content', '')
        full_text = f"{title} {content}".strip()
        detected_lang = TranslationService.detect_language(full_text)

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

    def perform_update(self, serializer):
        user = self.request.user
        video_file = self.request.FILES.get('video_file')
        
        if video_file:
            # [서비스 레이어] 비디오 처리
            saved_path, saved_url = VideoService.save_video_file(video_file)
            from django.core.files.storage import default_storage
            abs_path = default_storage.path(saved_path)
            
            meta = VideoService.extract_metadata(abs_path)
            thumb_path, thumb_url = VideoService.generate_thumbnail(abs_path)

            title = serializer.validated_data.get('title', self.get_object().title)
            content = serializer.validated_data.get('content', self.get_object().content)
            full_text = f"{title} {content}".strip()
            detected_lang = TranslationService.detect_language(full_text)

            serializer.save(
                video_url=saved_url,
                file_size=video_file.size,
                duration=meta.get("duration"),
                width=meta.get("width"),
                height=meta.get("height"),
                thumbnail_url=thumb_url,
                source_lang=detected_lang,
            )
        else:
            title = serializer.validated_data.get('title')
            content = serializer.validated_data.get('content')
            
            if title is not None or content is not None:
                current = self.get_object()
                t = title if title is not None else current.title
                c = content if content is not None else current.content
                full_text = f"{t} {c}".strip()
                detected_lang = TranslationService.detect_language(full_text)
                serializer.save(source_lang=detected_lang)
            else:
                serializer.save()

        # [서비스 레이어] 캐시 무효화
        TranslationService.invalidate_cache("shortform", self.get_object().id)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        # [필터] 작성자 (사용자)
        writer_param = request.query_params.get("writer")
        if writer_param:
            if writer_param == 'me':
                if request.user.is_authenticated:
                    queryset = queryset.filter(user=request.user)
                else:
                    raise exceptions.NotAuthenticated("Authentication required to filter by 'me'.")
            else:
                try:
                    queryset = queryset.filter(user_id=int(writer_param))
                except ValueError:
                    pass # 잘못된 ID는 무시

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            resp_data = serializer.data
            # DRF 설정에 따라 페이지네이션 응답 구조 처리가 필요할 수 있음
            # 하지만 나중에 resp.data를 수정하는 기존 패턴을 따름
        else:
            serializer = self.get_serializer(queryset, many=True)
            resp_data = serializer.data

        # 기존 번역 로직
        target_lang = request.query_params.get("lang")
        use_batch = request.query_params.get("batch", "true") == "true"
        
        if target_lang:
            try:
                # [서비스 레이어] 번역 적용
                if use_batch:
                    resp_data = TranslationService.apply_translation_batch(resp_data, target_lang)
                else:
                    resp_data = TranslationService.apply_translation_sequential(resp_data, target_lang)
            except Exception as e:
                logger.exception(f"Graceful handled: Error in translation (batch={use_batch}) during list")
        
        if page is not None:
            return self.get_paginated_response(resp_data)
        
        return Response(resp_data)

    @extend_schema(
        summary="숏폼 상세 조회 (Retrieve Shortform)",
        description="특정 숏폼의 상세 정보를 조회합니다. `lang` 파라미터로 번역된 제목/내용을 요청할 수 있습니다.",
        parameters=[
            OpenApiParameter(name='lang', description='타겟 언어 코드 (예: eng_Latn)', required=False, type=str),
            OpenApiParameter(name='batch', description='배치 번역 사용 여부 (true/false)', required=False, type=bool),
        ]
    )
    def retrieve(self, request, *args, **kwargs):
        resp = super().retrieve(request, *args, **kwargs)
        target_lang = request.query_params.get("lang")
        use_batch = request.query_params.get("batch", "true") == "true"      
        
        if target_lang:
            try:
                # [서비스 레이어] 번역 적용
                if use_batch:
                    resp.data = TranslationService.apply_translation_batch(resp.data, target_lang)
                else:
                    resp.data = TranslationService.apply_translation_sequential(resp.data, target_lang)
            except Exception as e:
                logger.exception(f"Graceful handled: Error in translation (batch={use_batch}) during retrieve")
        
        # Navigation: Prev/Next ID (Global scope, ordered by ID/Time)
        instance = self.get_object()
        
        # Previous (Older): ID smaller than current, order by ID desc (closest smaller)
        prev_obj = Shortform.objects.filter(id__lt=instance.id).order_by('-id').first()
        
        # Next (Newer): ID larger than current, order by ID asc (closest larger)
        next_obj = Shortform.objects.filter(id__gt=instance.id).order_by('id').first()

        resp.data['prev_id'] = prev_obj.id if prev_obj else None
        resp.data['next_id'] = next_obj.id if next_obj else None

        return resp

    @extend_schema(
        summary="좋아요 (Like)",
        description="숏폼 영상에 좋아요를 누릅니다. (중복 방지됨)",
        request=None,
        responses={200: {'type': 'object', 'properties': {'liked': {'type': 'boolean'}, 'total_likes': {'type': 'integer'}}}}
    )
    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        shortform = self.get_object()
        user = request.user
        if not user.is_authenticated:
            raise exceptions.NotAuthenticated("Authentication required to like.")

        obj, created = ShortformLike.objects.get_or_create(shortform=shortform, user=user)
        if created:
            Shortform.objects.filter(pk=shortform.pk).update(total_likes=F('total_likes') + 1)
            shortform.refresh_from_db(fields=['total_likes'])
        return Response({"liked": True, "total_likes": shortform.total_likes})

    @extend_schema(
        summary="좋아요 취소 (Unlike)",
        description="좋아요를 취소합니다.",
        responses={200: {'type': 'object', 'properties': {'liked': {'type': 'boolean'}, 'total_likes': {'type': 'integer'}}}}
    )
    @action(detail=True, methods=['delete'])
    def unlike(self, request, pk=None):
        shortform = self.get_object()
        user = request.user
        if not user.is_authenticated:
            raise exceptions.NotAuthenticated("Authentication required to unlike.")

        deleted, _ = ShortformLike.objects.filter(shortform=shortform, user=user).delete()
        if deleted:
            Shortform.objects.filter(pk=shortform.pk, total_likes__gt=0).update(total_likes=F('total_likes') - 1)
            shortform.refresh_from_db(fields=['total_likes'])
        return Response({"liked": False, "total_likes": shortform.total_likes})

    @extend_schema(
        summary="댓글 목록/작성 (Comments)",
        description="GET: 댓글 목록 조회\nPOST: 새 댓글 작성",
        responses={200: ShortformCommentSerializer(many=True)}
    )
    @action(detail=True, methods=['get', 'post'])
    def comments(self, request, pk=None):
        shortform = self.get_object()
        if request.method.lower() == 'get':
            comments = ShortformComment.objects.filter(shortform=shortform).order_by('-created_at')
            serializer = ShortformCommentSerializer(comments, many=True)
            data = serializer.data

            # 번역 적용
            target_lang = request.query_params.get("lang")
            use_batch = request.query_params.get("batch", "true") == "true"
            if target_lang:
                try:
                    if use_batch:
                        data = TranslationService.apply_translation_batch(data, target_lang)
                    else:
                        data = TranslationService.apply_translation_sequential(data, target_lang)
                except Exception as e:
                    logger.exception(f"Comment translation failed: {e}")

            return Response(data)

        if not request.user.is_authenticated:
            raise exceptions.NotAuthenticated("Authentication required to comment.")
        
        user = request.user
        serializer = ShortformCommentSerializer(data=request.data)
        if serializer.is_valid():
            content = serializer.validated_data.get('content', '')
            detected_lang = TranslationService.detect_language(content)
            
            comment = serializer.save(shortform=shortform, user=user, source_lang=detected_lang)
            
            Shortform.objects.filter(pk=shortform.pk).update(total_comments=F('total_comments') + 1)
            shortform.refresh_from_db(fields=['total_comments'])
            return Response(ShortformCommentSerializer(comment).data, status=201)

        return Response(serializer.errors, status=400)

    @extend_schema(
        summary="조회수 증가 (View Count)",
        description="숏폼 조회수를 1 증가시킵니다. (user/ip 기준 중복 체크)",
        request=None,
        responses={200: {'type': 'object', 'properties': {'viewed': {'type': 'boolean'}, 'total_views': {'type': 'integer'}}}}
    )
    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def view(self, request, pk=None):
        shortform = self.get_object()
        ip = request.META.get('REMOTE_ADDR')
        user = request.user if request.user.is_authenticated else None
        
        if user:
            exists = ShortformView.objects.filter(shortform=shortform).filter(Q(user=user) | Q(ip_address=ip)).exists()
        else:
            exists = ShortformView.objects.filter(shortform=shortform, ip_address=ip).exists()

        if not exists:
            ShortformView.objects.create(shortform=shortform, user=user, ip_address=ip)
            Shortform.objects.filter(pk=shortform.pk).update(total_views=F('total_views') + 1)
            shortform.refresh_from_db(fields=['total_views'])

        return Response({"viewed": True, "total_views": shortform.total_views})



class ShortformCommentViewSet(viewsets.ModelViewSet):
    """
    댓글 개별 수정/삭제 (Update/Delete Comment)
    """
    queryset = ShortformComment.objects.order_by('-created_at')
    serializer_class = ShortformCommentSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        
        # 필터링 (예: 특정 Shortform의 댓글만) - 이미 router nested나 filter_backends로 처리될 수 있음
        # 하지만 현재 url 구조상 /shortforms/{pk}/comments/ 로 접근하므로, 
        # views.py 의 ShortformViewSet.comments 액션과 겹칠 수 있음.
        # 하지만 User Request는 "이제 댓글 기능 연결하자" 였고, 
        # ShortformViewSet.comments 액션을 사용하고 있을 가능성이 높음.
        # 확인 필요: Frontend는 `/shortforms/${id}/comments/` 를 호출함.
        # 이는 ShortformViewSet 의 comments 액션임. 
        # 따라서 ShortformViewSet.comments 를 수정해야 함!
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def perform_destroy(self, instance):
        # 댓글 삭제 시 카운터 감소
        shortform = instance.shortform
        super().perform_destroy(instance)
        # update total_comments using F expression to avoid race conditions
        Shortform.objects.filter(pk=shortform.pk, total_comments__gt=0).update(total_comments=F('total_comments') - 1)


class TranslationProxyView(APIView):
    """
    Django -> FastAPI 번역 프록시.
    Service Layer를 사용하여 로직 단순화.
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

        # [서비스 레이어] 로직: 캐시 먼저 확인
        entry = TranslationEntry.objects.filter(
            entity_type=entity_type, entity_id=entity_id, field=field, target_lang=target_lang
        ).first()
        
        if entry:
            return Response({
                "translated_text": entry.translated_text,
                "cached": True,
                "provider": entry.provider,
                "model": entry.model,
            })

        try:
            translated_text, provider = TranslationService.call_fastapi_translate(text, source_lang, target_lang)
            # 서비스는 저장을 처리해야 하지만, TranslationService.call_fastapi_translate는 텍스트만 반환함.
            # 하지만 `TranslationService._translate_field_single`은 Shortform에 대해 저장을 처리함.
            # 여기서 표준 저장을 복제하거나 서비스에 `translate_and_save_generic`을 추가할 수 있음.
            # 일단은 여기서 수동으로 명시적 저장을 함.
            
            # 여기서 수동으로 저장
            TranslationEntry.objects.create(
                entity_type=entity_type, entity_id=entity_id, field=field,
                source_lang=source_lang, target_lang=target_lang,
                source_hash=hashlib.sha256(text.encode("utf-8")).hexdigest(),
                translated_text=translated_text, provider=provider,
                model=os.getenv("HF_MODEL", "facebook/nllb-200-distilled-600M"),
                last_used_at=timezone.now(),
            )
            
            return Response({
                "translated_text": translated_text,
                "cached": False,
                "provider": provider,
                "model": "facebook/nllb-200-distilled-600M",
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TranslationBatchView(APIView):
    """
    배치 번역 프록시.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        items = request.data.get("items", [])
        source_lang = request.data.get("source_lang") or "kor_Hang"
        target_lang = request.data.get("target_lang") or "eng_Latn"

        if not items: return Response({"results": {}})
        
        # 이 뷰는 인터페이스를 변경하지 않고 서비스로 100% 리팩토링하기 복잡함.
        # 하지만 가장 무거운 부분인 배치 API 호출은 재사용 가능함.
        
        results = {}
        to_translate_indices = []
        to_translate_texts = []
        
        for idx, item in enumerate(items):
            text = item.get("text", "")
            if not text:
                results[idx] = ""
                continue
            if source_lang == target_lang:
                results[idx] = text
                continue
            
            entity_type = item.get("entity_type", "raw")
            entity_id = item.get("entity_id", 0)
            field = item.get("field", "text")
            
            # 캐시 확인
            entry = TranslationEntry.objects.filter(
                entity_type=entity_type, entity_id=entity_id, field=field, target_lang=target_lang
            ).first()

            if entry:
                results[idx] = entry.translated_text
            else:
                to_translate_indices.append(idx)
                to_translate_texts.append(text)
        
        if to_translate_texts:
            try:
                # API 호출을 위해 서비스 사용
                translated_list, provider = TranslationService.call_fastapi_translate_batch(to_translate_texts, source_lang, target_lang)
                
                for internal_idx, translated_text in enumerate(translated_list):
                    original_idx = to_translate_indices[internal_idx]
                    results[original_idx] = translated_text
                    
                    original_item = items[original_idx]
                    
                    # 캐시 저장
                    TranslationEntry.objects.create(
                        entity_type=original_item.get("entity_type", "raw"),
                        entity_id=original_item.get("entity_id", 0),
                        field=original_item.get("field", "text"),
                        source_lang=source_lang, target_lang=target_lang,
                        source_hash=hashlib.sha256(to_translate_texts[internal_idx].encode("utf-8")).hexdigest(),
                        translated_text=translated_text, provider=provider,
                        model=os.getenv("HF_MODEL", "facebook/nllb-200-distilled-600M"),
                        last_used_at=timezone.now(),
                    )
            except Exception as e:
                logger.error(f"Batch proxy failed: {e}")
        
        return Response({"results": results})
