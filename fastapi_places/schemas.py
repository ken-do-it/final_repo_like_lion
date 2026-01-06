"""
Pydantic Schemas for Places API
요청/응답 데이터 검증 및 직렬화
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


# ==================== 장소 검색 ====================

class PlaceSearchRequest(BaseModel):
    """장소 검색 요청"""
    query: str = Field(..., min_length=1, description="검색어")
    category: Optional[str] = Field(None, description="카테고리 필터")
    city: Optional[str] = Field(None, description="도시 필터")
    limit: int = Field(20, ge=1, le=100, description="결과 개수")


class PlaceSearchResult(BaseModel):
    """장소 검색 결과 (통합)"""
    provider: str = Field(..., description="출처: KAKAO, GOOGLE, USER")
    place_api_id: Optional[str] = Field(None, description="외부 API ID")
    name: str
    address: str
    city: Optional[str] = None
    latitude: Decimal
    longitude: Decimal
    category_main: Optional[str] = None
    category_detail: Optional[List[str]] = None
    thumbnail_url: Optional[str] = None


class PlaceAutocompleteRequest(BaseModel):
    """자동완성 요청"""
    q: str = Field(..., min_length=2, description="검색어 (최소 2글자)")
    limit: int = Field(10, ge=1, le=50)


class PlaceAutocompleteSuggestion(BaseModel):
    """자동완성 제안"""
    name: str
    address: str
    city: Optional[str] = None


# ==================== 장소 상세 ====================

class PlaceDetailResponse(BaseModel):
    """장소 상세 정보"""
    id: int
    provider: str
    place_api_id: Optional[str] = None
    name: str
    address: str
    city: Optional[str] = None
    latitude: Decimal
    longitude: Decimal
    category_main: Optional[str] = None
    category_detail: Optional[List[str]] = None
    thumbnail_urls: List[str] = Field(default_factory=list, max_length=3)
    average_rating: Optional[Decimal] = None
    review_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==================== 리뷰 ====================

class ReviewCreateRequest(BaseModel):
    """리뷰 작성 요청"""
    rating: int = Field(..., ge=1, le=5, description="별점 (1~5)")
    content: str = Field(..., min_length=1, max_length=1000, description="리뷰 내용")
    image_url: Optional[str] = Field(None, description="이미지 URL")


class ReviewResponse(BaseModel):
    """리뷰 응답"""
    id: int
    place_id: int
    user_id: int
    user_nickname: Optional[str] = None
    rating: int
    content: str
    image_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== 북마크 (장소 찜하기) ====================

class BookmarkResponse(BaseModel):
    """북마크 응답"""
    place_id: int
    created_at: datetime


# ==================== 현지인 인증 ====================

class LocalBadgeAuthRequest(BaseModel):
    """현지인 인증 요청"""
    latitude: float = Field(..., ge=-90, le=90, description="현재 위도")
    longitude: float = Field(..., ge=-180, le=180, description="현재 경도")

    @field_validator('latitude', 'longitude')
    @classmethod
    def validate_korea_bounds(cls, v, info):
        """한국 범위 검증"""
        field_name = info.field_name
        if field_name == 'latitude' and not (33 <= v <= 43):
            raise ValueError('위도가 한국 범위를 벗어났습니다')
        if field_name == 'longitude' and not (124 <= v <= 132):
            raise ValueError('경도가 한국 범위를 벗어났습니다')
        return v


class LocalBadgeAuthResponse(BaseModel):
    """현지인 인증 응답"""
    level: int = Field(..., ge=1, le=5)
    city: str
    is_active: bool
    next_authentication_due: datetime
    message: str


class LocalBadgeStatusResponse(BaseModel):
    """현지인 뱃지 상태 조회"""
    level: int = Field(..., ge=0, le=5)
    city: Optional[str] = None
    is_active: bool
    first_authenticated_at: Optional[datetime] = None
    last_authenticated_at: Optional[datetime] = None
    next_authentication_due: Optional[datetime] = None
    maintenance_months: int = 0
    authentication_count: int = 0

    class Config:
        from_attributes = True


# ==================== 현지인 칼럼 ====================

class LocalColumnSectionImageCreate(BaseModel):
    """칼럼 섹션 이미지 생성"""
    image_url: str
    order: int = Field(default=0, ge=0)


class LocalColumnSectionCreate(BaseModel):
    """칼럼 섹션 생성"""
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)
    place_id: Optional[int] = None
    order: int = Field(default=0, ge=0)
    images: List[LocalColumnSectionImageCreate] = Field(default_factory=list)


class LocalColumnCreateRequest(BaseModel):
    """현지인 칼럼 작성 요청"""
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1, description="서론")
    thumbnail_url: str
    intro_image_url: Optional[str] = None
    representative_place_id: Optional[int] = None
    sections: List[LocalColumnSectionCreate] = Field(default_factory=list, min_length=1)


class LocalColumnSectionImageResponse(BaseModel):
    """칼럼 섹션 이미지 응답"""
    id: int
    image_url: str
    order: int

    class Config:
        from_attributes = True


class LocalColumnSectionResponse(BaseModel):
    """칼럼 섹션 응답"""
    id: int
    title: str
    content: str
    place_id: Optional[int] = None
    order: int
    images: List[LocalColumnSectionImageResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class LocalColumnResponse(BaseModel):
    """현지인 칼럼 응답"""
    id: int
    user_id: int
    user_nickname: Optional[str] = None
    title: str
    content: str
    thumbnail_url: str
    intro_image_url: Optional[str] = None
    representative_place_id: Optional[int] = None
    view_count: int = 0
    created_at: datetime
    sections: List[LocalColumnSectionResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class LocalColumnListResponse(BaseModel):
    """칼럼 목록 응답"""
    id: int
    user_id: int
    user_nickname: Optional[str] = None
    title: str
    thumbnail_url: str
    view_count: int
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== 도시별 콘텐츠 ====================

class CityContentResponse(BaseModel):
    """도시별 통합 콘텐츠 응답"""
    places: List[PlaceDetailResponse] = Field(default_factory=list)
    local_columns: List[LocalColumnListResponse] = Field(default_factory=list)
    # shortforms와 travel_plans는 다른 앱에서 가져올 예정
    shortforms: List = Field(default_factory=list)
    travel_plans: List = Field(default_factory=list)


class PopularCityResponse(BaseModel):
    """인기 도시 응답"""
    city_name: str
    country: str = "대한민국"
    description: Optional[str] = None
