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

# Service Layer Imports
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

    def perform_create(self, serializer):
        user = self.request.user
        if not user.is_authenticated:
            raise exceptions.NotAuthenticated("Authentication required to upload.")

        video_file = self.request.FILES.get('video_file') or serializer.validated_data.get('video_file')
        if not video_file:
            raise exceptions.ValidationError({"video_file": ["This field is required."]})

        # [Service Layer] Video Processing
        saved_path, saved_url = VideoService.save_video_file(video_file)
        
        # VideoService creates absolute path internally for its methods, but extract_metadata needs full path
        from django.core.files.storage import default_storage
        abs_path = default_storage.path(saved_path)
        
        meta = VideoService.extract_metadata(abs_path)
        thumb_path, thumb_url = VideoService.generate_thumbnail(abs_path)

        # [Service Layer] Language Detection
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
            # [Service Layer] Video Processing
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

        # [Service Layer] Cache Invalidation
        TranslationService.invalidate_cache("shortform", self.get_object().id)

    def list(self, request, *args, **kwargs):
        resp = super().list(request, *args, **kwargs)
        target_lang = request.query_params.get("lang")
        use_batch = request.query_params.get("batch", "true") == "true"
        
        if target_lang:
            try:
                # [Service Layer] Apply Translation
                if use_batch:
                    resp.data = TranslationService.apply_translation_batch(resp.data, target_lang)
                else:
                    resp.data = TranslationService.apply_translation_sequential(resp.data, target_lang)
            except Exception as e:
                logger.exception(f"Graceful handled: Error in translation (batch={use_batch}) during list")
        return resp

    def retrieve(self, request, *args, **kwargs):
        resp = super().retrieve(request, *args, **kwargs)
        target_lang = request.query_params.get("lang")
        use_batch = request.query_params.get("batch", "true") == "true"      

        if target_lang:
            try:
                # [Service Layer] Apply Translation
                if use_batch:
                    resp.data = TranslationService.apply_translation_batch(resp.data, target_lang)
                else:
                    resp.data = TranslationService.apply_translation_sequential(resp.data, target_lang)
            except Exception as e:
                logger.exception(f"Graceful handled: Error in translation (batch={use_batch}) during retrieve")
        return resp

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

    @action(detail=True, methods=['get', 'post'])
    def comments(self, request, pk=None):
        shortform = self.get_object()
        if request.method.lower() == 'get':
            comments = ShortformComment.objects.filter(shortform=shortform).order_by('-created_at')
            serializer = ShortformCommentSerializer(comments, many=True)
            return Response(serializer.data)

        if not request.user.is_authenticated:
            raise exceptions.NotAuthenticated("Authentication required to comment.")
        
        user = request.user
        serializer = ShortformCommentSerializer(data=request.data)
        if serializer.is_valid():
            comment = serializer.save(shortform=shortform, user=user)
            Shortform.objects.filter(pk=shortform.pk).update(total_comments=F('total_comments') + 1)
            shortform.refresh_from_db(fields=['total_comments'])
            return Response(ShortformCommentSerializer(comment).data, status=201)

        return Response(serializer.errors, status=400)

    @action(detail=True, methods=['post'])
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

        # Service Layer Logic: Check Cache first
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
            # Service should ideally handle saving, but TranslationService.call_fastapi_translate only returns text.
            # However, `TranslationService._translate_field_single` handles saving but strictly for Shortform.
            # We can replicate standard saving here or add a `translate_and_save_generic` to Service.
            # For now, explicit save here is fine or we can use existing utility if I moved it.
            # Wait, `translate_and_cache` was removed from views.py.
            
            # Let's save it here manually as before, but cleaner.
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
        
        # This view is complex to fully refactor 100% into Service without changing interface.
        # But we can reuse the heaviest part: the batch API call.
        
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
            
            # Cache Check
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
                # Use Service for API call
                translated_list, provider = TranslationService.call_fastapi_translate_batch(to_translate_texts, source_lang, target_lang)
                
                for internal_idx, translated_text in enumerate(translated_list):
                    original_idx = to_translate_indices[internal_idx]
                    results[original_idx] = translated_text
                    
                    original_item = items[original_idx]
                    
                    # Save Cache
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
