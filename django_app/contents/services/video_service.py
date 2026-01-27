import os
import uuid
import json
import subprocess
import logging
from shutil import which
import tempfile
import shutil
from django.conf import settings
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
    def _get_s3_client():
        """
        [NEW] S3 클라이언트를 생성합니다.
        설정이 없으면 None을 반환합니다.
        """
        aws_access_key = os.getenv('AWS_ACCESS_KEY_ID')
        aws_secret_key = os.getenv('AWS_SECRET_ACCESS_KEY')
        bucket_name = os.getenv('AWS_STORAGE_BUCKET_NAME')

        if not (aws_access_key and aws_secret_key and bucket_name):
            return None, None

        try:
            import boto3
            s3 = boto3.client(
                's3',
                aws_access_key_id=aws_access_key,
                aws_secret_access_key=aws_secret_key,
                region_name=os.getenv('AWS_S3_REGION_NAME', 'ap-northeast-2')
            )
            return s3, bucket_name
        except ImportError:
            logger.error("boto3 \uB77C\uC774\uBE0C\uB7EC\uB9AC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.")
            return None, None
        except Exception as e:
            logger.error(f"Failed to create S3 client: {e}")
            return None, None

    @staticmethod
    def _upload_to_s3(s3_client, bucket_name, file_path, s3_key, content_type=None):
        """
        [NEW] 파일을 S3에 업로드합니다.
        """
        try:
            extra_args = {'ACL': 'public-read'}
            if content_type:
                extra_args['ContentType'] = content_type
                
            s3_client.upload_file(file_path, bucket_name, s3_key, ExtraArgs=extra_args)
            
            # S3 URL 생성
            region = os.getenv('AWS_S3_REGION_NAME', 'ap-northeast-2')
            url = f"https://{bucket_name}.s3.{region}.amazonaws.com/{s3_key}"
            return url
        except Exception as e:
            logger.error(f"S3 upload failed: {e}")
            raise e

    @staticmethod
    def process_video_pipeline(uploaded_file, title=None, content=None):
        """
        [NEW] 비디오 처리 파이프라인 (Hybrid Storage)
        1. 임시 저장 (로컬 tempfile 사용 - S3 호환성 문제 해결)
        2. 메타데이터 추출 & 썸네일 생성
        3. (S3 설정 시) 영상 & 썸네일 S3 업로드
        4. 언어 감지
        5. 임시 파일 정리
        """
        from contents.services.translation_service import TranslationService

        # 1. 로컬 임시 파일 생성 (ffmpeg 처리를 위해 필수)
        # S3 스토리지의 경우 default_storage.path()가 동작하지 않으므로,
        # 무조건 로컬 파일시스템의 temp 디렉토리를 사용합니다.
        ext = os.path.splitext(uploaded_file.name)[1] or '.mp4'
        
        # delete=False로 설정하여 블록 종료 후에도 파일이 유지되게 함 (ffmpeg에서 읽어야 하므로)
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_video_file:
            for chunk in uploaded_file.chunks():
                temp_video_file.write(chunk)
            temp_video_path = temp_video_file.name
            
        # 썸네일 임시 경로 설정
        temp_thumb_path = os.path.splitext(temp_video_path)[0] + ".jpg"
        
        # 파일명 생성 (S3 키 또는 로컬 저장 파일명으로 사용)
        unique_id = str(uuid.uuid4())
        filename = f"{unique_id}{ext}"
        thumb_filename = f"{unique_id}.jpg"

        s3_client, bucket_name = VideoService._get_s3_client()
        is_s3_mode = (s3_client is not None)
        
        video_url = None
        thumbnail_url = None
        meta = {}

        try:
            # 2. 메타데이터 추출
            meta = VideoService.extract_metadata(temp_video_path)

            # 3. 썸네일 생성 (로컬 임시 경로에 생성)
            VideoService.generate_thumbnail_file(temp_video_path, temp_thumb_path)
            
            # 4. 저장소 업로드 분기
            if is_s3_mode:
                # [S3 Mode]
                # 영상 업로드
                video_key = f"shortforms/videos/{filename}"
                video_url = VideoService._upload_to_s3(s3_client, bucket_name, temp_video_path, video_key, content_type='video/mp4')
                
                # 썸네일 업로드
                if os.path.exists(temp_thumb_path):
                    thumb_key = f"shortforms/thumbnails/{thumb_filename}"
                    thumbnail_url = VideoService._upload_to_s3(s3_client, bucket_name, temp_thumb_path, thumb_key, content_type='image/jpeg')
            else:
                # [Local Mode]
                # 최종 저장 경로 (media/shortforms/videos/...)
                # settings.MEDIA_ROOT를 사용하여 로컬 경로 구성
                
                final_video_dir = os.path.join(settings.MEDIA_ROOT, 'shortforms', 'videos')
                final_thumb_dir = os.path.join(settings.MEDIA_ROOT, 'shortforms', 'thumbnails')
                
                os.makedirs(final_video_dir, exist_ok=True)
                os.makedirs(final_thumb_dir, exist_ok=True)
                
                final_video_path = os.path.join(final_video_dir, filename)
                final_thumb_path = os.path.join(final_thumb_dir, thumb_filename)
                
                # 임시 파일을 최종 위치로 이동
                shutil.move(temp_video_path, final_video_path)
                
                if os.path.exists(temp_thumb_path):
                    shutil.move(temp_thumb_path, final_thumb_path)
                
                # URL 생성
                # settings.MEDIA_URL이 '/media/' 인 경우를 가정
                video_url = f"{settings.MEDIA_URL}shortforms/videos/{filename}"
                thumbnail_url = f"{settings.MEDIA_URL}shortforms/thumbnails/{thumb_filename}"

        except Exception as e:
            logger.error(f"Video pipeline failed: {e}")
            raise e
        finally:
            # 5. 임시 파일 정리 (로컬 모드에서 move를 했다면 이미 파일이 없을 수 있음)
            if os.path.exists(temp_video_path):
                try:
                    os.remove(temp_video_path)
                except OSError:
                    pass
            
            if os.path.exists(temp_thumb_path):
                try:
                    os.remove(temp_thumb_path)
                except OSError:
                    pass

        # 6. 언어 감지
        full_text = f"{title or ''} {content or ''}".strip()
        detected_lang = TranslationService.detect_language(full_text)

        return {
            'video_url': video_url,
            'file_size': uploaded_file.size,
            'duration': meta.get("duration"),
            'width': meta.get("width"),
            'height': meta.get("height"),
            'thumbnail_url': thumbnail_url,
            'source_lang': detected_lang,
        }

    @staticmethod
    def generate_thumbnail_file(video_path, output_path):
        """
        [Helper] ffmpeg로 썸네일을 생성하여 지정된 경로에 저장합니다.
        """
        ffmpeg_bin = VideoService.resolve_bin("ffmpeg", "FFMPEG_BIN")
        if not ffmpeg_bin:
            return None, None
            
        try:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            cmd = [
                ffmpeg_bin, "-y", "-ss", "00:00:01", "-i", video_path,
                "-vframes", "1", "-vf", "scale=320:-1", output_path,
            ]
            subprocess.run(cmd, capture_output=True, text=True, check=True)
            return output_path, None
        except Exception as e:
            logger.warning(f"Thumbnail generation failed: {e}")
            return None, None

    # --- Deprecated or Helper Methods below ---
    
    @staticmethod
    def save_video_file(uploaded_file):
        """Legacy support"""
        return VideoService.process_video_pipeline(uploaded_file)['video_url'], None

    @staticmethod
    def extract_metadata(file_path):
        """
        ffprobe를 사용해 영상 메타데이터를 추출한다.
        반환: dict(duration, width, height) / 실패 시 {}
        """
        ffprobe_bin = VideoService.resolve_bin("ffprobe", "FFPROBE_BIN")
        if not ffprobe_bin:
            logger.warning("ffprobe\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. (FFPROBE_BIN \uC124\uC815 \uB610\uB294 PATH\uC5D0 \uCD94\uAC00)")
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
            logger.warning("ffprobe 메타데이터 추출 실패: %s (%s)", file_path, e)
            return {}

    @staticmethod
    def generate_thumbnail(file_path):
        """Legacy helper - now integrated in pipeline"""
        return None, None
