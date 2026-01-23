from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


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
