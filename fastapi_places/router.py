"""
Places API Router
장소 검색, 리뷰, 현지인 인증, 칼럼 관련 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date

from models import (
    Place, PlaceReview, PlaceBookmark, LocalBadge,
    LocalColumn, LocalColumnSection, LocalColumnSectionImage, User
)
from schemas import (
    PlaceSearchRequest, PlaceSearchResult, PlaceAutocompleteRequest,
    PlaceAutocompleteSuggestion, PlaceDetailResponse, ReviewCreateRequest,
    ReviewResponse, BookmarkResponse, LocalBadgeAuthRequest, LocalBadgeAuthResponse,
    LocalBadgeStatusResponse, LocalColumnCreateRequest, LocalColumnResponse,
    LocalColumnListResponse, CityContentResponse, PopularCityResponse
)
from service import (
    search_places_hybrid, authenticate_local_badge, check_local_badge_active,
    update_place_review_stats, update_place_thumbnails, get_or_create_place_by_api_id,
    search_kakao_places, search_google_places, get_google_place_details
)
from database import get_db
from auth import get_current_user, require_auth

router = APIRouter(prefix="/api/v1/places", tags=["Places"])


# ==================== 장소 검색 ====================

@router.get("/search")
async def search_places(
    query: str = Query(..., min_length=1, description="검색어"),
    category: Optional[str] = Query(None, description="카테고리 필터"),
    city: Optional[str] = Query(None, description="도시 필터"),
    page: int = Query(1, ge=1, description="페이지 번호")
):
    """
    장소 검색 (카카오맵 + 구글맵 통합)

    페이지네이션:
    - page: 페이지 번호 (1부터 시작)
    - 페이지당 15개 고정

    참고: API 특성상 총 결과 수는 제한적일 수 있음 (카카오+구글 합쳐서 최대 ~45개)
    """
    limit = 15  # 페이지당 개수 고정

    # API에서 더 많은 결과를 가져옴 (페이지네이션 대비)
    fetch_limit = page * limit + 10  # 여유분 포함

    all_results = await search_places_hybrid(query, category, city, fetch_limit)

    # 페이지네이션 적용
    offset = (page - 1) * limit
    paginated_results = all_results[offset:offset + limit]

    return {
        "query": query,
        "page": page,
        "limit": limit,
        "total": len(all_results),  # 필터링 후 전체 개수
        "count": len(paginated_results),  # 현재 페이지 개수
        "results": paginated_results
    }


@router.get("/autocomplete")
async def autocomplete_places(
    q: str = Query(..., min_length=2, description="검색어 (최소 2글자)"),
    limit: int = Query(10, ge=1, le=50)
):
    """
    장소 자동완성 (카카오 API 실시간 조회)
    타이핑하는 동안 실시간으로 장소명 추천
    """
    # 카카오 API로 실시간 검색
    kakao_results = await search_kakao_places(q, limit=limit)

    suggestions = [
        PlaceAutocompleteSuggestion(
            name=result["name"],
            address=result["address"],
            city=result["city"]
        )
        for result in kakao_results
    ]

    return {"suggestions": suggestions}


# ==================== 장소 상세 ====================

@router.get("/detail")
async def get_place_detail_by_api_id(
    place_api_id: str = Query(..., description="외부 API의 장소 ID"),
    provider: str = Query("KAKAO", description="제공자 (KAKAO, GOOGLE)"),
    name: str = Query(..., description="장소명 (검색용)"),
    db: Session = Depends(get_db)
):
    """
    장소 상세 정보 조회 (외부 API ID 기반)
    DB에 없으면 외부 API에서 가져와서 저장 (온디맨드 방식)

    반환:
    - DB 저장 정보: name, address, latitude, longitude, category 등
    - 동적 정보 (실시간 API 호출): phone, place_url, opening_hours
    """
    # 1. DB 조회 또는 생성 (기본 정보)
    place = await get_or_create_place_by_api_id(
        db=db,
        place_api_id=place_api_id,
        provider=provider,
        name_hint=name
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
        import os
        kakao_api_key = os.getenv("YJ_KAKAO_REST_API_KEY", "")
        if kakao_api_key:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(
                        "https://dapi.kakao.com/v2/local/search/keyword.json",
                        headers={"Authorization": f"KakaoAK {kakao_api_key}"},
                        params={"query": name, "size": 5}
                    )
                    if response.status_code == 200:
                        data = response.json()
                        for doc in data.get("documents", []):
                            if doc.get("id") == place_api_id:
                                phone = doc.get("phone", "")
                                place_url = doc.get("place_url", "")
                                break
            except Exception as e:
                print(f"카카오 상세 정보 조회 실패: {e}")

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

    # 3. DB 데이터 + 동적 정보 합치기
    return {
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
        "opening_hours": opening_hours
    }


@router.get("/{place_id}")
async def get_place_detail_by_db_id(
    place_id: int,
    db: Session = Depends(get_db)
):
    """
    장소 상세 정보 조회 (DB ID 기반)

    반환:
    - DB 저장 정보: name, address, latitude, longitude, category 등
    - 동적 정보 (실시간 API 호출): phone, place_url, opening_hours
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
        import os
        kakao_api_key = os.getenv("YJ_KAKAO_REST_API_KEY", "")
        if kakao_api_key and place.name:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(
                        "https://dapi.kakao.com/v2/local/search/keyword.json",
                        headers={"Authorization": f"KakaoAK {kakao_api_key}"},
                        params={"query": place.name, "size": 5}
                    )
                    if response.status_code == 200:
                        data = response.json()
                        for doc in data.get("documents", []):
                            if doc.get("id") == place.place_api_id:
                                phone = doc.get("phone", "")
                                place_url = doc.get("place_url", "")
                                break
            except Exception as e:
                print(f"카카오 상세 정보 조회 실패: {e}")

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

    # 3. DB 데이터 + 동적 정보 합치기
    return {
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
        "opening_hours": opening_hours
    }


