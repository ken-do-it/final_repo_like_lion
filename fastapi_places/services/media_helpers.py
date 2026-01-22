import os
import uuid
from pathlib import Path
from typing import Tuple

from fastapi import HTTPException, UploadFile


def _get_s3_client() -> Tuple[object | None, str | None]:
    """
    S3 클라이언트 생성. 설정이 없으면 (None, None)을 반환.
    """
    import boto3

    aws_access_key = os.environ.get("AWS_ACCESS_KEY_ID")
    aws_secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
    bucket_name = os.environ.get("AWS_STORAGE_BUCKET_NAME")

    if not all([aws_access_key, aws_secret_key, bucket_name]):
        return None, None

    try:
        s3_client = boto3.client(
            "s3",
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
            region_name=os.environ.get("AWS_S3_REGION_NAME", "ap-northeast-2"),
        )
        return s3_client, bucket_name
    except Exception as e:
        print(f"S3 클라이언트 생성 오류: {e}")
        return None, None


def _get_s3_url(bucket_name: str, key: str) -> str:
    region = os.environ.get("AWS_S3_REGION_NAME", "ap-northeast-2")
    return f"https://{bucket_name}.s3.{region}.amazonaws.com/{key}"


def _is_s3_url(url: str) -> bool:
    return bool(url) and (".s3." in url and ".amazonaws.com" in url)


def delete_image_file(image_url: str) -> bool:
    if not image_url:
        return False

    try:
        if _is_s3_url(image_url):
            s3_client, bucket_name = _get_s3_client()
            if s3_client:
                key = image_url.split(".amazonaws.com/")[-1]
                s3_client.delete_object(Bucket=bucket_name, Key=key)
                return True
        elif "/media/" in image_url:
            relative_path = image_url.split("/media/")[-1]
            file_path = Path(f"/app/django_app/media/{relative_path}")
            if file_path.exists():
                file_path.unlink()
                return True
    except Exception as e:
        print(f"이미지 파일 삭제 오류: {e}")

    return False


async def save_image_file(image: UploadFile, subfolder: str = "place_images") -> str:
    """
    이미지 저장 (S3 우선, 없으면 로컬).
    """
    allowed_extensions = {".jpg", ".jpeg", ".png", ".gif"}
    file_ext = os.path.splitext(image.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다. 지원 형식: {', '.join(allowed_extensions)}",
        )

    image.file.seek(0, 2)
    file_size = image.file.tell()
    image.file.seek(0)
    max_size = 10 * 1024 * 1024
    if file_size > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"파일 크기가 너무 큽니다. 최대 {max_size // (1024*1024)}MB",
        )

    unique_filename = f"{uuid.uuid4()}{file_ext}"
    content = await image.read()

    s3_client, bucket_name = _get_s3_client()
    if s3_client:
        try:
            s3_key = f"media/{subfolder}/{unique_filename}"
            s3_client.put_object(
                Bucket=bucket_name,
                Key=s3_key,
                Body=content,
                ContentType=image.content_type or "image/jpeg",
            )
            return _get_s3_url(bucket_name, s3_key)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"S3 업로드 실패: {str(e)}")

    try:
        media_dir = Path(f"/app/django_app/media/{subfolder}")
        media_dir.mkdir(parents=True, exist_ok=True)
        file_path = media_dir / unique_filename
        with open(file_path, "wb") as f:
            f.write(content)
        return f"/media/{subfolder}/{unique_filename}"
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 저장 실패: {str(e)}")
