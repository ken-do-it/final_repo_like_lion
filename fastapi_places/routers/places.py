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


# ==================== 장소 상세 ====================

@router.get("/detail")
async def get_place_detail_by_api_id(
    place_api_id: str = Query(..., description="외부 API의 장소 ID"),
    provider: str = Query("KAKAO", description="제공자 (KAKAO, GOOGLE)"),
    name: str = Query(..., description="장소명 (검색용)"),
    lang: Optional[str] = Query(None, description="타겟 언어"),
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_current_user),
):
    """
    장소 상세 정보 조회 (외부 API ID 기반)
    DB에 없으면 외부 API에서 가져와서 저장 (온디맨드 방식)

    반환:
    - DB 저장 정보: name, address, latitude, longitude, category 등
    - 동적 정보 (실시간 API 호출): phone, place_url, opening_hours
    - is_bookmarked: 로그인 사용자의 찜 여부
    """
    # 1. DB 조회 또는 생성 (기본 정보)
    place = await get_or_create_place_by_api_id(
        db=db,
        place_api_id=place_api_id,
        provider=provider,
        name_hint=name,
    )

    if not place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")


    # 2. 동적 정보 API 호출
    phone = ""
    place_url = ""
    opening_hours = []

    if provider == "KAKAO":
        # 카카오: 검색 API 직접 호출해서 phone, place_url 가져오기
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

        # 구글에서 영업시간 가져오기 (장소명 + 주소로 검색)
        google_results = await search_google_places(f"{place.name} {place.address}", limit=3)
        if google_results:
            # 첫 번째 결과의 place_id로 상세 정보 조회
            google_place_id = google_results[0].get("place_api_id")
            if google_place_id:
                google_details = await get_google_place_details(google_place_id)
                if google_details:
                    opening_hours = google_details.get("opening_hours", [])

    elif provider == "GOOGLE":
        # 구글: Details API에서 전부 가져오기
        google_details = await get_google_place_details(place_api_id)
        if google_details:
            phone = google_details.get("phone", "")
            opening_hours = google_details.get("opening_hours", [])
            place_url = google_details.get("website", "")

    # 3. 북마크 여부 확인
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

    # 4. DB 데이터 + 동적 정보 합치기
    result_data = {
        # DB 정보
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
        # 동적 정보 (DB 저장 안함)
        "phone": phone,
        "place_url": place_url,
        "opening_hours": opening_hours,
        # 사용자별 정보
        "is_bookmarked": is_bookmarked,
    }

    # [AI 번역 적용]
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


# ==================== 장소 등록 (사용자) ====================

