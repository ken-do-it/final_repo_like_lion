"""
Places Service - Business Logic
외부 API 통합, 인증 로직, 검색 로직
"""
import os
import httpx
import asyncio
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta, date
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc
from fastapi import HTTPException

from models import Place, PlaceReview, PlaceBookmark, LocalBadge, LocalColumn, User
from schemas import PlaceSearchResult


# ==================== 환경 변수 ====================

KAKAO_REST_API_KEY = os.getenv("YJ_KAKAO_REST_API_KEY", "")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

# 한국 위치 범위
KOREA_LAT_MIN = float(os.getenv("KOREA_LAT_MIN", "33"))
KOREA_LAT_MAX = float(os.getenv("KOREA_LAT_MAX", "43"))
KOREA_LON_MIN = float(os.getenv("KOREA_LON_MIN", "124"))
KOREA_LON_MAX = float(os.getenv("KOREA_LON_MAX", "132"))


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

                results.append({
                    "provider": "GOOGLE",
                    "place_api_id": place.get("place_id"),
                    "name": place.get("name"),
                    "address": place.get("formatted_address", ""),
                    "city": extract_city_from_address(place.get("formatted_address", "")),
                    "latitude": lat,
                    "longitude": lng,
                    "category_main": None,  # 구글은 카테고리 매핑 복잡
                    "category_detail": place.get("types", []),
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


# async def search_places_hybrid(query: str, category: Optional[str] = None,
#                                 city: Optional[str] = None, limit: int = 20) -> List[Dict]:
#     """
#     카카오 + 구글 병렬 검색 후 결과 통합
#     수정전
#     """
#     # 병렬 호출로 성능 최적화 (2초 → 1초)
#     kakao_task = search_kakao_places(query, limit=15)
#     google_task = search_google_places(query, limit=15)

#     kakao_results, google_results = await asyncio.gather(kakao_task, google_task)

#     # 결과 통합 및 중복 제거
#     all_results = kakao_results + google_results
#     unique_results = remove_duplicate_places(all_results)

#     # 필터링 적용
#     filtered_results = unique_results
#     if category:
#         # category_main 또는 category_detail에 포함되어 있으면 매칭
#         filtered_results = [
#             r for r in filtered_results
#             if r.get("category_main") == category
#             or (isinstance(r.get("category_detail"), list) and category in r.get("category_detail", []))
#         ]
#     if city:
#         filtered_results = [r for r in filtered_results if r.get("city") == city]

#     return filtered_results[:limit]

async def search_places_hybrid(query: str, category: Optional[str] = None,
                                city: Optional[str] = None, limit: int = 20) -> List[Dict]:
    """
    카카오 + 구글 병렬 검색 후 결과 통합
    카테고리 포함 검색 수정후
    """
    # ★ 추가: 카테고리가 있으면 검색어에 키워드 추가
    search_query = query
    if category:
        category_keywords = {
            "숙박": "호텔",
            "호텔": "호텔",
            "모텔": "모텔", 
            "펜션": "펜션",
            "음식점": "맛집",
            "카페": "카페",
            "관광명소": "관광",
        }
        keyword = category_keywords.get(category, category)
        if keyword not in query:  # 중복 방지
            search_query = f"{query} {keyword}"
    
    # ★ 수정: query → search_query로 변경
    kakao_task = search_kakao_places(search_query, limit=15)
    google_task = search_google_places(search_query, limit=15)

    kakao_results, google_results = await asyncio.gather(kakao_task, google_task)

    # 결과 통합 및 중복 제거
    all_results = kakao_results + google_results
    unique_results = remove_duplicate_places(all_results)

    # ★ 카테고리 필터링은 제거하거나 완화 (검색어에 이미 반영됨)
    # 기존 필터링 코드 삭제 또는 주석 처리
    
    if city:
        unique_results = [r for r in unique_results if r.get("city") == city]

    return unique_results[:limit]


def remove_duplicate_places(places: List[Dict]) -> List[Dict]:
    """
    이름 + 주소 유사도로 중복 제거
    """
    seen = set()
    unique = []

    for place in places:
        # 간단한 중복 체크: 이름 + 도시
        key = (place.get("name", "").lower(), place.get("city", "").lower())
        if key not in seen:
            seen.add(key)
            unique.append(place)

    return unique


# ==================== 역지오코딩 (좌표 → 도시) ====================

async def reverse_geocode(latitude: float, longitude: float) -> Optional[str]:
    """
    위도/경도 → 도시명 변환 (카카오 좌표→주소 API)
    """
    if not KAKAO_REST_API_KEY:
        return None

    url = "https://dapi.kakao.com/v2/local/geo/coord2address.json"
    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    params = {
        "x": longitude,
        "y": latitude
    }

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()

            if data.get("documents"):
                address = data["documents"][0].get("address", {})
                region = address.get("region_1depth_name", "")
                # "서울특별시" -> "서울"
                city = region.replace("특별시", "").replace("광역시", "").replace("도", "").strip()
                return city

    except Exception as e:
        print(f"❌ 역지오코딩 에러: {e}")

    return None


def is_korea_location(latitude: float, longitude: float) -> bool:
    """
    한국 내 위치인지 확인
    """
    return (KOREA_LAT_MIN <= latitude <= KOREA_LAT_MAX and
            KOREA_LON_MIN <= longitude <= KOREA_LON_MAX)


# ==================== 현지인 인증 시스템 ====================

def calculate_next_due(current_level: int, auth_count: int) -> date:
    """
    레벨별 다음 인증 예정일 계산

    Level 1: 1주일 (3번 인증 필요)
    Level 2: 1개월
    Level 3: 6개월
    Level 4: 1년
    Level 5: 1년 (반복)
    """
    today = date.today()

    if current_level == 1:
        return today + timedelta(weeks=1)
    elif current_level == 2:
        return today + timedelta(days=30)
    elif current_level == 3:
        return today + timedelta(days=180)
    elif current_level in [4, 5]:
        return today + timedelta(days=365)

    return today + timedelta(weeks=1)  # 기본값


async def authenticate_local_badge(
    db: Session,
    user_id: int,
    latitude: float,
    longitude: float
) -> Tuple[LocalBadge, str]:
    """
    현지인 인증 처리

    Returns:
        (LocalBadge, message)
    """
    # 1. 위치 확인
    if not is_korea_location(latitude, longitude):
        raise HTTPException(status_code=400, detail="한국 내 위치에서만 인증 가능합니다")

    city = await reverse_geocode(latitude, longitude)
    if not city:
        raise HTTPException(status_code=400, detail="도시를 확인할 수 없습니다")

    # 2. 기존 뱃지 조회
    badge = db.query(LocalBadge).filter(LocalBadge.user_id == user_id).first()

    # 3. 첫 인증
    if not badge:
        badge = LocalBadge(
            user_id=user_id,
            city=city,
            level=1,
            is_active=True,
            first_authenticated_at=date.today(),
            last_authenticated_at=date.today(),
            next_authentication_due=calculate_next_due(1, 1),
            maintenance_months=0
        )
        db.add(badge)
        db.commit()
        db.refresh(badge)
        return badge, f"{city} 현지인 인증을 시작했습니다! (Level 1)"

    # 4. 재인증 (만료된 경우)
    if not badge.is_active:
        badge.level = 2
        badge.city = city
        badge.is_active = True
        badge.last_authenticated_at = date.today()
        badge.next_authentication_due = calculate_next_due(2, 1)
        db.commit()
        db.refresh(badge)
        return badge, f"{city} 현지인 인증을 재개했습니다! (Level 2)"

    # 5. 정상 인증 (레벨 업그레이드 로직)
    badge.last_authenticated_at = date.today()
    old_level = badge.level

    # Level 1 → 2 (3번 인증)
    if badge.level == 1:
        # authentication_count는 모델에 없으므로 간단히 처리
        # 실제로는 별도 카운트 필드 필요
        badge.level = 2
        badge.maintenance_months = 1
        message = f"{city} 현지인 Level 2 달성! 이제 칼럼을 작성할 수 있습니다."

    # Level 2 → 3
    elif badge.level == 2:
        badge.level = 3
        badge.maintenance_months += 1
        message = f"{city} 현지인 Level 3 달성!"

    # Level 3 → 4
    elif badge.level == 3:
        badge.level = 4
        badge.maintenance_months += 6
        message = f"{city} 현지인 Level 4 달성!"

    # Level 4 → 5
    elif badge.level == 4:
        badge.level = 5
        badge.maintenance_months += 12
        message = f"{city} 현지인 Level 5 달성! 최고 레벨입니다."

    # Level 5 유지
    else:
        badge.maintenance_months += 12
        message = f"{city} 현지인 Level 5 유지 중"

    badge.next_authentication_due = calculate_next_due(badge.level, 0)
    db.commit()
    db.refresh(badge)

    return badge, message


def check_local_badge_active(db: Session, user_id: int) -> LocalBadge:
    """
    현지인 칼럼 작성 권한 확인
    """
    badge = db.query(LocalBadge).filter(LocalBadge.user_id == user_id).first()

    if not badge:
        raise HTTPException(status_code=403, detail="현지인 인증이 필요합니다")

    if not badge.is_active:
        raise HTTPException(
            status_code=403,
            detail=f"인증이 만료되었습니다. 다음 인증 예정일: {badge.next_authentication_due}"
        )

    return badge


# ==================== 헬퍼 함수 ====================

def extract_city_from_address(address: str) -> Optional[str]:
    """
    주소에서 도시명 추출
    예: "서울특별시 강남구 역삼동" -> "서울"
    """
    if not address:
        return None

    parts = address.split()
    if len(parts) > 0:
        city = parts[0]
        city = city.replace("특별시", "").replace("광역시", "").replace("도", "").strip()
        return city

    return None


def map_category_to_main(category_detail: List[str]) -> Optional[str]:

    # # """
    # # 카카오 카테고리 → 메인 카테고리 매핑
    # # 수정전
    # # """
    # if not category_detail:
    #     return None

    # first_category = category_detail[0] if category_detail else ""

    # mapping = {
    #     "음식점": "음식점",
    #     "카페": "카페",
    #     "관광명소": "관광명소",
    #     "숙박": "숙박",
    #     "문화시설": "문화시설",
    #     "쇼핑": "쇼핑",
    #     "병원": "병원",
    #     "편의점": "편의점",
    #     "은행": "은행",
    #     "주차장": "주차장"
    # }

    # for key, value in mapping.items():
    #     if key in first_category:
    #         return value

    # return "기타"

    """
    카카오 카테고리 → 메인 카테고리 매핑
    전체 카테고리 리스트를 검사하여 매핑
    수정본
    """
    if not category_detail:
        return None

    # 전체 카테고리를 하나의 문자열로 합침
    full_category = " ".join(category_detail)

    # 우선순위 순으로 매핑 (구체적인 것 먼저)
    mapping_rules = [
        (["호텔", "모텔", "펜션", "게스트하우스", "리조트", "민박", "숙박"], "숙박"),
        (["음식점", "식당", "맛집"], "음식점"),
        (["카페", "커피"], "카페"),
        (["관광", "명소", "여행"], "관광명소"),
        (["문화시설", "박물관", "미술관", "공연장"], "문화시설"),
        (["쇼핑", "백화점", "마트", "시장"], "쇼핑"),
        (["병원", "의원", "약국"], "병원"),
        (["편의점"], "편의점"),
        (["은행", "ATM"], "은행"),
        (["주차장"], "주차장"),
    ]

    for keywords, category in mapping_rules:
        for keyword in keywords:
            if keyword in full_category:
                return category

    return "기타"


# ==================== 리뷰 통계 업데이트 ====================

def update_place_review_stats(db: Session, place_id: int):
    """
    장소의 평균 별점 및 리뷰 수 업데이트 (캐시)
    """
    place = db.query(Place).filter(Place.id == place_id).first()
    if not place:
        return

    reviews = db.query(PlaceReview).filter(PlaceReview.place_id == place_id).all()

    if reviews:
        total_rating = sum(r.rating for r in reviews)
        place.average_rating = Decimal(total_rating / len(reviews))
        place.review_count = len(reviews)
    else:
        place.average_rating = Decimal(0)
        place.review_count = 0

    db.commit()


def update_place_thumbnails(db: Session, place_id: int, new_image_url: str):
    """
    리뷰 이미지를 장소 썸네일에 추가 (최대 3장)
    """
    place = db.query(Place).filter(Place.id == place_id).first()
    if not place:
        return

    thumbnails = place.thumbnail_urls or []

    if len(thumbnails) < 3 and new_image_url not in thumbnails:
        thumbnails.append(new_image_url)
        place.thumbnail_urls = thumbnails
        db.commit()
