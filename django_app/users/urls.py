from django.urls import path, include
from .views import (
    RegisterView, LoginView, LogoutView, TokenRefreshView,
    SendVerificationView, VerifyEmailView,
    PasswordResetRequestView, PasswordResetConfirmView, PasswordChangeView,
    ProfileView, PreferencesView, MainPageView, SavedIdCheckView,
    login_page, register_page, main_page, api_test_page, social_callback_page, mypage_page,
    SavedPlacesView, SavedPlaceDetailView, MyReviewsView, MyReviewDetailView
)
from .social_auth import SocialLoginCallbackView, SocialLoginAPIView

app_name = 'users'

urlpatterns = [
    # 페이지 렌더링 (HTML)
    path('', main_page, name='main-page'),
    path('login-page/', login_page, name='login-page'),
    path('register-page/', register_page, name='register-page'),
    path('mypage/', mypage_page, name='mypage'),
    path('api-test/', api_test_page, name='api-test'),
    path('social-callback/', social_callback_page, name='social-callback-page'),

    # API 엔드포인트
    path('main/', MainPageView.as_view(), name='main'),
    path('saved-ids/', SavedIdCheckView.as_view(), name='saved-ids'),

    # 인증 API
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),

    # 이메일 인증
    path('send-verification/', SendVerificationView.as_view(), name='send-verification'),
    path('verify-email/', VerifyEmailView.as_view(), name='verify-email'),

    # 비밀번호 관리
    path('password/reset/request/', PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('password/reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('password/change/', PasswordChangeView.as_view(), name='password-change'),

    # 프로필 및 설정
    path('profile/', ProfileView.as_view(), name='profile'),
    path('preferences/', PreferencesView.as_view(), name='preferences'),

    # 마이페이지 - 저장한 장소
    path('mypage/saved-places/', SavedPlacesView.as_view(), name='saved-places'),
    path('mypage/saved-places/<int:pk>/', SavedPlaceDetailView.as_view(), name='saved-place-detail'),

    # 마이페이지 - 내 리뷰
    path('mypage/reviews/', MyReviewsView.as_view(), name='my-reviews'),
    path('mypage/reviews/<int:pk>/', MyReviewDetailView.as_view(), name='my-review-detail'),

    # 소셜 로그인 API
    path('social/login/<str:provider>/', SocialLoginAPIView.as_view(), name='social-login-api'),
    path('social/callback/<str:provider>/', SocialLoginCallbackView.as_view(), name='social-callback'),
]