# ==================== 리뷰 ====================

@router.get("/{place_id}/reviews")
def get_place_reviews(
    place_id: int,
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(20, ge=1, le=100, description="페이지당 개수"),
    order_by: str = Query("latest", description="정렬: latest(최신순), rating_desc(별점높은순), rating_asc(별점낮은순)"),
    has_image: bool = Query(False, description="이미지 첨부 리뷰만 보기"),
    db: Session = Depends(get_db)
):
    """
    장소 리뷰 목록 조회 (필터링 및 정렬 가능)

    - order_by: latest(최신순, 기본값) / rating_desc(별점높은순) / rating_asc(별점낮은순)
    - has_image: True(이미지 있는 리뷰만) / False(전체 리뷰, 기본값)
    """
    offset = (page - 1) * limit

    # 기본 쿼리
    query = db.query(PlaceReview).filter(PlaceReview.place_id == place_id)

    # 이미지 필터
    if has_image:
        query = query.filter(PlaceReview.image_url.isnot(None))

    # 정렬
    if order_by == "rating_desc":
        query = query.order_by(PlaceReview.rating.desc(), PlaceReview.created_at.desc())
    elif order_by == "rating_asc":
        query = query.order_by(PlaceReview.rating.asc(), PlaceReview.created_at.desc())
    else:  # latest (기본값)
        query = query.order_by(PlaceReview.created_at.desc())

    # 페이지네이션
    reviews = query.offset(offset).limit(limit).all()

    # 사용자 닉네임 조회
    review_data = []
    for review in reviews:
        user = db.query(User).filter(User.id == review.user_id).first()
        review_data.append(ReviewResponse(
            id=review.id,
            place_id=review.place_id,
            user_id=review.user_id,
            user_nickname=user.nickname if user else None,
            rating=review.rating,
            content=review.content,
            image_url=review.image_url,
            created_at=review.created_at
        ))

    # total도 같은 필터 적용
    total_query = db.query(PlaceReview).filter(PlaceReview.place_id == place_id)
    if has_image:
        total_query = total_query.filter(PlaceReview.image_url.isnot(None))
    total = total_query.count()

    return {
        "page": page,
        "limit": limit,
        "total": total,
        "reviews": review_data
    }


