import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from auth import require_auth
from database import get_db
from models import Place, PlaceReview, User
from schemas import ReviewResponse
from services.reviews import (
    remove_place_thumbnail,
    update_place_review_stats,
    update_place_thumbnails,
)
from services.media_helpers import delete_image_file, save_image_file
from services.translation_helpers import translate_reviews
from translation_client import detect_source_language


logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{place_id}/reviews")
async def get_place_reviews(
    place_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    order_by: str = Query("latest"),
    has_image: bool = Query(False),
    lang: Optional[str] = Query(None, description="Target language"),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit

    query = db.query(PlaceReview).filter(PlaceReview.place_id == place_id)
    if has_image:
        query = query.filter(PlaceReview.image_url.isnot(None))

    if order_by == "rating_desc":
        query = query.order_by(PlaceReview.rating.desc(), PlaceReview.created_at.desc())
    elif order_by == "rating_asc":
        query = query.order_by(PlaceReview.rating.asc(), PlaceReview.created_at.desc())
    else:
        query = query.order_by(PlaceReview.created_at.desc())

    reviews = query.offset(offset).limit(limit).all()

    review_data = []
    for review in reviews:
        user = db.query(User).filter(User.id == review.user_id).first()
        review_data.append(
            {
                "id": review.id,
                "place_id": review.place_id,
                "user_id": review.user_id,
                "user_nickname": user.nickname if user else None,
                "rating": review.rating,
                "content": review.content,
                "image_url": review.image_url,
                "created_at": review.created_at,
            }
        )

    if lang and review_data:
        try:
            review_data = await translate_reviews(review_data, lang)
        except Exception:
            logger.exception("리뷰 번역 실패")

    total_query = db.query(PlaceReview).filter(PlaceReview.place_id == place_id)
    if has_image:
        total_query = total_query.filter(PlaceReview.image_url.isnot(None))
    total = total_query.count()

    return {
        "page": page,
        "limit": limit,
        "total": total,
        "reviews": review_data,
    }


@router.post("/{place_id}/reviews", response_model=ReviewResponse)
async def create_review(
    place_id: int,
    rating: int = Form(..., ge=1, le=5),
    content: str = Form(..., min_length=1, max_length=1000),
    image: Optional[UploadFile] = File(None),
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db),
):
    place = db.query(Place).filter(Place.id == place_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다.")

    existing = (
        db.query(PlaceReview)
        .filter(
            PlaceReview.user_id == user_id,
            PlaceReview.place_id == place_id,
        )
        .first()
    )

    if existing:
        raise HTTPException(status_code=400, detail="이미 리뷰가 존재합니다.")

    image_url = None
    if image:
        image_url = await save_image_file(image, "place_images")

    detected_lang = detect_source_language(content)

    try:
        review = PlaceReview(
            place_id=place_id,
            user_id=user_id,
            rating=rating,
            content=content,
            source_lang=detected_lang,
            image_url=image_url,
        )

        db.add(review)
        db.commit()
        db.refresh(review)
    except Exception as e:
        if image_url:
            delete_image_file(image_url)
        raise HTTPException(status_code=500, detail=f"리뷰 생성 실패: {str(e)}")

    update_place_review_stats(db, place_id)

    if image_url:
        update_place_thumbnails(db, place_id, image_url)

    user = db.query(User).filter(User.id == user_id).first()

    return ReviewResponse(
        id=review.id,
        place_id=review.place_id,
        user_id=review.user_id,
        user_nickname=user.nickname if user else None,
        rating=review.rating,
        content=review.content,
        image_url=review.image_url,
        created_at=review.created_at,
    )


@router.put("/{place_id}/reviews/{review_id}", response_model=ReviewResponse)
async def update_review(
    place_id: int,
    review_id: int,
    rating: int = Form(..., ge=1, le=5),
    content: str = Form(..., min_length=1, max_length=1000),
    image: Optional[UploadFile] = File(None),
    remove_image: bool = Form(False),
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db),
):
    review = (
        db.query(PlaceReview)
        .filter(
            PlaceReview.id == review_id,
            PlaceReview.place_id == place_id,
        )
        .first()
    )

    if not review:
        raise HTTPException(status_code=404, detail="리뷰를 찾을 수 없습니다.")

    if review.user_id != user_id:
        raise HTTPException(status_code=403, detail="권한이 없습니다.")

    old_image_url = review.image_url
    new_image_url = None
    image_url = review.image_url
    should_delete_old = False

    if image:
        new_image_url = await save_image_file(image, "place_images")
        image_url = new_image_url
        should_delete_old = bool(old_image_url)
    elif remove_image:
        image_url = None
        should_delete_old = bool(old_image_url)

    detected_lang = detect_source_language(content)

    try:
        review.rating = rating
        review.content = content
        review.source_lang = detected_lang
        review.image_url = image_url
        review.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(review)
    except Exception as e:
        if new_image_url:
            delete_image_file(new_image_url)
        raise HTTPException(status_code=500, detail=f"리뷰 수정 실패: {str(e)}")

    if should_delete_old and old_image_url:
        delete_image_file(old_image_url)
        remove_place_thumbnail(db, place_id, old_image_url)

    update_place_review_stats(db, place_id)

    if image_url:
        update_place_thumbnails(db, place_id, image_url)

    user = db.query(User).filter(User.id == user_id).first()

    return ReviewResponse(
        id=review.id,
        place_id=review.place_id,
        user_id=review.user_id,
        user_nickname=user.nickname if user else None,
        rating=review.rating,
        content=review.content,
        image_url=review.image_url,
        created_at=review.created_at,
    )


@router.delete("/{place_id}/reviews/{review_id}")
def delete_review(
    place_id: int,
    review_id: int,
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db),
):
    review = (
        db.query(PlaceReview)
        .filter(
            PlaceReview.id == review_id,
            PlaceReview.place_id == place_id,
        )
        .first()
    )

    if not review:
        raise HTTPException(status_code=404, detail="리뷰를 찾을 수 없습니다.")

    if review.user_id != user_id:
        raise HTTPException(status_code=403, detail="권한이 없습니다.")

    if review.image_url:
        delete_image_file(review.image_url)
        remove_place_thumbnail(db, place_id, review.image_url)

    db.delete(review)
    db.commit()

    update_place_review_stats(db, place_id)

    return {"message": "리뷰가 삭제되었습니다."}
