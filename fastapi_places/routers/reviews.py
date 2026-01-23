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


# ==================== 리뷰 ====================

@router.get("/{place_id}/reviews")
async def get_place_reviews(
    place_id: int,
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(20, ge=1, le=100, description="페이지당 개수"),
    order_by: str = Query("latest", description="정렬: latest(최신순), rating_desc(별점높은순), rating_asc(별점낮은순)"),
    has_image: bool = Query(False, description="이미지 첨부 리뷰만 보기"),
    lang: Optional[str] = Query(None, description="Target language"),
    db: Session = Depends(get_db),
):
    """
    장소 리뷰 목록 조회 (필터링 및 정렬 가능)

    - order_by: latest(최신순, 기본값) / rating_desc(별점높은순) / rating_asc(별점낮은순)
    - has_image: True(이미지 있는 리뷰만) / False(전체 리뷰, 기본값)
    """
    offset = (page - 1) * limit

    # 기본 쿼리
    query = db.query(PlaceReview).filter(PlaceReview.place_id == place_id)
    
    # 이미지 필터
    if has_image:
        query = query.filter(PlaceReview.image_url.isnot(None))

    # 정렬
    if order_by == "rating_desc":
        query = query.order_by(PlaceReview.rating.desc(), PlaceReview.created_at.desc())
    elif order_by == "rating_asc":
        query = query.order_by(PlaceReview.rating.asc(), PlaceReview.created_at.desc())
    else: # latest (기본값)
        query = query.order_by(PlaceReview.created_at.desc())

    # 페이지네이션
    reviews = query.offset(offset).limit(limit).all()

    # 사용자 닉네임 조회
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

    # total도 같은 필터 적용
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
    rating: int = Form(..., ge=1, le=5, description="별점 (1~5)"),
    content: str = Form(..., min_length=1, max_length=1000, description="리뷰 내용"),
    image: Optional[UploadFile] = File(None, description="이미지 파일 (선택)"),
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """
    리뷰 작성 (이미지 파일 업로드 포함)
    """
    # 장소 존재 확인
    place = db.query(Place).filter(Place.id == place_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")


    # 중복 리뷰 확인
    existing = (
        db.query(PlaceReview)
        .filter(
            PlaceReview.user_id == user_id,
            PlaceReview.place_id == place_id,
        )
        .first()
    )

    if existing:
        raise HTTPException(status_code=400, detail="이미 리뷰를 작성했습니다")


    # 이미지 저장 (있으면)
    image_url = None
    if image:
        image_url = await save_image_file(image, "place_images")

    detected_lang = detect_source_language(content)

    # 리뷰 생성 (DB 실패 시 이미지 롤백)
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
        # DB 저장 실패 시 이미지 파일 롤백
        if image_url:
            delete_image_file(image_url)
        raise HTTPException(status_code=500, detail=f"리뷰 저장 실패: {str(e)}")


    # 통계 업데이트
    update_place_review_stats(db, place_id)

    # 썸네일 업데이트 (이미지가 있으면)
    if image_url:
        update_place_thumbnails(db, place_id, image_url)

    # 사용자 정보 조회
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
    rating: int = Form(..., ge=1, le=5, description="별점 (1~5)"),
    content: str = Form(..., min_length=1, max_length=1000, description="리뷰 내용"),
    image: Optional[UploadFile] = File(None, description="이미지 파일 (선택)"),
    remove_image: bool = Form(False, description="기존 이미지 삭제 여부"),
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """
    리뷰 수정 (이미지 파일 업로드 포함)
    """
    # 리뷰 존재 확인
    review = (
        db.query(PlaceReview)
        .filter(
            PlaceReview.id == review_id,
            PlaceReview.place_id == place_id,
        )
        .first()
    )

    if not review:
        raise HTTPException(status_code=404, detail="리뷰를 찾을 수 없습니다")

    if review.user_id != user_id:
        raise HTTPException(status_code=403, detail="본인의 리뷰만 수정할 수 있습니다")


    # 이미지 처리 (DB 성공 후 기존 이미지 삭제하는 안전한 방식)
    old_image_url = review.image_url # 기존 이미지 URL 저장
    new_image_url = None # 새로 업로드한 이미지 URL
    image_url = review.image_url # 최종 이미지 URL (기본: 기존 유지)
    should_delete_old = False # 기존 이미지 삭제 여부

    if image:
        # 새 이미지 먼저 저장 (기존 이미지는 아직 삭제 안 함)
        new_image_url = await save_image_file(image, "place_images")
        image_url = new_image_url
        should_delete_old = bool(old_image_url)
    elif remove_image:
        # 이미지 삭제 요청
        image_url = None
        should_delete_old = bool(old_image_url)

    detected_lang = detect_source_language(content)

    # 리뷰 수정 (DB 실패 시 새 이미지 롤백)
    try:
        review.rating = rating
        review.content = content
        review.source_lang = detected_lang
        review.image_url = image_url
        review.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(review)
    except Exception as e:
        # DB 저장 실패 시 새 이미지 파일 롤백
        if new_image_url:
            delete_image_file(new_image_url)
        raise HTTPException(status_code=500, detail=f"리뷰 수정 실패: {str(e)}")

    # DB 성공 후 기존 이미지 삭제
    if should_delete_old and old_image_url:
        delete_image_file(old_image_url)
        remove_place_thumbnail(db, place_id, old_image_url)

    # 통계 업데이트
    update_place_review_stats(db, place_id)

    # 썸네일 업데이트 (이미지가 있으면)
    if image_url:
        update_place_thumbnails(db, place_id, image_url)

    # 사용자 정보 조회
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
    """
    리뷰 삭제
    """
    # 리뷰 존재 확인
    review = (
        db.query(PlaceReview)
        .filter(
            PlaceReview.id == review_id,
            PlaceReview.place_id == place_id,
        )
        .first()
    )

    if not review:
        raise HTTPException(status_code=404, detail="리뷰를 찾을 수 없습니다")


    # 본인 확인
    if review.user_id != user_id:
        raise HTTPException(status_code=403, detail="본인의 리뷰만 삭제할 수 있습니다")


    # 이미지 파일 삭제 및 썸네일에서 제거
    if review.image_url:
        delete_image_file(review.image_url)
        remove_place_thumbnail(db, place_id, review.image_url)

    # 리뷰 삭제
    db.delete(review)
    db.commit()

    # 통계 업데이트
    update_place_review_stats(db, place_id)

    return {"message": "리뷰가 삭제되었습니다"}

