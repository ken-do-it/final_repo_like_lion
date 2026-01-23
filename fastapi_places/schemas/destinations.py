from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from schemas.local_columns import LocalColumnListResponse
from schemas.places import PlaceDetailResponse
from schemas.shortforms import ShortformListResponse


# ==================== 도시별 콘텐츠 ====================

class TravelPlanListResponse(BaseModel):
    """여행 일정 목록 응답"""
    id: int
    user_id: int
    user_nickname: Optional[str] = None
    title: str
    description: Optional[str] = None
    start_date: date
    end_date: date
    is_public: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class CityContentResponse(BaseModel):
    """도시별 통합 콘텐츠 응답"""
    places: List[PlaceDetailResponse] = Field(default_factory=list)
    local_columns: List[LocalColumnListResponse] = Field(default_factory=list)
    shortforms: List[ShortformListResponse] = Field(default_factory=list)
    travel_plans: List[TravelPlanListResponse] = Field(default_factory=list)
    display_name: Optional[str] = None


class PopularCityResponse(BaseModel):
    """인기 도시 응답"""
    city_name: str
    display_name: Optional[str] = None
    country: str = "대한민국"
    description: Optional[str] = None
