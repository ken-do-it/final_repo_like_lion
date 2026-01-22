import os


KAKAO_REST_API_KEY = os.getenv("YJ_KAKAO_REST_API_KEY", "")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

KOREA_LAT_MIN = float(os.getenv("KOREA_LAT_MIN", "33"))
KOREA_LAT_MAX = float(os.getenv("KOREA_LAT_MAX", "43"))
KOREA_LON_MIN = float(os.getenv("KOREA_LON_MIN", "124"))
KOREA_LON_MAX = float(os.getenv("KOREA_LON_MAX", "132"))
