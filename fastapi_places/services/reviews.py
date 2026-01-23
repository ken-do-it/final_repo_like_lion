from decimal import Decimal

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from models import Place, PlaceReview


# ==================== 리뷰 통계 업데이트 ====================

def update_place_review_stats(db: Session, place_id: int):
    """
    장소의 평균 별점 및 리뷰 수 업데이트 (캐시)
    """
    place = db.query(Place).filter(Place.id == place_id).first()
    if not place:
        return

    reviews = db.query(PlaceReview).filter(PlaceReview.place_id == place_id).all()

    if reviews:
        total_rating = sum(r.rating for r in reviews)
        place.average_rating = Decimal(total_rating / len(reviews))
        place.review_count = len(reviews)
    else:
        place.average_rating = Decimal(0)
        place.review_count = 0

    db.commit()


def update_place_thumbnails(db: Session, place_id: int, new_image_url: str):
    """
    리뷰 이미지를 장소 썸네일에 추가 (최대 3장)
    """
    place = db.query(Place).filter(Place.id == place_id).first()
    if not place:
        return

    thumbnails = place.thumbnail_urls or []

    if len(thumbnails) < 3 and new_image_url not in thumbnails:
        thumbnails.append(new_image_url)
        place.thumbnail_urls = thumbnails
        db.commit()


def remove_place_thumbnail(db: Session, place_id: int, image_url: str):
    """
    장소 썸네일에서 특정 이미지 URL 제거
    """
    if not image_url:
        return

    place = db.query(Place).filter(Place.id == place_id).first()
    if not place:
        return

    # 리스트 복사 (SQLAlchemy JSON 필드 변경 감지를 위해)
    thumbnails = list(place.thumbnail_urls or [])

    if image_url in thumbnails:
        thumbnails.remove(image_url)
        place.thumbnail_urls = thumbnails
        flag_modified(place, "thumbnail_urls")  # JSON 필드 변경 명시
        db.commit()