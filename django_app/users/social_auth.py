"""
소셜 로그인 처리 View
Google, Kakao, Naver 소셜 로그인 콜백 처리 및 JWT 발급
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.shortcuts import redirect
from django.contrib.auth import get_user_model
from allauth.socialaccount.models import SocialAccount
from .utils import generate_jwt_token, get_client_ip, get_device_info, generate_device_fingerprint
from .models import LoginSession, LoginHistory, SavedId

User = get_user_model()


class SocialLoginCallbackView(APIView):
    """
    소셜 로그인 콜백 처리
    django-allauth가 소셜 로그인 완료 후 호출하는 엔드포인트
    """
    permission_classes = [AllowAny]

    def get(self, request, provider):
        """
        소셜 로그인 콜백 처리
        - provider: google, kakao, naver
        """
        # 소셜 계정 정보 가져오기
        user = request.user

        if not user.is_authenticated:
            return Response({
                'error': 'Social login failed',
                'message': 'User not authenticated after social login'
            }, status=status.HTTP_401_UNAUTHORIZED)

        # 소셜 계정 정보 업데이트
        try:
            social_account = SocialAccount.objects.get(user=user, provider=provider)

            # User 모델의 social_provider 필드 업데이트
            if provider == 'google':
                user.social_provider = 'GOOGLE'
            elif provider == 'kakao':
                user.social_provider = 'KAKAO'
            elif provider == 'naver':
                user.social_provider = 'NAVER'

            user.save()

        except SocialAccount.DoesNotExist:
            return Response({
                'error': 'Social account not found',
                'message': f'No {provider} account found for this user'
            }, status=status.HTTP_404_NOT_FOUND)

        # JWT 토큰 생성
        access_token = generate_jwt_token(user.id, 'access')
        refresh_token = generate_jwt_token(user.id, 'refresh')

        # 클라이언트 정보
        client_ip = get_client_ip(request)
        device_info = get_device_info(request)
        device_fingerprint = generate_device_fingerprint(request)

        # 로그인 세션 생성
        LoginSession.objects.create(
            user=user,
            session_key=refresh_token[:50],
            ip_address=client_ip,
            device_info=device_info,
            device_fingerprint=device_fingerprint
        )

        # 로그인 이력 저장
        LoginHistory.objects.create(
            user=user,
            ip_address=client_ip,
            device_info=device_info,
            login_method=user.social_provider,
            success=True
        )

        # HTML 페이지로 리다이렉트하면서 토큰 전달
        # JavaScript로 localStorage에 저장하고 메인 페이지로 이동
        return Response(f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Social Login Success</title>
        </head>
        <body>
            <script>
                localStorage.setItem('access_token', '{access_token}');
                localStorage.setItem('refresh_token', '{refresh_token}');
                localStorage.setItem('user', JSON.stringify({str({
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'nickname': user.nickname,
                    'social_provider': user.social_provider
                })}));
                window.location.href = 'http://localhost:5173/';
            </script>
        </body>
        </html>
        """, status=status.HTTP_200_OK)


class SocialLoginAPIView(APIView):
    """
    REST API용 소셜 로그인 엔드포인트
    프론트엔드에서 소셜 로그인 토큰을 받아 JWT 발급
    """
    permission_classes = [AllowAny]

    def post(self, request, provider):
        """
        소셜 로그인 토큰으로 JWT 발급

        Request Body:
        {
            "access_token": "social_provider_access_token",
            "email": "user@example.com",  # optional
            "name": "User Name"  # optional
        }
        """
        social_token = request.data.get('access_token')
        email = request.data.get('email')
        name = request.data.get('name')

        if not social_token:
            return Response({
                'error': 'Missing access_token',
                'message': 'Social provider access token is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        # TODO: 각 소셜 프로바이더의 토큰 검증 API 호출
        # 현재는 기본 구현만 제공

        try:
            # 소셜 계정으로 사용자 조회 또는 생성
            social_account = SocialAccount.objects.filter(
                provider=provider,
                uid=email or social_token[:20]
            ).first()

            if social_account:
                user = social_account.user
            else:
                # 새 사용자 생성
                username = f"{provider}_{email.split('@')[0]}" if email else f"{provider}_{social_token[:10]}"
                user = User.objects.create(
                    username=username,
                    email=email or f"{username}@social.com",
                    nickname=name or username,
                    social_provider=provider.upper()
                )

            # JWT 토큰 생성
            access_token = generate_jwt_token(user.id, 'access')
            refresh_token = generate_jwt_token(user.id, 'refresh')

            # 로그인 세션 및 이력 저장
            client_ip = get_client_ip(request)
            device_info = get_device_info(request)
            device_fingerprint = generate_device_fingerprint(request)

            LoginSession.objects.create(
                user=user,
                session_key=refresh_token[:50],
                ip_address=client_ip,
                device_info=device_info,
                device_fingerprint=device_fingerprint
            )

            LoginHistory.objects.create(
                user=user,
                ip_address=client_ip,
                device_info=device_info,
                login_method=provider.upper(),
                success=True
            )

            return Response({
                'access_token': access_token,
                'refresh_token': refresh_token,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'nickname': user.nickname,
                    'social_provider': user.social_provider
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'error': 'Social login failed',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
