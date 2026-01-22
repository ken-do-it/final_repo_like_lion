from datetime import datetime

from pydantic import BaseModel


class BookmarkResponse(BaseModel):
    place_id: int
    created_at: datetime
