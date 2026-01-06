import requests
import os
from dotenv import load_dotenv

# python fastapi_app/places/test_kakao.py이나 python test_kakao.py 로 실행
#구글 api는 터미널에
#curl "https://maps.googleapis.com/maps/api/place/textsearch/json?query=성심당&key=여기에_발급받은_API_키_입력"로 실행해서 테스트 가능

load_dotenv()

API_KEY = os.getenv("KAKAO_REST_API_KEY")
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