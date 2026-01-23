from decimal import Decimal
from typing import Dict, List, Optional

import httpx
from sqlalchemy.orm import Session

from models import Place
from services.categories import GOOGLE_CATEGORY_MAP, map_category_to_main
from services.config import GOOGLE_MAPS_API_KEY, KAKAO_REST_API_KEY
from services.geo import extract_city_from_address, is_korea_location


async def get_or_create_place_by_api_id(
    db: Session,
    place_api_id: str,
    provider: str = "KAKAO",
    name_hint: Optional[str] = None,
) -> Optional[Place]:
    place = db.query(Place).filter(Place.place_api_id == place_api_id).first()
    if place:
        return place

    if not name_hint:
        return None

    if provider == "KAKAO":
        results = await search_kakao_places(name_hint, limit=10)
    else:
        results = await search_google_places(name_hint, limit=10)

    place_data = None
    for result in results:
        if result.get("place_api_id") == place_api_id:
            place_data = result
            break

    if not place_data:
        return None

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
        thumbnail_urls=[],
    )

    db.add(place)
    db.commit()
    db.refresh(place)

    return place


async def search_kakao_places(query: str, limit: int = 15) -> List[Dict]:
    if not KAKAO_REST_API_KEY:
        return []

    url = "https://dapi.kakao.com/v2/local/search/keyword.json"
    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    params = {"query": query, "size": limit}

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()

            results = []
            for doc in data.get("documents", []):
                category_detail = doc.get("category_name", "").split(" > ")
                results.append(
                    {
                        "provider": "KAKAO",
                        "place_api_id": doc.get("id"),
                        "name": doc.get("place_name"),
                        "address": doc.get("address_name")
                        or doc.get("road_address_name", ""),
                        "city": extract_city_from_address(doc.get("address_name", "")),
                        "latitude": Decimal(doc.get("y", "0")),
                        "longitude": Decimal(doc.get("x", "0")),
                        "category_main": map_category_to_main(category_detail),
                        "category_detail": category_detail,
                        "thumbnail_url": None,
                    }
                )

            return results
    except Exception as e:
        print(f"Kakao place search failed: {e}")
        return []


async def search_google_places(query: str, limit: int = 15) -> List[Dict]:
    if not GOOGLE_MAPS_API_KEY:
        return []

    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    params = {
        "query": f"{query} 대한민국",
        "key": GOOGLE_MAPS_API_KEY,
        "language": "ko",
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

                if not is_korea_location(float(lat), float(lng)):
                    continue

                types_en = place.get("types", [])
                types_ko = [GOOGLE_CATEGORY_MAP.get(t, t) for t in types_en]

                category_main = None
                for t in types_en:
                    if t in GOOGLE_CATEGORY_MAP and t not in [
                        "point_of_interest",
                        "establishment",
                    ]:
                        category_main = GOOGLE_CATEGORY_MAP[t]
                        break

                results.append(
                    {
                        "provider": "GOOGLE",
                        "place_api_id": place.get("place_id"),
                        "name": place.get("name"),
                        "address": place.get("formatted_address", ""),
                        "city": extract_city_from_address(place.get("formatted_address", "")),
                        "latitude": lat,
                        "longitude": lng,
                        "category_main": category_main,
                        "category_detail": types_ko,
                        "thumbnail_url": None,
                    }
                )

            return results
    except Exception as e:
        print(f"Google place search failed: {e}")
        return []


async def get_google_place_details(place_id: str) -> Optional[Dict]:
    if not GOOGLE_MAPS_API_KEY:
        return None

    url = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {
        "place_id": place_id,
        "fields": "opening_hours,formatted_phone_number,website",
        "key": GOOGLE_MAPS_API_KEY,
        "language": "ko",
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
                "website": result.get("website", ""),
            }
    except Exception as e:
        print(f"Google place details failed: {e}")
        return None
