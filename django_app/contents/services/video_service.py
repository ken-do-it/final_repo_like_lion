import os
import uuid
import json
import subprocess
import logging
import tempfile
from shutil import which
from django.core.files.storage import default_storage
from django.core.files import File

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
    def process_video(uploaded_file):
        """
        S3 호환 비디오 처리 파이프라인
        1. 임시 파일로 저장 (FFprobe/FFmpeg 처리를 위해)
        2. 메타데이터 추출
        3. 썸네일 생성
        4. 원본 및 썸네일 S3(또는 로컬) 업로드
        5. 임시 파일 정리
        반환: dict(video_url, thumbnail_url, metadata...)
        """
        # 1. 임시 디렉토리에 파일 저장
        with tempfile.NamedTemporaryFile(suffix=os.path.splitext(uploaded_file.name)[1], delete=False) as temp_video:
            for chunk in uploaded_file.chunks():
                temp_video.write(chunk)
            temp_video_path = temp_video.name

        results = {}
        temp_thumb_path = None

        try:
            # 2. 메타데이터 추출 (로컬 임시 파일 사용)
            metadata = VideoService.extract_metadata(temp_video_path)
            results.update(metadata)

            # 3. 썸네일 생성 (로컬 임시 파일 생성)
            temp_thumb_path = VideoService.generate_thumbnail_local(temp_video_path)

            # 4. S3 업로드
            
            # 4-1. 비디오 업로드
            ext = os.path.splitext(uploaded_file.name)[1] or '.mp4'
            video_filename = f"{uuid.uuid4()}{ext}"
            # [Fix] Force forward slashes for S3 (Windows creates backslashes with os.path.join)
            video_s3_path = f"shortforms/videos/{video_filename}"
            
            # 파일을 다시 열어서 업로드
            with open(temp_video_path, 'rb') as f:
                saved_video_path = default_storage.save(video_s3_path, File(f))
                results['video_url'] = default_storage.url(saved_video_path)

            # 4-2. 썸네일 업로드
            if temp_thumb_path and os.path.exists(temp_thumb_path):
                thumb_filename = f"{uuid.uuid4()}.jpg"
                thumb_s3_path = f"shortforms/thumbnails/{thumb_filename}"
                
                with open(temp_thumb_path, 'rb') as f:
                    saved_thumb_path = default_storage.save(thumb_s3_path, File(f))
                    results['thumbnail_url'] = default_storage.url(saved_thumb_path)
            else:
                results['thumbnail_url'] = None

        except Exception as e:
            logger.error(f"Video processing failed: {e}")
            raise e
        finally:
            # 5. 임시 파일 정리
            if os.path.exists(temp_video_path):
                os.unlink(temp_video_path)
            if temp_thumb_path and os.path.exists(temp_thumb_path):
                os.unlink(temp_thumb_path)

        return results

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
    def generate_thumbnail_local(file_path):
        """
        ffmpeg로 썸네일을 생성하여 로컬 임시 경로를 반환한다.
        반환: temp_file_path / 실패 시 None
        """
        ffmpeg_bin = VideoService.resolve_bin("ffmpeg", "FFMPEG_BIN")
        if not ffmpeg_bin:
            logger.warning("ffmpeg not found (set FFMPEG_BIN env or add to PATH)")
            return None
            
        try:
            # 임시 파일 생성 (닫고 경로만 사용, ffmpeg가 쓸 수 기 위해)
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                temp_out_path = tmp.name
            
            cmd = [
                ffmpeg_bin,
                "-y",
                "-ss", "00:00:01",
                "-i", file_path,
                "-vframes", "1",
                "-vf", "scale=320:-1",
                temp_out_path,
            ]
            subprocess.run(cmd, capture_output=True, text=True, check=True)
            return temp_out_path
        except Exception as e:
            logger.warning("ffmpeg thumbnail generation failed for %s: %s", file_path, e)
            if os.path.exists(temp_out_path):
                os.unlink(temp_out_path)
            return None
