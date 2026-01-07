import requests
import os
from dotenv import load_dotenv

# 실행 방법:
# cd fastapi_places
# python test_kakao.py
#
# 구글 API는 터미널에서:
# curl "https://maps.googleapis.com/maps/api/place/textsearch/json?query=성심당&key=여기에_발급받은_API_키_입력"

load_dotenv()

API_KEY = os.getenv("YJ_KAKAO_REST_API_KEY")
url = "https://dapi.kakao.com/v2/local/search/keyword.json"

headers = {
    "Authorization": f"KakaoAK {API_KEY}"
}

params = {
    "query": "성심당"  # 한글 그대로 사용 가능!
}

response = requests.get(url, headers=headers, params=params)
print(f"Status Code: {response.status_code}")
print("\n응답 데이터:")
print(response.json())