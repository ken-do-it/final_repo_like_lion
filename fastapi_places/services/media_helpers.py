import os
import uuid
from pathlib import Path
from typing import Tuple

from fastapi import HTTPException, UploadFile


# ==================== S3/로컬 하이브리드 이미지 헬퍼 ====================

def _get_s3_client():
    """
    S3 클라이언트 반환. AWS 자격증명이 없으면 (None, None) 반환.
    Django settings.py와 동일한 환경변수 사용.
    """
    import boto3

    aws_access_key = os.environ.get('AWS_ACCESS_KEY_ID')
    aws_secret_key = os.environ.get('AWS_SECRET_ACCESS_KEY')
    bucket_name = os.environ.get('AWS_STORAGE_BUCKET_NAME')

    if not all([aws_access_key, aws_secret_key, bucket_name]):
        return None, None

    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
            region_name=os.environ.get('AWS_S3_REGION_NAME', 'ap-northeast-2')
        )
        return s3_client, bucket_name
    except Exception as e:
        print(f"S3 클라이언트 생성 실패: {e}")
        return None, None


def _get_s3_url(bucket_name: str, key: str) -> str:
    """S3 객체의 공개 URL 생성"""
    region = os.environ.get('AWS_S3_REGION_NAME', 'ap-northeast-2')
    return f"https://{bucket_name}.s3.{region}.amazonaws.com/{key}"


def _is_s3_url(url: str) -> bool:
    """URL이 S3 URL인지 확인"""
    return bool(url) and (".s3." in url and ".amazonaws.com" in url)


def delete_image_file(image_url: str) -> bool:
    """
    이미지 파일 삭제 (S3 또는 로컬)

    Args:
        image_url: 이미지 URL

    Returns:
        삭제 성공 여부
    """
    if not image_url:
        return False

    try:
        # S3 URL인 경우
        if _is_s3_url(image_url):
            s3_client, bucket_name = _get_s3_client()
            if s3_client:
                # URL에서 key 추출: https://bucket.s3.region.amazonaws.com/media/xxx.jpg -> media/xxx.jpg
                key = image_url.split('.amazonaws.com/')[-1]
                s3_client.delete_object(Bucket=bucket_name, Key=key)
                return True

        # 로컬 파일인 경우
        elif "/media/" in image_url:
            relative_path = image_url.split("/media/")[-1]
            file_path = Path(f"/app/django_app/media/{relative_path}")

            if file_path.exists():
                file_path.unlink()
                return True

    except Exception as e:
        print(f"이미지 파일 삭제 실패: {e}")

    return False


async def save_image_file(image: UploadFile, subfolder: str = "place_images") -> str:
    """
    이미지 파일을 저장하고 URL 반환 (S3 또는 로컬)

    Args:
        image: 업로드된 이미지 파일
        subfolder: media 하위 폴더명 (기본: place_images)

    Returns:
        저장된 이미지 URL
    """
    # 1. 파일 확장자 검증
    allowed_extensions = {".jpg", ".jpeg", ".png", ".gif"}
    file_ext = os.path.splitext(image.filename)[1].lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다. 허용: {', '.join(allowed_extensions)}"
        )

    # 2. 파일 크기 검증 (10MB)
    image.file.seek(0, 2)
    file_size = image.file.tell()
    image.file.seek(0)

    max_size = 10 * 1024 * 1024  # 10MB
    if file_size > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"파일 크기가 너무 큽니다. 최대 {max_size // (1024*1024)}MB"
        )

    # 3. 고유 파일명 생성 (UUID)
    unique_filename = f"{uuid.uuid4()}{file_ext}"

    # 4. 파일 내용 읽기
    content = await image.read()

    # 5. S3 또는 로컬 저장
    s3_client, bucket_name = _get_s3_client()

    if s3_client:
        # S3 모드
        try:
            s3_key = f"media/{subfolder}/{unique_filename}"
            s3_client.put_object(
                Bucket=bucket_name,
                Key=s3_key,
                Body=content,
                ContentType=image.content_type or 'image/jpeg'
            )
            return _get_s3_url(bucket_name, s3_key)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"S3 업로드 실패: {str(e)}")
    else:
        # 로컬 모드
        try:
            media_dir = Path(f"/app/django_app/media/{subfolder}")
            media_dir.mkdir(parents=True, exist_ok=True)

            file_path = media_dir / unique_filename
            with open(file_path, "wb") as f:
                f.write(content)

            # 로컬 URL 반환 (Nginx 프록시 경로 사용)
            return f"/media/{subfolder}/{unique_filename}"
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"파일 저장 실패: {str(e)}")