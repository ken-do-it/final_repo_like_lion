import os
import logging
import hashlib
import re
from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import exceptions, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticatedOrReadOnly, IsAuthenticated

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
        try:
            return super().create(request, *args, **kwargs)
        except Exception as e:
            import traceback
            logger.error(f"Shortform upload failed: {str(e)}")
            logger.error(traceback.format_exc())
            return Response(
                {"detail": "업로드 중 오류가 발생했습니다.", "error": str(e), "trace": traceback.format_exc()}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(
        summary="숏폼 목록 조회 (List Shortforms)",
        description="업로드된 숏폼 영상 목록을 조회합니다. `lang` 파라미터를 통해 실시간 번역된 결과를 받을 수 있습니다.",
        parameters=[
            OpenApiParameter(name='lang', description='타겟 언어 코드 (예: eng_Latn, jpn_Jpan)', required=False, type=str),
            OpenApiParameter(name='batch', description='배치 번역 사용 여부 (true/false) (기본값: true)', required=False, type=bool),
        ]
    )

    def _process_video_upload(self, video_file, serializer_instance=None):
        """
        [리팩토링] VideoService.process_video_pipeline으로 위임
        """
        # 제목/내용 추출 (언어 감지에 필요)
        if serializer_instance:
            title = self.request.data.get('title', serializer_instance.title)
            content = self.request.data.get('content', serializer_instance.content)
        else:
            title = self.request.data.get('title', '')
            content = self.request.data.get('content', '')
            
        # [서비스 레이어] 파이프라인 호출 (S3/로컬 하이브리드)
        return VideoService.process_video_pipeline(video_file, title=title, content=content)

    def perform_create(self, serializer):
        user = self.request.user
        if not user.is_authenticated:
            raise exceptions.NotAuthenticated("Authentication required to upload.")

        video_file = self.request.FILES.get('video_file') or serializer.validated_data.get('video_file')
        if not video_file:
            raise exceptions.ValidationError({"video_file": ["This field is required."]})

        # [Pipeline]
        video_data = self._process_video_upload(video_file)

        serializer.save(user=user, **video_data)

    def perform_update(self, serializer):
        user = self.request.user
        video_file = self.request.FILES.get('video_file')
        
        if video_file:
             # [Pipeline]
            video_data = self._process_video_upload(video_file, serializer_instance=self.get_object())
            serializer.save(**video_data)
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
        try:
            queryset = self.get_queryset()

            # [Performance] N+1 Query Fix (is_liked)
            if request.user.is_authenticated:
                from django.db.models import OuterRef, Exists
                is_liked_subquery = ShortformLike.objects.filter(
                    shortform=OuterRef('pk'), 
                    user=request.user
                )
                queryset = queryset.annotate(is_liked_val=Exists(is_liked_subquery))

            queryset = self.filter_queryset(queryset)

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

            # [필터] 검색어 (q)
            q_param = request.query_params.get("q")
            if q_param:
                queryset = queryset.filter(
                    Q(title__icontains=q_param) | 
                    Q(content__icontains=q_param) |
                    Q(location__icontains=q_param)
                )

            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                resp_data = serializer.data
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

        except Exception as e:
            logger.exception("ShortformViewSet.list에서 예기치 않은 오류")
            # 500 대신 읽기 가능한 에러 메시지 반환 (디버깅용)
            return Response(
                {"detail": "Internal Server Error during shortform list fetch.", "error": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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
        
        # 네비게이션: 이전/다음 ID (전역 범위, ID/시간 순 정렬)
        instance = self.get_object()
        
        # 이전 (더 오래된): 현재 ID보다 작음, ID 내림차순 (가장 가까운 작은 값)
        prev_obj = Shortform.objects.filter(id__lt=instance.id).order_by('-id').first()
        
        # 다음 (더 최신): 현재 ID보다 큼, ID 오름차순 (가장 가까운 큰 값)
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
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def like(self, request, pk=None):
        # IsOwnerOrReadOnly 권한 검사를 우회하기 위해 get_object() 대신 직접 조회
        shortform = get_object_or_404(Shortform, pk=pk)
        user = request.user

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
    @action(detail=True, methods=['delete'], permission_classes=[IsAuthenticated])
    def unlike(self, request, pk=None):
        # IsOwnerOrReadOnly 권한 검사를 우회하기 위해 get_object() 대신 직접 조회
        shortform = get_object_or_404(Shortform, pk=pk)
        user = request.user

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
    @action(detail=True, methods=['get', 'post'], permission_classes=[IsAuthenticatedOrReadOnly])
    def comments(self, request, pk=None):
        # IsOwnerOrReadOnly 권한 검사를 우회하기 위해 get_object() 대신 직접 조회
        shortform = get_object_or_404(Shortform, pk=pk)
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
        # IsOwnerOrReadOnly 권한 검사를 우회하기 위해 get_object() 대신 직접 조회
        shortform = get_object_or_404(Shortform, pk=pk)

        # [개인정보] IP 주소 해싱 (SHA-256 + Base64)
        raw_ip = request.META.get('REMOTE_ADDR', '')
        if raw_ip:
            # 해시 생성 (SHA-256) 후 Base64 인코딩하여 길이 단축 (44자)
            import base64
            hashed_bytes = hashlib.sha256(raw_ip.encode('utf-8')).digest()
            ip_hash = base64.b64encode(hashed_bytes).decode('utf-8')
        else:
            ip_hash = None

        user = request.user if request.user.is_authenticated else None
        
        if user:
            exists = ShortformView.objects.filter(shortform=shortform).filter(Q(user=user) | Q(ip_address=ip_hash)).exists()
        else:
            exists = ShortformView.objects.filter(shortform=shortform, ip_address=ip_hash).exists()

        if not exists:
            ShortformView.objects.create(shortform=shortform, user=user, ip_address=ip_hash)
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

    def perform_update(self, serializer):
        comment = serializer.save()
        
        # [번역] 최신 번역 보장을 위한 캐시 무효화
        # TranslationService에 해시 기반 자가 치유(Self-Healing) 기능이 있지만,
        # 수정 작업(Modify) 시에는 명시적으로 무효화하는 것이 좋은 습관임.
        # 어떤 필드가 캐시되었는지 알아야 함(주로 "content").
        # 그리고 리스트 조회 시 사용된 entity_type을 알아야 함.
        # 보통 "shortform_comment"(올바르게 구현된 경우) 또는 "shortform"(레거시).
        # 안전하게 둘 다 무효화 처리.
        
        TranslationService.invalidate_cache("shortform", comment.id) 
        TranslationService.invalidate_cache("shortform_comment", comment.id)
        
        content = serializer.validated_data.get('content', '')
        if content:
             detected_lang = TranslationService.detect_language(content)
             serializer.save(source_lang=detected_lang)


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

        # [Security] Whitelist Validation
        ALLOWED_ENTITY_TYPES = [
            'shortform', 'shortform_comment', 'review', 'raw',
            'place', 'place_name', 'place_address', 'place_category', 'place_opening_hours', 'place_desc',
            'local_column', 'local_column_section'
        ]
        if entity_type not in ALLOWED_ENTITY_TYPES:
            return Response(
                {"detail": f"Invalid entity_type. Allowed: {ALLOWED_ENTITY_TYPES}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

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
            
            # 모델명 결정 로직
            model_name = TranslationService._get_current_model_name()

            # 여기서 수동으로 저장
            TranslationEntry.objects.create(
                entity_type=entity_type, entity_id=entity_id, field=field,
                source_lang=source_lang, target_lang=target_lang,
                source_hash=hashlib.sha256(text.encode("utf-8")).hexdigest(),
                translated_text=translated_text, provider=provider,
                model=model_name,
                last_used_at=timezone.now(),
            )
            
            return Response({
                "translated_text": translated_text,
                "cached": False,
                "provider": provider,
                "model": model_name,
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
        
        print(f"DEBUG: Batch Request Items: {len(items)}, Src: {source_lang}, Tgt: {target_lang}", flush=True)

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
                
            # [수정] "고정된" 언어 문제 해결
            # source_lang이 기본값(kor_Hang)이지만 텍스트가 실제로는 영어/일본어인 경우,
            # source == target 체크로 인해 번역을 건너뛰고 잘못된 언어를 반환하게 됩니다.
            # 해결: 언어를 감지하거나 확신할 수 없는 경우 불일치로 가정합니다.
            # 이상적으로는 허용되는 경우 TranslationService가 자동 감지를 처리하도록 합니다.
            # 여기서는 실제 소스 언어가 다른 것 같으면 감지를 시도합니다.
            
            real_source_lang = source_lang
            if source_lang == "kor_Hang": # 기본/하드코딩된 소스를 사용하는 경우에만
                try:
                    detected = TranslationService.detect_language(text)
                    if detected and detected != "und":
                        real_source_lang = detected
                except:
                    pass
            
            # 최적화 확인
            if real_source_lang == target_lang:
                results[idx] = text
                continue
            
            entity_type = item.get("entity_type", "raw")
            entity_id = item.get("entity_id", 0)
            field = item.get("field", "text")

            # [보안] 허용 목록 검증 (유효하지 않은 항목은 안전하게 건너뜀)
            ALLOWED_ENTITY_TYPES = [
                'shortform', 'shortform_comment', 'review', 'raw',
                'place', 'place_name', 'place_address', 'place_category', 'place_opening_hours', 'place_desc',
                'local_column', 'local_column_section'
            ]
            if entity_type not in ALLOWED_ENTITY_TYPES:
                logger.warning(f"배치 내 유효하지 않은 entity_type 건너뜀: {entity_type}")
                results[idx] = text # 번역/캐싱 없이 원본 텍스트 반환
                continue
            
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
            print(f"DEBUG: Calling API for {len(to_translate_texts)} texts via Parallel Chunks", flush=True)
            
            import concurrent.futures
            
            # Helper for parallel processing
            def process_view_chunk(chunk_texts, indices):
                try:
                    t_list, provider = TranslationService.call_fastapi_translate_batch(chunk_texts, source_lang, target_lang)
                    return t_list, indices, provider
                except Exception as e:
                    logger.error(f"View Chunk Error: {e}")
                    # 실패 시 원본 그대로 리턴
                    return chunk_texts, indices, "error_fallback"

            BATCH_SIZE = 15
            
            # Chunking
            futures = []
            results_map = {} # buffer

            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                for i in range(0, len(to_translate_texts), BATCH_SIZE):
                    chunk_texts = to_translate_texts[i:i + BATCH_SIZE]
                    # Pass internal indices [i, i+1, ...] to map back result
                    chunk_internal_indices = list(range(i, min(i + BATCH_SIZE, len(to_translate_texts))))
                    
                    futures.append(executor.submit(process_view_chunk, chunk_texts, chunk_internal_indices))
                
                for future in concurrent.futures.as_completed(futures):
                    t_list, internal_indices, provider = future.result()
                    
                    # 모델명 결정 (한 번만 하면 되지만 loop 안에서 안전하게)
                    model_name = TranslationService._get_current_model_name()
                    
                    # 결과 처리
                    for k, t_text in enumerate(t_list):
                        if k >= len(internal_indices): break
                        internal_idx = internal_indices[k]
                        
                        # Set to results dict
                        original_idx = to_translate_indices[internal_idx]
                        results[original_idx] = t_text
                        
                        # Cache Saving Validations
                        is_bad_translation = False
                        source_text = to_translate_texts[internal_idx]

                        # Rule 1: Identity Match
                        if t_text.strip() == source_text.strip():
                             is_bad_translation = True

                        # Rule 2: Hangul in Target (for non-Korean targets)
                        if target_lang in ['eng_Latn', 'jpn_Jpan', 'zho_Hans', 'zho_Hant']:
                             if re.search(r'[\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f]', t_text):
                                 is_bad_translation = True

                        # 규칙 3: 영어 내의 CJK/가나 (영어 번역에 한자/일본어 포함 시)
                        if target_lang == 'eng_Latn':
                             # CJK Unified Ideographs + Hiragana/Katakana
                             if re.search(r'[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff]', t_text):
                                 is_bad_translation = True

                        if provider != "error_fallback" and not is_bad_translation:
                            original_item = items[original_idx]
                            try:
                                TranslationEntry.objects.create(
                                    entity_type=original_item.get("entity_type", "raw"),
                                    entity_id=original_item.get("entity_id", 0),
                                    field=original_item.get("field", "text"),
                                    source_lang=source_lang, target_lang=target_lang,
                                    source_hash=hashlib.sha256(to_translate_texts[internal_idx].encode("utf-8")).hexdigest(),
                                    translated_text=t_text, provider=provider,
                                    model=model_name,
                                    last_used_at=timezone.now(),
                                )
                            except Exception as e:
                                logger.error(f"Cache Save Error: {e}") # 중복 등으로 인한 실패 무시
                        elif is_bad_translation:
                            logger.warning(f"Skipping Cache for Bad Translation: '{t_text}' (Target: {target_lang})")

        return Response({"results": results})
