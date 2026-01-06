"""
소셜 로그인 시그널 핸들러
django-allauth의 소셜 로그인 완료 시그널을 처리하여 JWT 토큰 발급
"""
from django.dispatch import receiver
from allauth.socialaccount.signals import pre_social_login, social_account_added
from allauth.account.signals import user_logged_in
from django.contrib.auth import get_user_model
from .utils import generate_jwt_token, get_client_ip, get_device_info, generate_device_fingerprint
from .models import LoginSession, LoginHistory

User = get_user_model()


@receiver(pre_social_login)
def link_to_local_user(sender, request, sociallogin, **kwargs):
    """
    소셜 로그인 전 처리
    이미 같은 이메일로 가입된 계정이 있으면 연결
    """
    email_address = sociallogin.account.extra_data.get('email')
    if email_address:
        try:
            user = User.objects.get(email=email_address)
            sociallogin.connect(request, user)
        except User.DoesNotExist:
            pass


@receiver(social_account_added)
def set_social_provider(sender, request, sociallogin, **kwargs):
    """
    소셜 계정이 추가되었을 때 처리
    User 모델의 social_provider 필드 업데이트
    """
    user = sociallogin.user
    provider = sociallogin.account.provider

    if provider == 'google':
        user.social_provider = 'GOOGLE'
    elif provider == 'kakao':
        user.social_provider = 'KAKAO'
    elif provider == 'naver':
        user.social_provider = 'NAVER'
    else:
        user.social_provider = provider.upper()

    # 닉네임이 없으면 소셜 계정 이름으로 설정
    if not user.nickname:
        extra_data = sociallogin.account.extra_data
        user.nickname = (
            extra_data.get('name') or
            extra_data.get('nickname') or
            extra_data.get('properties', {}).get('nickname') or
            user.username
        )

    user.save()


@receiver(user_logged_in)
def create_jwt_tokens(sender, request, user, **kwargs):
    """
    사용자 로그인 시 JWT 토큰 생성 및 세션에 저장
    """
    from django.utils import timezone
    from datetime import timedelta

    # JWT 토큰 생성
    access_token = generate_jwt_token(user.id, 'access')
    refresh_token = generate_jwt_token(user.id, 'refresh')

    # 세션에 토큰 저장
    request.session['access_token'] = access_token
    request.session['refresh_token'] = refresh_token
    request.session['user_id'] = user.id
    request.session['username'] = user.username
    request.session['email'] = user.email
    request.session['nickname'] = user.nickname
    request.session['social_provider'] = user.social_provider

    # 클라이언트 정보
    client_ip = get_client_ip(request)
    device_info = get_device_info(request)

    # 로그인 세션 생성
    LoginSession.objects.create(
        user=user,
        session_token=refresh_token[:255],
        refresh_token=refresh_token,
        ip_address=client_ip,
        device_info=device_info,
        expires_at=timezone.now() + timedelta(days=14)
    )

    # 로그인 이력 저장
    LoginHistory.objects.create(
        username=user.username,
        ip_address=client_ip,
        device_info=device_info or 'Unknown',
        login_type=user.social_provider or 'LOCAL',
        status='SUCCESS'
    )
