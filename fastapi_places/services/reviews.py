from decimal import Decimal

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from models import Place, PlaceReview


def update_place_review_stats(db: Session, place_id: int):
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
    place = db.query(Place).filter(Place.id == place_id).first()
    if not place:
        return

    thumbnails = place.thumbnail_urls or []

    if len(thumbnails) < 3 and new_image_url not in thumbnails:
        thumbnails.append(new_image_url)
        place.thumbnail_urls = thumbnails
        db.commit()


def remove_place_thumbnail(db: Session, place_id: int, image_url: str):
    if not image_url:
        return

    place = db.query(Place).filter(Place.id == place_id).first()
    if not place:
        return

    thumbnails = list(place.thumbnail_urls or [])

    if image_url in thumbnails:
        thumbnails.remove(image_url)
        place.thumbnail_urls = thumbnails
        flag_modified(place, "thumbnail_urls")
        db.commit()
