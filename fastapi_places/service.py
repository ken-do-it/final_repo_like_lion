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
from sqlalchemy.orm.attributes import flag_modified
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

# 구글 카테고리 영어 → 한국어 매핑
GOOGLE_CATEGORY_MAP = {
    # 음식/음료
    "restaurant": "음식점",
    "cafe": "카페",
    "bakery": "베이커리",
    "bar": "바",
    "food": "음식점",
    "meal_delivery": "배달음식",
    "meal_takeaway": "포장음식",
    # 숙박
    "lodging": "숙박",
    "hotel": "호텔",
    "motel": "모텔",
    "guest_house": "게스트하우스",
    # 관광/레저
    "tourist_attraction": "관광명소",
    "museum": "박물관",
    "art_gallery": "미술관",
    "park": "공원",
    "amusement_park": "놀이공원",
    "aquarium": "아쿠아리움",
    "zoo": "동물원",
    "stadium": "경기장",
    "casino": "카지노",
    "night_club": "나이트클럽",
    # 쇼핑
    "shopping_mall": "쇼핑몰",
    "department_store": "백화점",
    "store": "상점",
    "convenience_store": "편의점",
    "supermarket": "슈퍼마켓",
    "clothing_store": "의류매장",
    "shoe_store": "신발매장",
    "jewelry_store": "보석상",
    "book_store": "서점",
    # 교통
    "airport": "공항",
    "train_station": "기차역",
    "subway_station": "지하철역",
    "bus_station": "버스터미널",
    "taxi_stand": "택시승강장",
    "parking": "주차장",
    # 기타
    "spa": "스파",
    "gym": "헬스장",
    "beauty_salon": "미용실",
    "hospital": "병원",
    "pharmacy": "약국",
    "bank": "은행",
    "atm": "ATM",
    "church": "교회",
    "temple": "사찰",
    "point_of_interest": "명소",
    "establishment": "시설",
}


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
                                city: Optional[str] = None, db: Session = None) -> List[Dict]:
    """
    카카오 + 구글 병렬 검색 후 결과 통합
    모든 결과 반환 (페이지네이션 없음)
    DB에 이미 있는 장소인지 확인하여 id 포함
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

    if city:
        unique_results = [r for r in unique_results if r.get("city") == city]

    # ★ DB 존재 여부 확인 및 추가 정보 주입
    if db:
        # 검색 결과의 API ID 목록 추출
        api_ids = [r["place_api_id"] for r in unique_results if r.get("place_api_id")]

        if api_ids:
            # DB에서 해당 API ID를 가진 장소 조회
            existing_places = db.query(Place).filter(Place.place_api_id.in_(api_ids)).all()

            # {place_api_id: Place} 매핑 생성
            place_map = {p.place_api_id: p for p in existing_places}

            # 결과에 DB 정보 추가
            for result in unique_results:
                api_id = result.get("place_api_id")
                if api_id and api_id in place_map:
                    db_place = place_map[api_id]
                    result["id"] = db_place.id
                    # DB에 저장된 썸네일이 있으면 사용
                    if db_place.thumbnail_urls:
                        result["thumbnail_urls"] = db_place.thumbnail_urls
                    # 평점 및 리뷰 수 추가
                    result["average_rating"] = float(db_place.average_rating) if db_place.average_rating else 0.0
                    result["review_count"] = db_place.review_count or 0

    return unique_results


def normalize_name(name: str) -> str:
    """
    장소명 정규화 (중복 비교용)
    - 공백, 특수문자 제거
    - 소문자 변환
    """
    import re
    if not name:
        return ""
    # 공백, 특수문자 제거 (한글, 영문, 숫자만 유지)
    normalized = re.sub(r'[^\w가-힣]', '', name.lower())
    return normalized


def remove_duplicate_places(places: List[Dict]) -> List[Dict]:
    """
    이름 + 좌표 기반 중복 제거
    - 이름 정규화 후 완전 일치 비교
    - 좌표 거리로 중복 판단 (100m 이내)
    - 카카오 결과 우선 (먼저 들어온 것 유지)
    """
    unique = []

    for place in places:
        name = normalize_name(place.get("name", ""))
        lat = place.get("latitude", 0)
        lng = place.get("longitude", 0)

        is_duplicate = False
        for existing in unique:
            existing_name = normalize_name(existing.get("name", ""))
            existing_lat = existing.get("latitude", 0)
            existing_lng = existing.get("longitude", 0)

            # 정규화된 이름이 완전히 같은 경우만 체크
            if name == existing_name:
                # 좌표 거리 체크 (약 100m 이내면 중복)
                lat_diff = abs(lat - existing_lat)
                lng_diff = abs(lng - existing_lng)
                if lat_diff < 0.001 and lng_diff < 0.001:
                    is_duplicate = True
                    break

        if not is_duplicate:
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


async def geocode_address(address: str) -> Optional[dict]:
    """
    주소 → 좌표 + 도로명 주소 변환 (카카오 주소 검색 API)

    Returns:
        {
            "road_address": "서울 강남구 테헤란로 123",
            "latitude": 37.5665,
            "longitude": 126.9780
        }
        또는 None (주소를 찾을 수 없는 경우)
    """
    if not KAKAO_REST_API_KEY:
        return None

    url = "https://dapi.kakao.com/v2/local/search/address.json"
    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    params = {"query": address}

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()

            if data.get("documents"):
                doc = data["documents"][0]

                # 도로명 주소 우선, 없으면 지번 주소
                road_address = doc.get("road_address")
                if road_address:
                    address_name = road_address.get("address_name")
                else:
                    address_name = doc.get("address", {}).get("address_name")

                return {
                    "road_address": address_name,
                    "latitude": float(doc.get("y")),
                    "longitude": float(doc.get("x"))
                }

    except Exception as e:
        print(f"❌ 주소 검색 에러: {e}")

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

    Level 1→2: 1주일
    Level 2→3: 1주일
    Level 3→4: 6개월
    Level 4→5: 1년
    Level 5: 1년 (반복)
    """
    today = date.today()

    if current_level == 1:
        return today + timedelta(weeks=1)
    elif current_level == 2:
        return today + timedelta(weeks=1)
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

    로직:
    - Level 1: 첫 인증
    - Level 2: 1주일 후 재인증
    - Level 3: 또 1주일 후 재인증 (글 작성 가능)
    - Level 4: 6개월 후 재인증
    - Level 5: 1년 후 재인증, 이후 1년 주기
    - 인증일 지나면 비활성화, 재인증 시 이전 레벨 유지

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
            next_authentication_due=calculate_next_due(1, 0),
            maintenance_months=0
        )
        db.add(badge)
        db.commit()
        db.refresh(badge)
        return badge, f"{city} 현지인 인증을 시작했습니다! (Level 1) 1주일 후 재인증 가능합니다."

    # 4. 인증일 확인
    today = date.today()

    # 4-1. 인증일이 지나서 비활성화된 경우 → 재활성화 (레벨 유지)
    if not badge.is_active:
        badge.city = city
        badge.is_active = True
        badge.last_authenticated_at = today
        badge.next_authentication_due = calculate_next_due(badge.level, 0)
        db.commit()
        db.refresh(badge)
        return badge, f"{city} 현지인 인증을 재개했습니다! (Level {badge.level} 유지)"

    # 4-2. 아직 인증일이 안 됨 → 에러
    if today < badge.next_authentication_due:
        days_left = (badge.next_authentication_due - today).days
        raise HTTPException(
            status_code=400,
            detail=f"다음 인증일은 {badge.next_authentication_due}입니다. ({days_left}일 남음)"
        )

    # 4-3. 인증일이 지났지만 아직 활성화 상태 → 비활성화 처리
    # (실제로는 배치 작업으로 해야 하지만, 여기서 처리)
    if today > badge.next_authentication_due:
        badge.is_active = False
        badge.city = city
        badge.last_authenticated_at = today
        badge.next_authentication_due = calculate_next_due(badge.level, 0)
        db.commit()
        db.refresh(badge)
        return badge, f"인증 기한이 지나 재인증했습니다. (Level {badge.level} 유지)"

    # 5. 정상 인증 (레벨 업그레이드)
    badge.last_authenticated_at = today
    old_level = badge.level

    # Level 1 → 2
    if badge.level == 1:
        badge.level = 2
        badge.maintenance_months = 0
        message = f"{city} 현지인 Level 2 달성! 1주일 후 재인증 가능합니다."

    # Level 2 → 3
    elif badge.level == 2:
        badge.level = 3
        badge.maintenance_months = 0
        message = f"{city} 현지인 Level 3 달성! 이제 칼럼을 작성할 수 있습니다. 6개월 후 재인증 가능합니다."

    # Level 3 → 4
    elif badge.level == 3:
        badge.level = 4
        badge.maintenance_months = 6
        message = f"{city} 현지인 Level 4 달성! 1년 후 재인증 가능합니다."

    # Level 4 → 5
    elif badge.level == 4:
        badge.level = 5
        badge.maintenance_months = 12
        message = f"{city} 현지인 Level 5 달성! 최고 레벨입니다. 1년 후 재인증 필요합니다."

    # Level 5 유지
    else:
        badge.maintenance_months += 12
        message = f"{city} 현지인 Level 5 유지! 1년 후 재인증 필요합니다."

    badge.next_authentication_due = calculate_next_due(badge.level, 0)
    db.commit()
    db.refresh(badge)

    return badge, message


