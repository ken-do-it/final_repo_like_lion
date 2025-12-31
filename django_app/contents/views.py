import os
import uuid
import json
import subprocess
import logging
from shutil import which
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.db.models import F, Q
from rest_framework import parsers, exceptions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Shortform, ShortformLike, ShortformComment, ShortformView
from .serializers import ShortformSerializer, ShortformCommentSerializer

logger = logging.getLogger(__name__)


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

# 2 인증 연동 전까지는 모든 작성자/소유자를 superuser로 처리
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


def save_video_file(uploaded_file):
    """
    업로드된 파일을 로컬 MEDIA_ROOT 아래에 저장하고, 저장된 URL을 반환한다.
    매개변수:
      - uploaded_file: request.FILES에서 받은 UploadedFile
    반환:
        - saved_path: 저장된 상대 경로 (예: shortforms/videos/<uuid>.mp4)
        - saved_url: MEDIA_URL을 포함한 접근 가능한 URL (예: /media/shortforms/videos/<uuid>.mp4)
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
    TODO: ffprobe 미설치 시 로그만 남기고 빈 dict 반환.
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

        serializer.save(
            user=user,
            video_url=saved_url,
            file_size=video_file.size,
            duration=meta.get("duration"),
            width=meta.get("width"),
            height=meta.get("height"),
            thumbnail_url=thumb_url,
        )

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
