from typing import Optional

import httpx

from services.config import (
    KAKAO_REST_API_KEY,
    KOREA_LAT_MAX,
    KOREA_LAT_MIN,
    KOREA_LON_MAX,
    KOREA_LON_MIN,
)


def extract_city_from_address(address: str) -> Optional[str]:
    if not address:
        return None

    parts = address.split()
    if len(parts) > 0:
        city = parts[0]
        city = city.replace("특별시", "").replace("광역시", "").replace("도", "").strip()
        return city

    return None


def is_korea_location(latitude: float, longitude: float) -> bool:
    return (
        KOREA_LAT_MIN <= latitude <= KOREA_LAT_MAX
        and KOREA_LON_MIN <= longitude <= KOREA_LON_MAX
    )


async def reverse_geocode(latitude: float, longitude: float) -> Optional[str]:
    if not KAKAO_REST_API_KEY:
        return None

    url = "https://dapi.kakao.com/v2/local/geo/coord2address.json"
    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    params = {"x": longitude, "y": latitude}

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()

            if data.get("documents"):
                address = data["documents"][0].get("address", {})
                region = address.get("region_1depth_name", "")
                city = region.replace("특별시", "").replace("광역시", "").replace("도", "").strip()
                return city
    except Exception as e:
        print(f"Kakao reverse geocode failed: {e}")

    return None


async def geocode_address(address: str) -> Optional[dict]:
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
                road_address = doc.get("road_address")
                if road_address:
                    address_name = road_address.get("address_name")
                else:
                    address_name = doc.get("address", {}).get("address_name")

                return {
                    "road_address": address_name,
                    "latitude": float(doc.get("y")),
                    "longitude": float(doc.get("x")),
                }
    except Exception as e:
        print(f"Kakao geocode failed: {e}")

    return None
