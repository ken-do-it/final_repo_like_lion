# django_app/places/apps.py
from django.apps import AppConfig

class PlacesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'places'

    def ready(self):
        # ★ 여기서 한 번만 불러오면, 위에서 정의한 모든 신호(Place, Plan 등)가 다 작동합니다.
        try:
            # django_app 폴더 바로 아래에 search_signals.py가 있다면:
            import search_signals 
            print("✅ 통합 검색 신호(Signal) 연결 완료!")
        except ImportError:
            pass