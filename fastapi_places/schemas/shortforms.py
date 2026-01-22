from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ShortformListResponse(BaseModel):
    id: int
    user_id: int
    user_nickname: Optional[str] = None
    title: str
    content: Optional[str] = None
    thumbnail_url: Optional[str] = None
    video_url: str
    location: Optional[str] = None
    duration: Optional[int] = None
    source_lang: str = "ko"
    total_likes: int = 0
    total_views: int = 0
    created_at: datetime

    class Config:
        from_attributes = True
