"""
JWT Authentication for FastAPI Places
Django와 동일한 SECRET_KEY를 사용하여 JWT 토큰 검증
"""
import os
import jwt
from typing import Optional
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# JWT 설정 (Django와 동일)
# .env의 SECRET_KEY 사용 (Django가 JWT 토큰 발급 시 사용하는 키)
SECRET_KEY = os.getenv("SECRET_KEY", "")
ALGORITHM = "HS256"

# HTTPBearer 보안 스키마 (Swagger UI Authorize 버튼용)
security = HTTPBearer(auto_error=False)


def decode_jwt_token(token: str) -> Optional[dict]:
    """
    JWT 토큰 디코딩 및 검증

    Args:
        token: JWT 토큰 문자열

    Returns:
        디코딩된 payload 또는 None
    """
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def verify_access_token(credentials: Optional[HTTPAuthorizationCredentials]) -> Optional[int]:
    """
    Access Token 검증 및 user_id 추출

    Args:
        credentials: HTTPBearer에서 추출한 토큰

    Returns:
        user_id (int) 또는 None
    """
    if not credentials:
        return None

    token = credentials.credentials
    payload = decode_jwt_token(token)

    if not payload:
        return None

    # Access 토큰인지 확인
    if payload.get("type") != "access":
        return None

    user_id = payload.get("user_id")
    return user_id


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security)
) -> Optional[int]:
    """
    현재 사용자 ID 추출 (선택적 인증)
    로그인하지 않아도 되는 엔드포인트에서 사용

    Args:
        credentials: HTTPBearer에서 추출한 토큰

    Returns:
        user_id (int) 또는 None
    """
    return verify_access_token(credentials)


def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security)
) -> int:
    """
    인증 필수 (로그인 필요)
    로그인해야만 사용 가능한 엔드포인트에서 사용

    Args:
        credentials: HTTPBearer에서 추출한 토큰

    Returns:
        user_id (int)

    Raises:
        HTTPException: 인증 실패 시 401
    """
    user_id = verify_access_token(credentials)

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="로그인이 필요합니다",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user_id
