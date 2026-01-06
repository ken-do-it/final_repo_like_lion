# django_app/places/apps.py
from django.apps import AppConfig

class PlacesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'places'

    def ready(self):
        # ★ 서버 시작 시 신호등(Signal) 파일 연결!
        try:
            import search_signals
            print("✅ [Places] 검색엔진 자동 등록 시스템 연결됨")
        except ImportError:
            print("⚠️ search_signals.py를 찾을 수 없습니다.")