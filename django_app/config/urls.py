from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    # 1. 관리자 페이지
    path('admin/', admin.site.urls),

    # 2. 프로메테우스 (모니터링)
    path('', include('django_prometheus.urls')),

    # 3. 유저 API (로그인/회원가입)
    path('api/users/', include('users.urls')),

    # 4. 콘텐츠 API (숏폼 등)
    path('api/', include('contents.urls')),

    # 5. 교통 API (항공/기차/지하철)
    path('api/v1/transport/', include('reservations.urls')),

    # 5-1. 예약 API
    path('api/v1/', include('reservations.reservation_urls')),

    # 6. Django-allauth
    path('accounts/', include('allauth.urls')),

    # 7. API 문서 (Swagger & ReDoc)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/swagger/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/docs/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

# 미디어 파일 처리
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)