def check_local_badge_active(db: Session, user_id: int) -> LocalBadge:
    """
    현지인 칼럼 작성 권한 확인
    Level 3 이상, 활성화 상태여야 가능
    """
    badge = db.query(LocalBadge).filter(LocalBadge.user_id == user_id).first()

    # [TEMPORARY TEST MODE] 모든 사용자에게 Level 5 권한 부여 (테스트용)
    # 번역 기능 테스트 종료 후 반드시 삭제/원복 필요
    if True:
        # 가짜 뱃지 객체 반환 (레벨 5)
        # badge가 있으면 그것을 사용하지 않고, 무조건 레벨 5로 덮어쓰거나 새로 생성
        if not badge:
            badge = LocalBadge(
                user_id=user_id,
                city="테스트 City",
                level=5,
                is_active=True,
                first_authenticated_at=date.today(),
                last_authenticated_at=date.today(),
                next_authentication_due=date.today() + timedelta(days=365)
            )
        else:
            # 기존 뱃지가 있어도 레벨 5로 간주 (객체 속성 변경은 DB 저장 안함)
            badge.level = 5
            badge.is_active = True
        return badge

    """
    # [Superuser Bypass] 관리자는 무조건 통과 (Raw SQL 사용 - Safe Check)
    try:
        from sqlalchemy import text
        # users 테이블에 is_superuser 컬럼이 있는지 확인하고 값 조회
        result = db.execute(text("SELECT is_superuser FROM users WHERE id = :uid"), {"uid": user_id}).first()
        if result and result[0]:  # is_superuser == True
            # 가짜 뱃지 객체 반환 (레벨 5)
            if not badge:
                badge = LocalBadge(
                    user_id=user_id,
                    city="Superuser City",
                    level=5,
                    is_active=True,
                    first_authenticated_at=date.today(),
                    last_authenticated_at=date.today(),
                    next_authentication_due=date.today() + timedelta(days=365)
                )
            return badge
    except Exception as e:
        # 컬럼이 없거나 에러 발생 시 무시하고 일반 로직 진행
        print(f"[Warning] Superuser check failed: {e}")
    """

    if not badge:
        raise HTTPException(status_code=403, detail="현지인 인증이 필요합니다")

    if badge.level < 3:
        raise HTTPException(
            status_code=403,
            detail=f"칼럼 작성은 Level 3부터 가능합니다. (현재 Level {badge.level})"
        )

    # 만료 체크: 인증일이 지났으면 자동으로 비활성화
    if badge.is_active and date.today() > badge.next_authentication_due:
        badge.is_active = False
        db.commit()

    if not badge.is_active:
        raise HTTPException(
            status_code=403,
            detail="인증이 만료되었습니다. 재인증이 필요합니다."
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


def remove_place_thumbnail(db: Session, place_id: int, image_url: str):
    """
    장소 썸네일에서 특정 이미지 URL 제거
    """
    if not image_url:
        return

    place = db.query(Place).filter(Place.id == place_id).first()
    if not place:
        return

    # 리스트 복사 (SQLAlchemy JSON 필드 변경 감지를 위해)
    thumbnails = list(place.thumbnail_urls or [])

    if image_url in thumbnails:
        thumbnails.remove(image_url)
        place.thumbnail_urls = thumbnails
        flag_modified(place, "thumbnail_urls")  # JSON 필드 변경 명시
        db.commit()
