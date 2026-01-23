from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


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
