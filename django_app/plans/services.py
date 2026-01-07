import requests
from django.conf import settings
from places.models import Place  # 실제 Place 모델이 있는 위치로 수정하세요

def search_place_from_fastapi(place_name: str):
    """
    FastAPI 장소 검색 API 호출 및 첫 번째 결과 반환
    """
    url = "http://localhost:8002/api/v1/places/search"
    params = {'query': place_name, 'limit': 1}
    
    try:
        response = requests.get(url, params=params, timeout=5)
        
        # 1. status_code 체크
        response.raise_for_status() 

        
        # 2. JSON 파싱 시 발생할 수 있는 ValueError 방지
        try:
            data = response.json()
        except ValueError:
            print("❌ 에러: 응답 데이터가 유효한 JSON 형식이 아닙니다.")
            return None
        results = data.get('results', [])
        
        # 3. results가 비어있는지 확인
        if not results:
            print(f"🔍 '{place_name}'에 대한 검색 결과가 없습니다.")
            return None
            
        # 4. 첫 번째 결과 반환
        return results[0]
        
    except requests.exceptions.RequestException as e:
        print(f"API 호출 중 오류 발생: {e}")
        return None

def get_or_create_place_from_search(place_name: str):
    """
    검색 결과를 바탕으로 DB에 장소를 저장하거나 조회
    """
    # 1. API 호출해서 데이터 받기
    kakao_data = search_place_from_fastapi(place_name)
    
    if not kakao_data:
        raise ValueError(f"'{place_name}' 장소를 찾을 수 없습니다.")

    # 카카오 API 응답 필드명은 실제 API 명세에 따라 맞추어야 합니다.
    # 예시: id -> place_api_id, place_name -> name 등
    api_id = kakao_data.get('place_api_id')
    
    # 2. Place.objects.get_or_create() 사용
    place, created = Place.objects.get_or_create(
        place_api_id=api_id,
        defaults={
            'name': kakao_data.get('name'),
            'address': kakao_data.get('address'),
            'city': kakao_data.get('city'),  # FastAPI가 이미 제공함
            'latitude': kakao_data.get('latitude'),
            'longitude': kakao_data.get('longitude'),
            'provider': 'KAKAO',  # 대문자로 (Django 모델의 choices와 일치)
            'category_main': kakao_data.get('category_main'),  # 추가
            'category_detail': kakao_data.get('category_detail', []),  # 추가
            'thumbnail_urls': [kakao_data.get('thumbnail_url')] if kakao_data.get('thumbnail_url') else []  # 추가
        }
    )

    # 3. (place 객체, created 여부) 반환
    return place, created