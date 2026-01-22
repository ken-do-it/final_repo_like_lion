"""
Accommodations API Router
숙소 검색 전용 엔드포인트
"""
import httpx
from fastapi import APIRouter, Query
from typing import Optional, List
import asyncio
import zlib
from translation_client import translate_batch_proxy

from service import search_kakao_places, search_google_places, remove_duplicate_places, KAKAO_REST_API_KEY

router = APIRouter(prefix="/accommodations", tags=["Accommodations"])


# ==================== 숙소 전용 서비스 함수 ====================

async def search_accommodations_hybrid(query: str, city: str, limit: int = 30) -> List[dict]:
    """
    숙소 전용 검색 (카카오 + 구글)
    """
    # 카카오 API는 size 최대 15
    kakao_task = search_kakao_places(query, limit=15)
    google_task = search_google_places(query, limit=15)
    
    kakao_results, google_results = await asyncio.gather(kakao_task, google_task)
    
    all_results = kakao_results + google_results
    
    # 숙소 키워드 필터링
    accommodation_keywords = [
        "호텔", "모텔", "펜션", "게스트하우스", "리조트", "민박", "숙박", "여관",
        "hotel", "motel", "resort", "inn", "lodging", "hostel"
    ]
    
    filtered_results = []
    for result in all_results:
        name = result.get("name", "").lower()
        category_str = " ".join(result.get("category_detail", [])).lower()
        
        is_accommodation = any(
            kw.lower() in name or kw.lower() in category_str
            for kw in accommodation_keywords
        )
        
        if is_accommodation:
            result["category_main"] = "숙박"
            filtered_results.append(result)
    
    unique_results = remove_duplicate_places(filtered_results)
    
    if city:
        unique_results = [
            r for r in unique_results
            if city in r.get("address", "") or r.get("city") == city
        ]
    
    return unique_results[:limit]


# ==================== API 엔드포인트 ====================