@router.post("/create", response_model=PlaceDetailResponse)
async def create_user_place(
    place_data: PlaceCreateRequest,
    force: bool = Query(False, description="중복 체크 무시하고 강제 등록"),

    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """
    사용자가 직접 장소 등록

    전제 조건: API(카카오/구글)에서 검색되지 않는 장소여야 함
    주소: 도로명 주소로 등록 권장 (자동 변환)
    - provider: USER
    - place_api_id: null
    - created_by_id: 등록한 사용자 ID

    force=true: 중복 체크 없이 강제 등록
    """
    # 1. 주소 검증 및 정규화 (카카오 주소 검색 API)
    geocode_result = await geocode_address(place_data.address)
    if not geocode_result:
        raise HTTPException(
            status_code=400,
            detail="유효하지 않은 주소입니다. 정확한 주소를 입력해주세요.",

        )

    # 도로명 주소와 정확한 좌표 사용
    verified_address = geocode_result["road_address"]
    verified_lat = geocode_result["latitude"]
    verified_lng = geocode_result["longitude"]

    # 2. 좌표 비교 (프론트가 보낸 좌표 vs API 좌표)
    lat_diff = abs(verified_lat - place_data.latitude)
    lng_diff = abs(verified_lng - place_data.longitude)

    # 허용 오차: 0.001도 (약 100m)
    if lat_diff > 0.001 or lng_diff > 0.001:
        raise HTTPException(
            status_code=400,
            detail="주소와 좌표가 일치하지 않습니다.",
        )

    # 도시명 추출
    city = await reverse_geocode(verified_lat, verified_lng)

    # 3. force=false일 때만 중복 체크
    if not force:
        # 3-1. 카카오 장소 API 확인 (최우선)
        kakao_results = await search_kakao_places(place_data.name, verified_address)
        if kakao_results:
            raise HTTPException(
                status_code=400,
                detail="카카오맵에 이미 있는 장소입니다. 검색 후 이용해주세요.",

            )

        # 3-2. 구글 장소 API 확인
        google_results = await search_google_places(f"{place_data.name} {verified_address}")
        if google_results:
            raise HTTPException(
                status_code=400,
                detail="구글맵에 이미 있는 장소입니다. 검색 후 이용해주세요.",

            )

        # 3-3. DB에서 비슷한 장소 확인 (같은 도시 내 유사한 이름)
        if city:
            # 이름에서 주요 키워드 추출 (공백 기준 첫 단어)
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
                # 409 Conflict 응답
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
                        "message": "비슷한 장소가 이미 있습니다. 그래도 등록하시겠어요?",

                        "similar_places": similar_list,
                    },
                )

    # 4. 장소 생성 (검증된 도로명 주소와 좌표로 저장)
    new_place = Place(
        provider="USER",
        place_api_id=None,
        name=place_data.name,
        address=verified_address, # 도로명 주소
        city=city,
        latitude=verified_lat, # 검증된 좌표
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


# ==================== 장소 상세 (DB ID 기반) ====================
# 주의: /{place_id} 패턴은 다른 모든 라우트보다 뒤에 위치해야 함
# 그렇지 않으면 /local-columns, /local-badge 등이 place_id로 해석됨
@router.get("/{place_id}")
async def get_place_detail_by_db_id(
    place_id: int,
    lang: Optional[str] = Query(None, description="타겟 언어"),
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_current_user),
):
    """
    장소 상세 정보 조회 (DB ID 기반)

    반환:
    - DB 저장 정보: name, address, latitude, longitude, category 등
    - 동적 정보 (실시간 API 호출): phone, place_url, opening_hours
    - is_bookmarked: 로그인 사용자의 찜 여부
    """
    # 1. DB에서 장소 조회
    place = db.query(Place).filter(Place.id == place_id).first()

    if not place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")


    # 2. 동적 정보 API 호출
    phone = ""
    place_url = ""
    opening_hours = []

    if place.provider == "KAKAO":
        # 카카오: 검색 API 직접 호출해서 phone, place_url 가져오기
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

        # 구글에서 영업시간 가져오기 (장소명 + 주소로 검색)
        google_results = await search_google_places(f"{place.name} {place.address}", limit=3)
        if google_results:
            # 첫 번째 결과의 place_id로 상세 정보 조회
            google_place_id = google_results[0].get("place_api_id")
            if google_place_id:
                google_details = await get_google_place_details(google_place_id)
                if google_details:
                    opening_hours = google_details.get("opening_hours", [])

    elif place.provider == "GOOGLE":
        # 구글: Details API에서 전부 가져오기
        if place.place_api_id:
            google_details = await get_google_place_details(place.place_api_id)
            if google_details:
                phone = google_details.get("phone", "")
                opening_hours = google_details.get("opening_hours", [])
                place_url = google_details.get("website", "")

    # 3. 북마크 여부 확인
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

    # 4. DB 데이터 + 동적 정보 합치기
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
        # 동적 정보 (DB 저장 안함)
        "phone": phone,
        "place_url": place_url,
        "opening_hours": opening_hours,
        # 사용자별 정보
        "is_bookmarked": is_bookmarked,
    }

    # [AI 번역 적용]
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
