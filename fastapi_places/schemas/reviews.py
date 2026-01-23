from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ReviewCreateRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    content: str = Field(..., min_length=1, max_length=1000)
    image_url: Optional[str] = None


class ReviewResponse(BaseModel):
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
