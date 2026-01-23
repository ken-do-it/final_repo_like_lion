from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class LocalBadgeAuthRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)

    @field_validator("latitude", "longitude")
    @classmethod
    def validate_korea_bounds(cls, v, info):
        field_name = info.field_name
        if field_name == "latitude" and not (33 <= v <= 43):
            raise ValueError("위도는 대한민국 범위(33~43) 내여야 합니다.")
        if field_name == "longitude" and not (124 <= v <= 132):
            raise ValueError("경도는 대한민국 범위(124~132) 내여야 합니다.")
        return v


class LocalBadgeAuthResponse(BaseModel):
    level: int = Field(..., ge=1, le=5)
    city: str
    is_active: bool
    next_authentication_due: datetime
    message: str


class LocalBadgeStatusResponse(BaseModel):
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