@router.post("/{place_id}/reviews", response_model=ReviewResponse)
def create_review(
    place_id: int,
    review_data: ReviewCreateRequest,
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    리뷰 작성
    """
    # 장소 존재 확인
    place = db.query(Place).filter(Place.id == place_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")

    # 중복 리뷰 확인
    existing = db.query(PlaceReview).filter(
        PlaceReview.user_id == user_id,
        PlaceReview.place_id == place_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="이미 리뷰를 작성했습니다")

    # 리뷰 생성
    review = PlaceReview(
        place_id=place_id,
        user_id=user_id,
        rating=review_data.rating,
        content=review_data.content,
        image_url=review_data.image_url
    )

    db.add(review)
    db.commit()
    db.refresh(review)

    # 통계 업데이트
    update_place_review_stats(db, place_id)

    # 썸네일 업데이트 (이미지가 있으면)
    if review_data.image_url:
        update_place_thumbnails(db, place_id, review_data.image_url)

    # 사용자 정보 조회
    user = db.query(User).filter(User.id == user_id).first()

    return ReviewResponse(
        id=review.id,
        place_id=review.place_id,
        user_id=review.user_id,
        user_nickname=user.nickname if user else None,
        rating=review.rating,
        content=review.content,
        image_url=review.image_url,
        created_at=review.created_at
    )


# ==================== 북마크 (찜하기) ====================

@router.post("/{place_id}/bookmark", response_model=BookmarkResponse)
def add_bookmark(
    place_id: int,
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    장소 찜하기
    """
    # 장소 존재 확인
    place = db.query(Place).filter(Place.id == place_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")

    # 중복 확인
    existing = db.query(PlaceBookmark).filter(
        PlaceBookmark.user_id == user_id,
        PlaceBookmark.place_id == place_id
    ).first()

    if existing:
        return BookmarkResponse(
            place_id=existing.place_id,
            created_at=existing.created_at
        )

    # 북마크 생성
    bookmark = PlaceBookmark(
        user_id=user_id,
        place_id=place_id
    )

    db.add(bookmark)
    db.commit()
    db.refresh(bookmark)

    return BookmarkResponse(
        place_id=bookmark.place_id,
        created_at=bookmark.created_at
    )


@router.delete("/{place_id}/bookmark")
def remove_bookmark(
    place_id: int,
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    장소 찜하기 취소
    """
    bookmark = db.query(PlaceBookmark).filter(
        PlaceBookmark.user_id == user_id,
        PlaceBookmark.place_id == place_id
    ).first()

    if not bookmark:
        raise HTTPException(status_code=404, detail="북마크를 찾을 수 없습니다")

    db.delete(bookmark)
    db.commit()

    return {"message": "북마크가 삭제되었습니다"}


# ==================== 현지인 인증 ====================

@router.post("/local-badge/authenticate", response_model=LocalBadgeAuthResponse)
async def authenticate_badge(
    auth_data: LocalBadgeAuthRequest,
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    현지인 인증 (위치 기반)
    """
    badge, message = await authenticate_local_badge(
        db, user_id, auth_data.latitude, auth_data.longitude
    )

    return LocalBadgeAuthResponse(
        level=badge.level,
        city=badge.city,
        is_active=badge.is_active,
        next_authentication_due=badge.next_authentication_due,
        message=message
    )


@router.get("/local-badge/status", response_model=LocalBadgeStatusResponse)
def get_badge_status(
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    현지인 뱃지 상태 조회
    """
    badge = db.query(LocalBadge).filter(LocalBadge.user_id == user_id).first()

    if not badge:
        return LocalBadgeStatusResponse(
            level=0,
            city=None,
            is_active=False,
            first_authenticated_at=None,
            last_authenticated_at=None,
            next_authentication_due=None,
            maintenance_months=0,
            authentication_count=0
        )

    return LocalBadgeStatusResponse(
        level=badge.level,
        city=badge.city,
        is_active=badge.is_active,
        first_authenticated_at=badge.first_authenticated_at,
        last_authenticated_at=badge.last_authenticated_at,
        next_authentication_due=badge.next_authentication_due,
        maintenance_months=badge.maintenance_months,
        authentication_count=0  # 추후 구현
    )


# ==================== 현지인 칼럼 ====================

@router.get("/local-columns", response_model=List[LocalColumnListResponse])
def get_local_columns(
    city: Optional[str] = Query(None, description="도시 필터"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    현지인 칼럼 목록 조회
    """
    offset = (page - 1) * limit

    query = db.query(LocalColumn)

    # 도시 필터링 (representative_place를 통해)
    if city:
        query = query.join(Place, LocalColumn.representative_place_id == Place.id, isouter=True).filter(
            Place.city == city
        )

    columns = query.order_by(LocalColumn.created_at.desc()).offset(offset).limit(limit).all()

    # 사용자 닉네임 조회
    result = []
    for column in columns:
        user = db.query(User).filter(User.id == column.user_id).first()
        result.append(LocalColumnListResponse(
            id=column.id,
            user_id=column.user_id,
            user_nickname=user.nickname if user else None,
            title=column.title,
            thumbnail_url=column.thumbnail_url,
            view_count=column.view_count,
            created_at=column.created_at
        ))

    return result


@router.get("/local-columns/{column_id}", response_model=LocalColumnResponse)
def get_local_column_detail(
    column_id: int,
    db: Session = Depends(get_db)
):
    """
    현지인 칼럼 상세 조회 (조회수 증가)
    """
    column = db.query(LocalColumn).filter(LocalColumn.id == column_id).first()

    if not column:
        raise HTTPException(status_code=404, detail="칼럼을 찾을 수 없습니다")

    # 조회수 증가
    column.view_count += 1
    db.commit()

    # 섹션 및 이미지 조회
    sections = db.query(LocalColumnSection).filter(
        LocalColumnSection.column_id == column_id
    ).order_by(LocalColumnSection.order).all()

    section_data = []
    for section in sections:
        images = db.query(LocalColumnSectionImage).filter(
            LocalColumnSectionImage.section_id == section.id
        ).order_by(LocalColumnSectionImage.order).all()

        from .schemas import LocalColumnSectionImageResponse, LocalColumnSectionResponse
        section_data.append(LocalColumnSectionResponse(
            id=section.id,
            title=section.title,
            content=section.content,
            place_id=section.place_id,
            order=section.order,
            images=[
                LocalColumnSectionImageResponse(
                    id=img.id,
                    image_url=img.image_url,
                    order=img.order
                )
                for img in images
            ]
        ))

    # 사용자 정보
    user = db.query(User).filter(User.id == column.user_id).first()

    return LocalColumnResponse(
        id=column.id,
        user_id=column.user_id,
        user_nickname=user.nickname if user else None,
        title=column.title,
        content=column.content,
        thumbnail_url=column.thumbnail_url,
        intro_image_url=column.intro_image_url,
        representative_place_id=column.representative_place_id,
        view_count=column.view_count,
        created_at=column.created_at,
        sections=section_data
    )


@router.post("/local-columns", response_model=LocalColumnResponse)
def create_local_column(
    column_data: LocalColumnCreateRequest,
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    현지인 칼럼 작성 (현지인 인증 필요)
    """
    # 현지인 뱃지 확인
    check_local_badge_active(db, user_id)

    # 칼럼 생성
    column = LocalColumn(
        user_id=user_id,
        title=column_data.title,
        content=column_data.content,
        thumbnail_url=column_data.thumbnail_url,
        intro_image_url=column_data.intro_image_url,
        representative_place_id=column_data.representative_place_id
    )

    db.add(column)
    db.commit()
    db.refresh(column)

    # 섹션 생성
    section_data = []
    for idx, section_req in enumerate(column_data.sections):
        section = LocalColumnSection(
            column_id=column.id,
            place_id=section_req.place_id,
            order=section_req.order if section_req.order else idx,
            title=section_req.title,
            content=section_req.content
        )

        db.add(section)
        db.commit()
        db.refresh(section)

        # 섹션 이미지 생성
        images = []
        for img_idx, img_req in enumerate(section_req.images):
            image = LocalColumnSectionImage(
                section_id=section.id,
                image_url=img_req.image_url,
                order=img_req.order if img_req.order else img_idx
            )
            db.add(image)
            images.append(image)

        db.commit()

        from .schemas import LocalColumnSectionImageResponse, LocalColumnSectionResponse
        section_data.append(LocalColumnSectionResponse(
            id=section.id,
            title=section.title,
            content=section.content,
            place_id=section.place_id,
            order=section.order,
            images=[
                LocalColumnSectionImageResponse(
                    id=img.id,
                    image_url=img.image_url,
                    order=img.order
                )
                for img in images
            ]
        ))

    # 사용자 정보
    user = db.query(User).filter(User.id == user_id).first()

    return LocalColumnResponse(
        id=column.id,
        user_id=column.user_id,
        user_nickname=user.nickname if user else None,
        title=column.title,
        content=column.content,
        thumbnail_url=column.thumbnail_url,
        intro_image_url=column.intro_image_url,
        representative_place_id=column.representative_place_id,
        view_count=column.view_count,
        created_at=column.created_at,
        sections=section_data
    )


# ==================== 도시별 콘텐츠 ====================

@router.get("/destinations/{city_name}", response_model=CityContentResponse)
def get_city_content(
    city_name: str,
    db: Session = Depends(get_db)
):
    """
    도시별 통합 콘텐츠 조회
    """
    # 장소 10개
    places = db.query(Place).filter(Place.city == city_name).limit(10).all()

    # 현지인 칼럼 10개
    columns = db.query(LocalColumn).join(
        Place, LocalColumn.representative_place_id == Place.id, isouter=True
    ).filter(Place.city == city_name).limit(10).all()

    # 칼럼 데이터 변환
    column_data = []
    for column in columns:
        user = db.query(User).filter(User.id == column.user_id).first()
        column_data.append(LocalColumnListResponse(
            id=column.id,
            user_id=column.user_id,
            user_nickname=user.nickname if user else None,
            title=column.title,
            thumbnail_url=column.thumbnail_url,
            view_count=column.view_count,
            created_at=column.created_at
        ))

    return CityContentResponse(
        places=[PlaceDetailResponse.from_orm(p) for p in places],
        local_columns=column_data,
        shortforms=[],  # 다른 앱 연동 필요
        travel_plans=[]  # 다른 앱 연동 필요
    )


@router.get("/destinations/popular", response_model=List[PopularCityResponse])
def get_popular_cities():
    """
    인기 도시 목록
    """
    popular_cities = [
        {"city_name": "서울", "description": "대한민국의 수도, 현대와 전통이 공존하는 도시"},
        {"city_name": "부산", "description": "해운대와 광안리로 유명한 항구 도시"},
        {"city_name": "제주", "description": "아름다운 자연과 독특한 문화를 가진 섬"},
        {"city_name": "대전", "description": "과학과 교육의 도시"},
        {"city_name": "대구", "description": "섬유와 패션의 도시"},
        {"city_name": "인천", "description": "국제공항과 차이나타운이 있는 관문 도시"},
        {"city_name": "광주", "description": "예술과 문화의 도시"},
        {"city_name": "수원", "description": "화성과 전통시장으로 유명한 역사 도시"},
        {"city_name": "전주", "description": "한옥마을과 비빔밥의 고장"},
        {"city_name": "경주", "description": "신라 천년의 역사가 살아있는 도시"}
    ]

    return [PopularCityResponse(**city) for city in popular_cities]
