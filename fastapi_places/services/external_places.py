from decimal import Decimal
from typing import Dict, List, Optional

import httpx
from sqlalchemy.orm import Session

from models import Place
from services.categories import GOOGLE_CATEGORY_MAP, map_category_to_main
from services.config import GOOGLE_MAPS_API_KEY, KAKAO_REST_API_KEY
from services.geo import extract_city_from_address, is_korea_location


# ==================== 외부 API 통합 ====================

async def get_or_create_place_by_api_id(
    db: Session,
    place_api_id: str,
    provider: str = "KAKAO",
    name_hint: Optional[str] = None
) -> Optional[Place]:
    """
    place_api_id로 DB에서 조회하거나, 없으면 외부 API에서 가져와서 생성
    """
    # 1. DB에서 조회
    place = db.query(Place).filter(Place.place_api_id == place_api_id).first()
    if place:
        return place

    # 2. 외부 API에서 가져오기
    if not name_hint:
        return None

    # name으로 검색해서 place_api_id가 일치하는 것 찾기
    if provider == "KAKAO":
        results = await search_kakao_places(name_hint, limit=10)
    else:  # GOOGLE
        results = await search_google_places(name_hint, limit=10)

    # place_api_id 매칭
    place_data = None
    for result in results:
        if result.get("place_api_id") == place_api_id:
            place_data = result
            break

    if not place_data:
        return None

    # 3. DB에 저장
    place = Place(
        provider=place_data.get("provider"),
        place_api_id=place_data.get("place_api_id"),
        name=place_data.get("name"),
        address=place_data.get("address"),
        city=place_data.get("city"),
        latitude=place_data.get("latitude"),
        longitude=place_data.get("longitude"),
        category_main=place_data.get("category_main"),
        category_detail=place_data.get("category_detail"),
        thumbnail_urls=[]
    )

    db.add(place)
    db.commit()
    db.refresh(place)

    return place


async def search_kakao_places(query: str, limit: int = 15) -> List[Dict]:
    """
    카카오맵 API로 장소 검색
    """
    if not KAKAO_REST_API_KEY:
        return []

    url = "https://dapi.kakao.com/v2/local/search/keyword.json"
    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    params = {
        "query": query,
        "size": limit
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()

            results = []
            for doc in data.get("documents", []):
                # 카테고리 파싱 (예: "음식점 > 한식 > 찜,탕,찌개" -> ["음식점", "한식", "찜,탕,찌개"])
                category_detail = doc.get("category_name", "").split(" > ")

                results.append({
                    "provider": "KAKAO",
                    "place_api_id": doc.get("id"),
                    "name": doc.get("place_name"),
                    "address": doc.get("address_name") or doc.get("road_address_name", ""),
                    "city": extract_city_from_address(doc.get("address_name", "")),
                    "latitude": Decimal(doc.get("y", "0")),
                    "longitude": Decimal(doc.get("x", "0")),
                    "category_main": map_category_to_main(category_detail),
                    "category_detail": category_detail,
                    "thumbnail_url": None  # 카카오 API는 썸네일 미제공
                })

            return results

    except Exception as e:
        print(f"❌ 카카오맵 API 에러: {e}")

        return []


async def search_google_places(query: str, limit: int = 15) -> List[Dict]:
    """
    구글맵 API로 장소 검색
    """
    if not GOOGLE_MAPS_API_KEY:
        return []

    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    params = {
        "query": f"{query} 대한민국",  # 한국 내 검색 강제
        "key": GOOGLE_MAPS_API_KEY,
        "language": "ko"
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            results = []
            for place in data.get("results", [])[:limit]:
                location = place.get("geometry", {}).get("location", {})
                lat = Decimal(str(location.get("lat", 0)))
                lng = Decimal(str(location.get("lng", 0)))

                # 한국 범위 내 필터링
                if not is_korea_location(float(lat), float(lng)):
                    continue

                # 카테고리 영어 → 한국어 변환
                types_en = place.get("types", [])
                types_ko = [GOOGLE_CATEGORY_MAP.get(t, t) for t in types_en]

                # category_main 추출 (첫 번째 의미있는 카테고리)
                category_main = None
                for t in types_en:
                    if t in GOOGLE_CATEGORY_MAP and t not in ["point_of_interest", "establishment"]:
                        category_main = GOOGLE_CATEGORY_MAP[t]
                        break

                results.append({
                    "provider": "GOOGLE",
                    "place_api_id": place.get("place_id"),
                    "name": place.get("name"),
                    "address": place.get("formatted_address", ""),
                    "city": extract_city_from_address(place.get("formatted_address", "")),
                    "latitude": lat,
                    "longitude": lng,
                    "category_main": category_main,
                    "category_detail": types_ko,
                    "thumbnail_url": None  # 썸네일은 별도 API 필요
                })

            return results

    except Exception as e:
        print(f"❌ 구글맵 API 에러: {e}")

        return []


async def get_google_place_details(place_id: str) -> Optional[Dict]:
    """
    구글 Place Details API로 영업시간 등 상세 정보 조회
    """
    if not GOOGLE_MAPS_API_KEY:
        return None

    url = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {
        "place_id": place_id,
        "fields": "opening_hours,formatted_phone_number,website",
        "key": GOOGLE_MAPS_API_KEY,
        "language": "ko"
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            if data.get("status") != "OK":
                return None

            result = data.get("result", {})
            opening_hours = result.get("opening_hours", {})

            return {
                "opening_hours": opening_hours.get("weekday_text", []),
                "phone": result.get("formatted_phone_number", ""),
                "website": result.get("website", "")
            }

    except Exception as e:
        print(f"❌ 구글 Place Details API 에러: {e}")
        return None

