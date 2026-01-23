import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth import get_current_user, require_auth
from database import get_db
from models import Place, PlaceBookmark
from schemas import PlaceCreateRequest, PlaceDetailResponse
from services.config import KAKAO_REST_API_KEY
from services.external_places import (
    get_or_create_place_by_api_id,
    get_google_place_details,
    search_google_places,
    search_kakao_places,
)
from services.geo import geocode_address, reverse_geocode
from services.translation_helpers import (
    translate_place_detail_basic,
    translate_place_detail_with_city,
)


logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/detail")
async def get_place_detail_by_api_id(
    place_api_id: str = Query(..., description="External place id"),
    provider: str = Query("KAKAO", description="Provider (KAKAO, GOOGLE)"),
    name: str = Query(..., description="Place name"),
    lang: Optional[str] = Query(None, description="Target language"),
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_current_user),
):
    place = await get_or_create_place_by_api_id(
        db=db,
        place_api_id=place_api_id,
        provider=provider,
        name_hint=name,
    )

    if not place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다.")

    phone = ""
    place_url = ""
    opening_hours = []

    if provider == "KAKAO":
        import httpx

        if KAKAO_REST_API_KEY:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(
                        "https://dapi.kakao.com/v2/local/search/keyword.json",
                        headers={"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"},
                        params={"query": name, "size": 5},
                    )
                    if response.status_code == 200:
                        data = response.json()
                        for doc in data.get("documents", []):
                            if doc.get("id") == place_api_id:
                                phone = doc.get("phone", "")
                                place_url = doc.get("place_url", "")
                                break
            except Exception:
                logger.exception("카카오 상세 조회 실패")

        google_results = await search_google_places(f"{place.name} {place.address}", limit=3)
        if google_results:
            google_place_id = google_results[0].get("place_api_id")
            if google_place_id:
                google_details = await get_google_place_details(google_place_id)
                if google_details:
                    opening_hours = google_details.get("opening_hours", [])

    elif provider == "GOOGLE":
        google_details = await get_google_place_details(place_api_id)
        if google_details:
            phone = google_details.get("phone", "")
            opening_hours = google_details.get("opening_hours", [])
            place_url = google_details.get("website", "")

    is_bookmarked = False
    if user_id:
        bookmark = (
            db.query(PlaceBookmark)
            .filter(
                PlaceBookmark.user_id == user_id,
                PlaceBookmark.place_id == place.id,
            )
            .first()
        )
        is_bookmarked = bookmark is not None

    result_data = {
        "id": place.id,
        "provider": place.provider,
        "place_api_id": place.place_api_id,
        "name": place.name,
        "address": place.address,
        "city": place.city,
        "latitude": float(place.latitude),
        "longitude": float(place.longitude),
        "category_main": place.category_main,
        "category_detail": place.category_detail,
        "thumbnail_urls": place.thumbnail_urls,
        "average_rating": float(place.average_rating) if place.average_rating else 0.0,
        "review_count": place.review_count,
        "created_at": place.created_at,
        "updated_at": place.updated_at,
        "phone": phone,
        "place_url": place_url,
        "opening_hours": opening_hours,
        "is_bookmarked": is_bookmarked,
    }

    if lang:
        try:
            result_data = await translate_place_detail_with_city(
                result_data,
                place.id,
                opening_hours,
                lang,
            )
        except Exception:
            logger.exception("상세 번역 실패")

    return result_data


