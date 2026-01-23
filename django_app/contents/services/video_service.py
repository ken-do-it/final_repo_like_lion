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
        1. 임시 저장 (로컬)
        2. 메타데이터 추출 & 썸네일 생성
        3. (S3 설정 시) 영상 & 썸네일 S3 업로드
        4. 언어 감지
        5. 임시 파일 정리
        """
        from django.core.files.storage import default_storage
        from contents.services.translation_service import TranslationService

        # 1. 임시 저장 (ffmpeg 처리를 위해 필수)
        ext = os.path.splitext(uploaded_file.name)[1] or '.mp4'
        unique_id = str(uuid.uuid4())
        filename = f"{unique_id}{ext}"
        
        # 임시 경로: media/temp/filename
        temp_rel_path = os.path.join('temp', filename)
        saved_path = default_storage.save(temp_rel_path, uploaded_file)
        abs_path = default_storage.path(saved_path)

        s3_client, bucket_name = VideoService._get_s3_client()
        is_s3_mode = (s3_client is not None)
        
        video_url = None
        thumbnail_url = None
        meta = {}

        try:
            # 2. 메타데이터 추출
            meta = VideoService.extract_metadata(abs_path)

            # 3. 썸네일 생성 (로컬 임시)
            thumb_filename = f"{unique_id}.jpg"
            thumb_rel_path = os.path.join('temp', thumb_filename)
            thumb_abs_path = default_storage.path(thumb_rel_path)
            
            # ffmpeg로 썸네일 생성
            generated_thumb_rel, _ = VideoService.generate_thumbnail_file(abs_path, thumb_abs_path)
            
            # 4. 저장소 업로드 분기
            if is_s3_mode:
                # [S3 Mode]
                # 영상 업로드
                video_key = f"shortforms/videos/{filename}"
                video_url = VideoService._upload_to_s3(s3_client, bucket_name, abs_path, video_key, content_type='video/mp4')
                
                # 썸네일 업로드
                if generated_thumb_rel:
                    thumb_key = f"shortforms/thumbnails/{thumb_filename}"
                    thumbnail_url = VideoService._upload_to_s3(s3_client, bucket_name, thumb_abs_path, thumb_key, content_type='image/jpeg')
            else:
                # [Local Mode]
                # 임시 파일을 최종 위치로 이동 (media/shortforms/videos/...)
                final_video_rel = os.path.join('shortforms', 'videos', filename)
                final_thumb_rel = os.path.join('shortforms', 'thumbnails', thumb_filename)
                
                # Django Storage 이동 로직 (기존 파일이 있으면 덮어쓰거나 이름 변경됨)
                # default_storage는 move가 없으므로 다시 save하거나 os.rename 사용
                # 여기서는 간단히 os.rename 사용 (로컬 파일시스템 가정)
                
                final_video_abs = default_storage.path(final_video_rel)
                final_thumb_abs = default_storage.path(final_thumb_rel)
                
                os.makedirs(os.path.dirname(final_video_abs), exist_ok=True)
                os.makedirs(os.path.dirname(final_thumb_abs), exist_ok=True)
                
                import shutil
                shutil.move(abs_path, final_video_abs)
                if generated_thumb_rel:
                    shutil.move(thumb_abs_path, final_thumb_abs)
                
                video_url = default_storage.url(final_video_rel)
                thumbnail_url = default_storage.url(final_thumb_rel)

        except Exception as e:
            logger.error(f"Video pipeline failed: {e}")
            # 에러 발생 시에도 임시 파일 정리는 finally에서 수행
            raise e
        finally:
            # 5. 임시 파일 정리
            # S3 모드면 둘 다 삭제, 로컬 모드면 이미 move됨 (하지만 에러 시 잔여 파일 삭제)
            if os.path.exists(abs_path):
                os.remove(abs_path)
            # 썸네일 경로가 정의되어 있고 파일이 남아있다면 삭제
            if 'thumb_abs_path' in locals() and os.path.exists(thumb_abs_path):
                os.remove(thumb_abs_path)

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
