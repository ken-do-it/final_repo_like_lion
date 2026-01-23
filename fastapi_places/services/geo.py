from typing import Optional

import httpx

from services.config import (
    KAKAO_REST_API_KEY,
    KOREA_LAT_MAX,
    KOREA_LAT_MIN,
    KOREA_LON_MAX,
    KOREA_LON_MIN,
)


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


def is_korea_location(latitude: float, longitude: float) -> bool:
    """
    한국 내 위치인지 확인
    """
    return (KOREA_LAT_MIN <= latitude <= KOREA_LAT_MAX and
            KOREA_LON_MIN <= longitude <= KOREA_LON_MAX)


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
