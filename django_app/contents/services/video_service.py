import os
import uuid
import json
import subprocess
import logging
from shutil import which
from django.core.files.storage import default_storage

logger = logging.getLogger(__name__)

class VideoService:
    @staticmethod
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

    @staticmethod
    def save_video_file(uploaded_file):
        """
        업로드된 파일을 로컬 MEDIA_ROOT 아래에 저장하고, 저장된 URL을 반환한다.
        """
        ext = os.path.splitext(uploaded_file.name)[1] or '.mp4'
        filename = f"{uuid.uuid4()}{ext}"
        saved_path = default_storage.save(os.path.join('shortforms', 'videos', filename), uploaded_file)
        saved_url = default_storage.url(saved_path)
        return saved_path, saved_url

    @staticmethod
    def extract_metadata(file_path):
        """
        ffprobe를 사용해 영상 메타데이터를 추출한다.
        반환: dict(duration, width, height) / 실패 시 {}
        """
        ffprobe_bin = VideoService.resolve_bin("ffprobe", "FFPROBE_BIN")
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

    @staticmethod
    def generate_thumbnail(file_path):
        """
        ffmpeg로 썸네일(첫 1초 부근 프레임)을 생성한다.
        반환: (relative_path, url) / 실패 시 (None, None)
        """
        ffmpeg_bin = VideoService.resolve_bin("ffmpeg", "FFMPEG_BIN")
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
