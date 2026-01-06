import jwt
import secrets
import string
from datetime import datetime, timedelta
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone


def generate_jwt_token(user_id, token_type='access'):
    """
    JWT 토큰 생성

    Args:
        user_id: 사용자 ID
        token_type: 'access' 또는 'refresh'

    Returns:
        JWT 토큰 문자열
    """
    if token_type == 'access':
        expire_seconds = settings.JWT_ACCESS_TOKEN_LIFETIME
    else:
        expire_seconds = settings.JWT_REFRESH_TOKEN_LIFETIME

    payload = {
        'user_id': user_id,
        'type': token_type,
        'exp': datetime.utcnow() + timedelta(seconds=expire_seconds),
        'iat': datetime.utcnow()
    }

    token = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )

    return token


def decode_jwt_token(token):
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
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def generate_verification_code(length=6):
    """
    이메일 인증 코드 생성

    Args:
        length: 코드 길이 (기본 6자리)

    Returns:
        숫자로 이루어진 인증 코드
    """
    return ''.join(secrets.choice(string.digits) for _ in range(length))


def generate_reset_token(length=64):
    """
    비밀번호 재설정 토큰 생성

    Args:
        length: 토큰 길이

    Returns:
        랜덤 토큰 문자열
    """
    return secrets.token_urlsafe(length)


def send_verification_email(email, code, purpose='SIGNUP'):
    """
    인증 코드 이메일 발송

    Args:
        email: 수신자 이메일
        code: 인증 코드
        purpose: 인증 목적 ('SIGNUP', 'FIND_ID', 'FIND_PASSWORD')
    """
    subject_map = {
        'SIGNUP': '[여행 플랫폼] 회원가입 인증 코드',
        'FIND_ID': '[여행 플랫폼] 아이디 찾기 인증 코드',
        'FIND_PASSWORD': '[여행 플랫폼] 비밀번호 재설정 인증 코드',
    }

    subject = subject_map.get(purpose, '[여행 플랫폼] 인증 코드')
    message = f"""
    안녕하세요, 여행 플랫폼입니다.

    요청하신 인증 코드는 다음과 같습니다:

    {code}

    이 코드는 10분간 유효합니다.
    본인이 요청하지 않았다면 이 메일을 무시하세요.
    """

    send_mail(
        subject,
        message,
        settings.EMAIL_HOST_USER,
        [email],
        fail_silently=False,
    )


def send_password_reset_email(email, token):
    """
    비밀번호 재설정 이메일 발송

    Args:
        email: 수신자 이메일
        token: 재설정 토큰
    """
    subject = '[여행 플랫폼] 비밀번호 재설정'
    reset_url = f"http://localhost:3000/reset-password?token={token}"
    message = f"""
    안녕하세요, 여행 플랫폼입니다.

    비밀번호 재설정을 요청하셨습니다.
    아래 링크를 클릭하여 비밀번호를 재설정하세요:

    {reset_url}

    이 링크는 24시간 동안 유효합니다.
    본인이 요청하지 않았다면 이 메일을 무시하세요.
    """

    send_mail(
        subject,
        message,
        settings.EMAIL_HOST_USER,
        [email],
        fail_silently=False,
    )


def get_client_ip(request):
    """
    클라이언트 IP 주소 추출

    Args:
        request: Django request 객체

    Returns:
        IP 주소 문자열
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def get_device_info(request):
    """
    디바이스 정보 추출

    Args:
        request: Django request 객체

    Returns:
        User-Agent 문자열
    """
    return request.META.get('HTTP_USER_AGENT', '')


def generate_device_fingerprint(request):
    """
    디바이스 지문 생성

    Args:
        request: Django request 객체

    Returns:
        디바이스 지문 문자열
    """
    import hashlib

    user_agent = get_device_info(request)
    ip = get_client_ip(request)

    fingerprint_string = f"{user_agent}:{ip}"
    fingerprint = hashlib.sha256(fingerprint_string.encode()).hexdigest()

    return fingerprint
