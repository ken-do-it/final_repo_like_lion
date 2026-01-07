"""
Places API Router
장소 검색, 리뷰, 현지인 인증, 칼럼 관련 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, Header, Query
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
    update_place_review_stats, update_place_thumbnails, get_or_create_place_by_api_id
)
from database import get_db

router = APIRouter(prefix="/api/v1/places", tags=["Places"])


# ==================== 의존성 (사용자 인증) ====================

def get_current_user(
    user_id: Optional[int] = Header(None, alias="user-id")
) -> Optional[int]:
    """
    Django에서 전달받은 user_id 헤더 추출
    """
    return user_id


def require_auth(user_id: Optional[int] = Depends(get_current_user)) -> int:
    """
    인증 필수 엔드포인트용
    """
    if not user_id:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    return user_id


# ==================== 장소 검색 ====================

@router.get("/search")
async def search_places(
    query: str = Query(..., min_length=1, description="검색어"),
    category: Optional[str] = Query(None, description="카테고리 필터"),
    city: Optional[str] = Query(None, description="도시 필터"),
    limit: int = Query(20, ge=1, le=100, description="결과 개수")
):
    """
    장소 검색 (카카오맵 + 구글맵 통합)
    """
    results = await search_places_hybrid(query, category, city, limit)

    return {
        "query": query,
        "count": len(results),
        "results": results
    }


@router.get("/autocomplete")
async def autocomplete_places(
    q: str = Query(..., min_length=2, description="검색어 (최소 2글자)"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    장소 자동완성
    """
    # DB에서 이름으로 검색
    places = db.query(Place).filter(
        Place.name.ilike(f"%{q}%")
    ).limit(limit).all()

    suggestions = [
        PlaceAutocompleteSuggestion(
            name=p.name,
            address=p.address,
            city=p.city
        )
        for p in places
    ]

    return {"suggestions": suggestions}


# ==================== 장소 상세 ====================

@router.get("/detail", response_model=PlaceDetailResponse)
async def get_place_detail_by_api_id(
    place_api_id: str = Query(..., description="외부 API의 장소 ID"),
    provider: str = Query("KAKAO", description="제공자 (KAKAO, GOOGLE)"),
    name: str = Query(..., description="장소명 (검색용)"),
    db: Session = Depends(get_db)
):
    """
    장소 상세 정보 조회 (외부 API ID 기반)
    DB에 없으면 외부 API에서 가져와서 저장 (온디맨드 방식)
    """
    place = await get_or_create_place_by_api_id(
        db=db,
        place_api_id=place_api_id,
        provider=provider,
        name_hint=name
    )

    if not place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")

    return place


@router.get("/{place_id}", response_model=PlaceDetailResponse)
def get_place_detail_by_db_id(
    place_id: int,
    db: Session = Depends(get_db)
):
    """
    장소 상세 정보 조회 (DB ID 기반)
    """
    place = db.query(Place).filter(Place.id == place_id).first()

    if not place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")

    return place


# ==================== 리뷰 ====================

@router.get("/{place_id}/reviews")
def get_place_reviews(
    place_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    장소 리뷰 목록 조회
    """
    offset = (page - 1) * limit

    reviews = db.query(PlaceReview).filter(
        PlaceReview.place_id == place_id
    ).order_by(
        PlaceReview.created_at.desc()
    ).offset(offset).limit(limit).all()

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

    total = db.query(PlaceReview).filter(PlaceReview.place_id == place_id).count()

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
