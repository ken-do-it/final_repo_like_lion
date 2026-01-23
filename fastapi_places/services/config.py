import os

# ==================== 환경 변수 ====================

KAKAO_REST_API_KEY = os.getenv("YJ_KAKAO_REST_API_KEY", "")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

# 한국 위치 범위
KOREA_LAT_MIN = float(os.getenv("KOREA_LAT_MIN", "33"))
KOREA_LAT_MAX = float(os.getenv("KOREA_LAT_MAX", "43"))
KOREA_LON_MIN = float(os.getenv("KOREA_LON_MIN", "124"))
KOREA_LON_MAX = float(os.getenv("KOREA_LON_MAX", "132"))