@router.post("/create", response_model=PlaceDetailResponse)
async def create_user_place(
    place_data: PlaceCreateRequest,
    force: bool = Query(False, description="유사 장소가 있어도 강제로 생성"),
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db),
):
    geocode_result = await geocode_address(place_data.address)
    if not geocode_result:
        raise HTTPException(
            status_code=400,
            detail="주소를 검증할 수 없습니다.",
        )

    verified_address = geocode_result["road_address"]
    verified_lat = geocode_result["latitude"]
    verified_lng = geocode_result["longitude"]

    lat_diff = abs(verified_lat - place_data.latitude)
    lng_diff = abs(verified_lng - place_data.longitude)
    if lat_diff > 0.001 or lng_diff > 0.001:
        raise HTTPException(
            status_code=400,
            detail="주소와 좌표가 일치하지 않습니다.",
        )

    city = await reverse_geocode(verified_lat, verified_lng)

    if not force:
        kakao_results = await search_kakao_places(place_data.name, verified_address)
        if kakao_results:
            raise HTTPException(
                status_code=400,
                detail="카카오에 이미 등록된 장소입니다.",
            )

        google_results = await search_google_places(f"{place_data.name} {verified_address}")
        if google_results:
            raise HTTPException(
                status_code=400,
                detail="구글에 이미 등록된 장소입니다.",
            )

        if city:
            search_keyword = place_data.name.split()[0] if place_data.name.split() else place_data.name
            similar_places = (
                db.query(Place)
                .filter(
                    Place.city == city,
                    Place.name.contains(search_keyword),
                )
                .limit(5)
                .all()
            )

            if similar_places:
                similar_list = [
                    {
                        "id": p.id,
                        "name": p.name,
                        "address": p.address,
                        "city": p.city,
                        "provider": p.provider,
                    }
                    for p in similar_places
                ]
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": "유사한 장소가 있습니다. 강제 생성하려면 force를 사용하세요.",
                        "similar_places": similar_list,
                    },
                )

    new_place = Place(
        provider="USER",
        place_api_id=None,
        name=place_data.name,
        address=verified_address,
        city=city,
        latitude=verified_lat,
        longitude=verified_lng,
        category_main=place_data.category_main,
        category_detail=place_data.category_detail or [],
        thumbnail_urls=[],
        average_rating=0.00,
        review_count=0,
        created_by_id=user_id,
    )

    db.add(new_place)
    db.commit()
    db.refresh(new_place)

    return PlaceDetailResponse(
        id=new_place.id,
        provider=new_place.provider,
        place_api_id=new_place.place_api_id,
        name=new_place.name,
        address=new_place.address,
        city=new_place.city,
        latitude=new_place.latitude,
        longitude=new_place.longitude,
        category_main=new_place.category_main,
        category_detail=new_place.category_detail,
        thumbnail_urls=new_place.thumbnail_urls,
        average_rating=new_place.average_rating,
        review_count=new_place.review_count,
        created_at=new_place.created_at,
        updated_at=new_place.updated_at,
        phone="",
        place_url="",
        opening_hours=[],
    )


@router.get("/{place_id}")
async def get_place_detail_by_db_id(
    place_id: int,
    lang: Optional[str] = Query(None, description="Target language"),
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_current_user),
):
    place = db.query(Place).filter(Place.id == place_id).first()

    if not place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다.")

    phone = ""
    place_url = ""
    opening_hours = []

    if place.provider == "KAKAO":
        import httpx

        if KAKAO_REST_API_KEY:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(
                        "https://dapi.kakao.com/v2/local/search/keyword.json",
                        headers={"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"},
                        params={"query": place.name, "size": 5},
                    )
                    if response.status_code == 200:
                        data = response.json()
                        for doc in data.get("documents", []):
                            if doc.get("id") == place.place_api_id:
                                phone = doc.get("phone", "")
                                place_url = doc.get("place_url", "")
                                break
            except Exception:
                logger.exception("카카오 상세 조회 실패")

        google_results = await search_google_places(f"{place.name} {place.address}", limit=3)
        if google_results:
            google_place_id = google_results[0].get("place_api_id")
            if google_place_id:
                google_details = await get_google_place_details(google_place_id)
                if google_details:
                    opening_hours = google_details.get("opening_hours", [])

    elif place.provider == "GOOGLE":
        if place.place_api_id:
            google_details = await get_google_place_details(place.place_api_id)
            if google_details:
                phone = google_details.get("phone", "")
                opening_hours = google_details.get("opening_hours", [])
                place_url = google_details.get("website", "")

    is_bookmarked = False
    if user_id:
        bookmark = (
            db.query(PlaceBookmark)
            .filter(
                PlaceBookmark.user_id == user_id,
                PlaceBookmark.place_id == place.id,
            )
            .first()
        )
        is_bookmarked = bookmark is not None

    result_data = {
        "id": place.id,
        "provider": place.provider,
        "place_api_id": place.place_api_id,
        "name": place.name,
        "address": place.address,
        "city": place.city,
        "latitude": float(place.latitude),
        "longitude": float(place.longitude),
        "category_main": place.category_main,
        "category_detail": place.category_detail,
        "thumbnail_urls": place.thumbnail_urls,
        "average_rating": float(place.average_rating) if place.average_rating else 0.0,
        "review_count": place.review_count,
        "created_at": place.created_at,
        "updated_at": place.updated_at,
        "phone": phone,
        "place_url": place_url,
        "opening_hours": opening_hours,
        "is_bookmarked": is_bookmarked,
    }

    if lang:
        try:
            result_data = await translate_place_detail_basic(
                result_data,
                place.id,
                opening_hours,
                lang,
            )
        except Exception:
            logger.exception("상세 번역 실패")

    return result_data
