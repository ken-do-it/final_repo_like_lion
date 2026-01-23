from datetime import datetime

from pydantic import BaseModel


# ==================== 북마크 (장소 찜하기) ====================

class BookmarkResponse(BaseModel):
    """북마크 응답"""
    place_id: int
    created_at: datetime