from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import require_auth
from database import get_db
from models import Place, PlaceBookmark
from schemas import BookmarkResponse


router = APIRouter()


@router.post("/{place_id}/bookmark", response_model=BookmarkResponse)
def add_bookmark(
    place_id: int,
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db),
):
    place = db.query(Place).filter(Place.id == place_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다.")

    existing = (
        db.query(PlaceBookmark)
        .filter(
            PlaceBookmark.user_id == user_id,
            PlaceBookmark.place_id == place_id,
        )
        .first()
    )

    if existing:
        return BookmarkResponse(
            place_id=existing.place_id,
            created_at=existing.created_at,
        )

    bookmark = PlaceBookmark(
        user_id=user_id,
        place_id=place_id,
    )

    db.add(bookmark)
    db.commit()
    db.refresh(bookmark)

    return BookmarkResponse(
        place_id=bookmark.place_id,
        created_at=bookmark.created_at,
    )


@router.delete("/{place_id}/bookmark")
def remove_bookmark(
    place_id: int,
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db),
):
    bookmark = (
        db.query(PlaceBookmark)
        .filter(
            PlaceBookmark.user_id == user_id,
            PlaceBookmark.place_id == place_id,
        )
        .first()
    )

    if not bookmark:
        raise HTTPException(status_code=404, detail="북마크를 찾을 수 없습니다.")

    db.delete(bookmark)
    db.commit()

    return {"message": "Bookmark deleted"}
