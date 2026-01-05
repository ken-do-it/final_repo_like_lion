from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # 1. 관리자 페이지
    path('admin/', admin.site.urls),

    # 2. 프로메테우스 (모니터링) - ★ 이거 살려야 그래프 나옵니다
    path('', include('django_prometheus.urls')),

    # 3. 유저 API (로그인/회원가입)
    path('api/users/', include('users.urls')),

    # 4. 콘텐츠 API (숏폼 등)
    path('api/', include('contents.urls')),
]

# 5. 미디어 파일(이미지) 처리
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)