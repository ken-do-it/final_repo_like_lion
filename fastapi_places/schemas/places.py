from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class PlaceSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    category: Optional[str] = None
    city: Optional[str] = None
    limit: int = Field(20, ge=1, le=100)


class PlaceSearchResult(BaseModel):
    id: Optional[int] = None
    provider: str
    place_api_id: Optional[str] = None
    name: str
    address: str
    city: Optional[str] = None
    latitude: Decimal
    longitude: Decimal
    category_main: Optional[str] = None
    category_detail: Optional[List[str]] = None
    thumbnail_url: Optional[str] = None


class PlaceAutocompleteRequest(BaseModel):
    q: str = Field(..., min_length=2)
    limit: int = Field(10, ge=1, le=50)


class PlaceAutocompleteSuggestion(BaseModel):
    place_api_id: Optional[str] = None
    name: str
    address: str
    city: Optional[str] = None


class PlaceDetailResponse(BaseModel):
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
    phone: Optional[str] = ""
    place_url: Optional[str] = ""
    opening_hours: List[str] = Field(default_factory=list)

    class Config:
        from_attributes = True


class PlaceCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    address: str = Field(..., min_length=1)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    category_main: Optional[str] = Field(None, max_length=50)
    category_detail: Optional[List[str]] = Field(default_factory=list)

    @field_validator("latitude", "longitude")
    @classmethod
    def validate_korea_bounds(cls, v, info):
        field_name = info.field_name
        if field_name == "latitude" and not (33 <= v <= 43):
            raise ValueError("위도는 대한민국 범위(33~43) 내여야 합니다.")
        if field_name == "longitude" and not (124 <= v <= 132):
            raise ValueError("경도는 대한민국 범위(124~132) 내여야 합니다.")
        return v


class SimilarPlace(BaseModel):
    id: int
    name: str
    address: str
    city: Optional[str] = None
    provider: str


class PlaceCreateConflictResponse(BaseModel):
    detail: str
    similar_places: List[SimilarPlace]
