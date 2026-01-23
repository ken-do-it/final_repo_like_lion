import asyncio
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from models import Place
from services.external_places import search_google_places, search_kakao_places


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