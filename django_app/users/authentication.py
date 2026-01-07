from rest_framework import authentication
from rest_framework import exceptions
from django.contrib.auth import get_user_model
from .utils import decode_jwt_token

User = get_user_model()


class JWTAuthentication(authentication.BaseAuthentication):
    """
    JWT 토큰 기반 인증 클래스
    """
    keyword = 'Bearer'

    def authenticate(self, request):
        """
        HTTP Authorization 헤더에서 JWT 토큰을 추출하고 검증

        Args:
            request: Django request 객체

        Returns:
            (user, token) 튜플 또는 None
        """
        auth_header = request.META.get('HTTP_AUTHORIZATION')

        if not auth_header:
            return None

        try:
            prefix, token = auth_header.split(' ')
        except ValueError:
            raise exceptions.AuthenticationFailed('Invalid token header')

        if prefix.lower() != self.keyword.lower():
            return None

        return self.authenticate_credentials(token)

    def authenticate_credentials(self, token):
        """
        토큰 검증 및 사용자 객체 반환

        Args:
            token: JWT 토큰 문자열

        Returns:
            (user, token) 튜플

        Raises:
            AuthenticationFailed: 토큰이 유효하지 않을 때
        """
        payload = decode_jwt_token(token)

        if payload is None:
            raise exceptions.AuthenticationFailed('Invalid or expired token')

        if payload.get('type') != 'access':
            raise exceptions.AuthenticationFailed('Invalid token type')

        try:
            user = User.objects.get(pk=payload['user_id'])
        except User.DoesNotExist:
            raise exceptions.AuthenticationFailed('User not found')

        if not user.is_active:
            raise exceptions.AuthenticationFailed('User inactive')

        return (user, token)

    def authenticate_header(self, request):
        """
        401 응답에 포함될 WWW-Authenticate 헤더 값 반환
        """
        return self.keyword


# drf-spectacular를 위한 인증 스키마 정의
from drf_spectacular.extensions import OpenApiAuthenticationExtension


class JWTAuthenticationScheme(OpenApiAuthenticationExtension):
    """
    drf-spectacular(Swagger)에게 JWT 인증 방식을 알려주는 클래스

    이 클래스가 없으면 Swagger UI에 Authorize 버튼이 나타나지 않습니다.
    """
    target_class = 'users.authentication.JWTAuthentication'
    name = 'BearerAuth'

    def get_security_definition(self, auto_schema):
        """
        Swagger에 표시될 인증 스키마 정의

        Returns:
            dict: Bearer JWT 인증 스키마
        """
        return {
            'type': 'http',
            'scheme': 'bearer',
            'bearerFormat': 'JWT',
        }