@router.get("")
async def search_accommodations(
    city: str = Query(..., min_length=1, description="도시명 (필수)"),
    type: Optional[str] = Query(None, description="숙소 유형: 호텔, 모텔, 펜션, 게스트하우스, 리조트"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(15, ge=1, le=50, description="페이지당 개수"),
    lang: Optional[str] = Query(None, description="타겟 언어")
):
    """
    숙소 검색 API
    
    사용 예시:
    - GET /api/v1/accommodations?city=서울
    - GET /api/v1/accommodations?city=부산&type=호텔
    - GET /api/v1/accommodations?city=제주&type=펜션&page=2
    """
    type_keywords = {
        "호텔": "호텔",
        "모텔": "모텔",
        "펜션": "펜션",
        "게스트하우스": "게스트하우스",
        "리조트": "리조트",
        "민박": "민박",
    }
    
    if type and type in type_keywords:
        search_query = f"{city} {type_keywords[type]}"
    else:
        search_query = f"{city} 숙박"
    
    all_results = await search_accommodations_hybrid(search_query, city, limit=50)
    
    # 페이지네이션
    offset = (page - 1) * limit
    paginated_results = all_results[offset:offset + limit]

    # [AI 번역 적용]
    if lang:
        try:
            items_to_translate = []
            for res in paginated_results:
                # ID가 없으면 텍스트 해시를 ID로 사용
                entity_id_name = res.get("place_api_id") or (zlib.adler32(res.get("name", "").encode('utf-8')) & 0xffffffff)
                
                items_to_translate.append({
                    "text": res.get("name", ""),
                    "entity_type": "place_name",
                    "entity_id": entity_id_name,
                    "field": "name"
                })
                items_to_translate.append({
                    "text": res.get("address", ""),
                    "entity_type": "place_address",
                    "entity_id": entity_id_name,
                    "field": "address"
                })

            if items_to_translate:
                translated_map = await translate_batch_proxy(items_to_translate, lang)
                
                current_idx = 0
                for res in paginated_results:
                    if current_idx in translated_map:
                        res["name"] = translated_map[current_idx]
                    current_idx += 1
                    if current_idx in translated_map:
                        res["address"] = translated_map[current_idx]
                    current_idx += 1
        except Exception as e:
            print(f"Translation failed: {e}")
    
    return {
        "city": city,
        "type": type,
        "page": page,
        "limit": limit,
        "total": len(all_results),
        "count": len(paginated_results),
        "results": paginated_results
    }


@router.get("/types")
async def get_accommodation_types():
    """지원하는 숙소 유형 목록"""
    return {
        "types": [
            {"code": "호텔", "name": "호텔"},
            {"code": "모텔", "name": "모텔"},
            {"code": "펜션", "name": "펜션"},
            {"code": "게스트하우스", "name": "게스트하우스"},
            {"code": "리조트", "name": "리조트"},
            {"code": "민박", "name": "민박"},
        ]
    }


@router.get("/popular")
async def get_popular_cities():
    """숙소 검색 인기 도시"""
    return {
        "cities": ["서울", "부산", "제주", "강릉", "경주", "여수", "속초", "전주"]
    }


# 좌표 기반 검색 
@router.get("/nearby")
async def search_nearby_accommodations(
    lat: float = Query(..., description="위도"),
    lng: float = Query(..., description="경도"),
    radius: int = Query(5000, ge=100, le=20000, description="검색 반경 (미터)"),
    type: Optional[str] = Query(None, description="숙소 유형: 호텔, 모텔, 펜션, 게스트하우스, 리조트, 민박"),
    limit: int = Query(15, ge=1, le=50, description="결과 개수"),
    lang: Optional[str] = Query(None, description="타겟 언어")
):
    """
    좌표 기반 숙소 검색 (거리순 정렬)
    
    사용 예시:
    - GET /api/v1/accommodations/nearby?lat=37.5665&lng=126.978
    - GET /api/v1/accommodations/nearby?lat=37.5665&lng=126.978&radius=3000
    - GET /api/v1/accommodations/nearby?lat=37.5665&lng=126.978&type=호텔
    """
    
    type_keywords = {
        "호텔": "호텔",
        "모텔": "모텔",
        "펜션": "펜션",
        "게스트하우스": "게스트하우스",
        "리조트": "리조트",
        "민박": "민박",
    }
    
    search_keyword = type_keywords.get(type, "숙박")
    
    # 카카오 API 좌표 기반 검색
    url = "https://dapi.kakao.com/v2/local/search/keyword.json"
    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    params = {
        "query": search_keyword,
        "x": lng,
        "y": lat,
        "radius": radius,
        "sort": "distance",
        "size": 15
    }
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
            
            results = []
            accommodation_keywords = [
                "호텔", "모텔", "펜션", "게스트하우스", "리조트", "민박", "숙박", "여관",
                "hotel", "motel", "resort", "inn", "lodging", "hostel"
            ]
            
            for doc in data.get("documents", []):
                name = doc.get("place_name", "").lower()
                category_str = doc.get("category_name", "").lower()
                
                # 숙소 필터링
                is_accommodation = any(
                    kw.lower() in name or kw.lower() in category_str
                    for kw in accommodation_keywords
                )
                
                if is_accommodation:
                    results.append({
                        "provider": "KAKAO",
                        "place_api_id": doc.get("id"),
                        "name": doc.get("place_name"),
                        "address": doc.get("address_name") or doc.get("road_address_name", ""),
                        "latitude": float(doc.get("y", 0)),
                        "longitude": float(doc.get("x", 0)),
                        "distance": int(doc.get("distance", 0)),
                        "category_main": "숙박",
                        "category_detail": doc.get("category_name", "").split(" > "),
                        "thumbnail_url": None
                    })
            
            # [AI 번역 적용]
            if lang:
                try:
                    items_to_translate = []
                    # results 리스트 사용 (limit 적용 전 전체 결과 혹은 일부)
                    # 여기서는 results 전체를 대상으로 번역하지 않고 limit만큼 자른 후 번역하는 것이 효율적일 수 있으나
                    # 로직상 results 전체가 많지 않으므로(15개) 그냥 진행하거나 slicing 후 처리.
                    # 코드가 results[:limit]를 반환하므로, 슬라이싱된 리스트를 변수에 담고 번역.
                    
                    final_results = results[:limit]
                    
                    for res in final_results:
                        entity_id_name = res.get("place_api_id") or (zlib.adler32(res.get("name", "").encode('utf-8')) & 0xffffffff)
                        
                        items_to_translate.append({
                            "text": res.get("name", ""),
                            "entity_type": "place_name",
                            "entity_id": entity_id_name,
                            "field": "name"
                        })
                        items_to_translate.append({
                            "text": res.get("address", ""),
                            "entity_type": "place_address",
                            "entity_id": entity_id_name,
                            "field": "address"
                        })

                    if items_to_translate:
                        translated_map = await translate_batch_proxy(items_to_translate, lang)
                        
                        current_idx = 0
                        for res in final_results:
                            if current_idx in translated_map:
                                res["name"] = translated_map[current_idx]
                            current_idx += 1
                            if current_idx in translated_map:
                                res["address"] = translated_map[current_idx]
                            current_idx += 1
                            
                    return {
                        "lat": lat,
                        "lng": lng,
                        "radius": radius,
                        "type": type,
                        "total": len(results),
                        "results": final_results
                    }
                except Exception as e:
                    print(f"Translation failed: {e}")
                    # 실패 시 원본 반환
                    return {
                        "lat": lat,
                        "lng": lng,
                        "radius": radius,
                        "type": type,
                        "total": len(results),
                        "results": results[:limit]
                    }

            return {
                "lat": lat,
                "lng": lng,
                "radius": radius,
                "type": type,
                "total": len(results),
                "results": results[:limit]
            }
    
    except Exception as e:
        return {"error": f"검색 실패: {str(e)}"}