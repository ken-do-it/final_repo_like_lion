import asyncio
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from models import Place
from services.external_places import search_google_places, search_kakao_places


def normalize_name(name: str) -> str:
    import re

    if not name:
        return ""
    normalized = re.sub(r"[^\w\uAC00-\uD7A3]", "", name.lower())
    return normalized


def remove_duplicate_places(places: List[Dict]) -> List[Dict]:
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

            if name == existing_name:
                lat_diff = abs(lat - existing_lat)
                lng_diff = abs(lng - existing_lng)
                if lat_diff < 0.001 and lng_diff < 0.001:
                    is_duplicate = True
                    break

        if not is_duplicate:
            unique.append(place)

    return unique


async def search_places_hybrid(
    query: str,
    category: Optional[str] = None,
    city: Optional[str] = None,
    db: Session = None,
) -> List[Dict]:
    search_query = query
    if category:
        category_keywords = {
            "숙박": "호텔",
            "호텔": "호텔",
            "모텔": "모텔",
            "리조트": "리조트",
            "음식점": "맛집",
            "카페": "카페",
            "관광명소": "관광지",
        }
        keyword = category_keywords.get(category, category)
        if keyword not in query:
            search_query = f"{query} {keyword}"

    kakao_task = search_kakao_places(search_query, limit=15)
    google_task = search_google_places(search_query, limit=15)

    kakao_results, google_results = await asyncio.gather(kakao_task, google_task)

    all_results = kakao_results + google_results
    unique_results = remove_duplicate_places(all_results)

    if city:
        unique_results = [r for r in unique_results if r.get("city") == city]

    if db:
        api_ids = [r["place_api_id"] for r in unique_results if r.get("place_api_id")]
        if api_ids:
            existing_places = (
                db.query(Place).filter(Place.place_api_id.in_(api_ids)).all()
            )
            place_map = {p.place_api_id: p for p in existing_places}

            for result in unique_results:
                api_id = result.get("place_api_id")
                if api_id and api_id in place_map:
                    db_place = place_map[api_id]
                    result["id"] = db_place.id
                    if db_place.thumbnail_urls:
                        result["thumbnail_urls"] = db_place.thumbnail_urls
                    result["average_rating"] = (
                        float(db_place.average_rating) if db_place.average_rating else 0.0
                    )
                    result["review_count"] = db_place.review_count or 0

    return unique_results
