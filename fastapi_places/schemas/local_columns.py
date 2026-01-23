from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


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
    place_name: Optional[str] = None
    order: int
    images: List[LocalColumnSectionImageResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class LocalColumnResponse(BaseModel):
    """현지인 칼럼 응답"""
    id: int
    user_id: int
    user_nickname: Optional[str] = None
    user_level: Optional[int] = None
    title: str
    content: str
    thumbnail_url: Optional[str] = None
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
    user_level: Optional[int] = None
    title: str
    thumbnail_url: Optional[str] = None
    view_count: int
    created_at: datetime

    class Config:
        from_attributes = True
