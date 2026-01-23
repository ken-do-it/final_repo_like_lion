from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


# ==================== 장소 검색 ====================

class PlaceSearchRequest(BaseModel):
    """장소 검색 요청"""
    query: str = Field(..., min_length=1, description="검색어")
    category: Optional[str] = Field(None, description="카테고리 필터")
    city: Optional[str] = Field(None, description="도시 필터")
    limit: int = Field(20, ge=1, le=100, description="결과 개수")


class PlaceSearchResult(BaseModel):
    """장소 검색 결과 (통합)"""
    id: Optional[int] = Field(None, description="DB 저장 ID (있을 경우)")
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
    place_api_id: Optional[str] = None
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
    # 동적 정보 (외부 API에서 실시간 조회)
    phone: Optional[str] = ""
    place_url: Optional[str] = ""
    opening_hours: List[str] = Field(default_factory=list)

    class Config:
        from_attributes = True


class PlaceCreateRequest(BaseModel):
    """사용자 직접 장소 등록 요청"""
    name: str = Field(..., min_length=1, max_length=200, description="장소명")
    address: str = Field(..., min_length=1, description="주소")
    latitude: float = Field(..., ge=-90, le=90, description="위도")
    longitude: float = Field(..., ge=-180, le=180, description="경도")
    category_main: Optional[str] = Field(None, max_length=50, description="주요 카테고리")
    category_detail: Optional[List[str]] = Field(default_factory=list, description="상세 카테고리")

    @field_validator('latitude', 'longitude')
    @classmethod
    def validate_korea_bounds(cls, v, info):
        """한국 범위 검증"""
        field_name = info.field_name
        if field_name == 'latitude' and not (33 <= v <= 43):
            raise ValueError('위도는 한국 범위(33~43) 내여야 합니다')
        if field_name == 'longitude' and not (124 <= v <= 132):
            raise ValueError('경도는 한국 범위(124~132) 내여야 합니다')
        return v


class SimilarPlace(BaseModel):
    """유사 장소 정보"""
    id: int
    name: str
    address: str
    city: Optional[str] = None
    provider: str


class PlaceCreateConflictResponse(BaseModel):
    """장소 등록 중복 응답"""
    detail: str
    similar_places: List[SimilarPlace]
