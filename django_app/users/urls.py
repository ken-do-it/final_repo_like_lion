from django.urls import path, include
from .views import (
    RegisterView, LoginView, LogoutView, TokenRefreshView,
    SendVerificationView, VerifyEmailView,
    PasswordResetRequestView, PasswordResetConfirmView, PasswordChangeView,
    ProfileView, PreferencesView, MainPageView, SavedIdCheckView,
    login_page, register_page, main_page, api_test_page, social_callback_page
)
from .social_auth import SocialLoginCallbackView, SocialLoginAPIView

app_name = 'users'

urlpatterns = [
    # 페이지 렌더링 (HTML)
    path('', main_page, name='main-page'),
    path('login-page/', login_page, name='login-page'),
    path('register-page/', register_page, name='register-page'),
    path('api-test/', api_test_page, name='api-test'),
    path('social-callback/', social_callback_page, name='social-callback-page'),

    # API 엔드포인트
    path('api/main/', MainPageView.as_view(), name='main'),
    path('api/saved-ids/', SavedIdCheckView.as_view(), name='saved-ids'),

    # 인증 API
    path('api/register/', RegisterView.as_view(), name='register'),
    path('api/login/', LoginView.as_view(), name='login'),
    path('api/logout/', LogoutView.as_view(), name='logout'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),

    # 이메일 인증
    path('api/send-verification/', SendVerificationView.as_view(), name='send-verification'),
    path('api/verify-email/', VerifyEmailView.as_view(), name='verify-email'),

    # 비밀번호 관리
    path('api/password/reset/request/', PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('api/password/reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('api/password/change/', PasswordChangeView.as_view(), name='password-change'),

    # 프로필 및 설정
    path('api/profile/', ProfileView.as_view(), name='profile'),
    path('api/preferences/', PreferencesView.as_view(), name='preferences'),

    # 소셜 로그인 API
    path('api/social/login/<str:provider>/', SocialLoginAPIView.as_view(), name='social-login-api'),
    path('social/callback/<str:provider>/', SocialLoginCallbackView.as_view(), name='social-callback'),
]
