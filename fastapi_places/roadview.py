from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.sql.expression import func
from typing import List
from pydantic import BaseModel
from datetime import datetime

# 기존 모듈들 임포트
from database import get_db
from auth import require_auth
from models import Place, PlaceReview, RoadviewGameImage  # models.py에 RoadviewGameImage 추가 필요

# 별도의 라우터 정의
router = APIRouter(
    prefix="/roadview",  # URL 주소: /api/v1/roadview/...
    tags=["Roadview Game"]
)

# 응답 스키마 (간단하게 내부에 정의하거나 schemas.py로 빼셔도 됩니다)
class ReviewPhotoResponse(BaseModel):
    review_id: int
    place_name: str
    content: str
    image_url: str
    latitude: float
    longitude: float
    city: str | None
    created_at: datetime

# ---------------------------------------------------------
# 1. 내 리뷰 중 '사진이 있는' 리뷰 목록 가져오기
# ---------------------------------------------------------
@router.get("/my-photo-reviews", response_model=List[ReviewPhotoResponse])
def get_my_photo_reviews(
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    내 리뷰 중 사진이 포함된 리뷰 목록 조회 (로드뷰 게임 후보군)
    """
    # PlaceReview와 Place를 조인하여 좌표 정보까지 한 번에 가져옴
    results = db.query(PlaceReview, Place).join(Place, PlaceReview.place_id == Place.id).filter(
        PlaceReview.user_id == user_id,
        PlaceReview.image_url.isnot(None),
        PlaceReview.image_url != ""
    ).order_by(PlaceReview.created_at.desc()).all()

    response = []
    for review, place in results:
        response.append({
            "review_id": review.id,
            "place_name": place.name,
            "content": review.content,
            "image_url": review.image_url,
            "latitude": float(place.latitude),
            "longitude": float(place.longitude),
            "city": place.city,
            "created_at": review.created_at
        })
    
    return response

# ---------------------------------------------------------
# 2. 선택한 리뷰를 로드뷰 게임 데이터로 등록하기
# ---------------------------------------------------------
@router.post("/start-from-review/{review_id}")
def create_roadview_from_review(
    review_id: int,
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    내 리뷰의 사진과 장소 좌표를 이용해 로드뷰 게임 데이터 생성
    """
    # 본인의 리뷰인지, 사진이 있는지 확인
    row = db.query(PlaceReview, Place).join(Place).filter(
        PlaceReview.id == review_id,
        PlaceReview.user_id == user_id
    ).first()

    if not row:
        raise HTTPException(status_code=404, detail="리뷰를 찾을 수 없거나 권한이 없습니다.")
    
    review, place = row

    if not review.image_url:
        raise HTTPException(status_code=400, detail="이 리뷰에는 사진이 없습니다.")

    # RoadviewGameImage 테이블에 저장
    # (주의: models.py에 RoadviewGameImage 클래스가 있어야 함)
    game_image = RoadviewGameImage(
        image_url=review.image_url,
        latitude=place.latitude,
        longitude=place.longitude,
        city=place.city,
        created_by_id=user_id
    )
    
    db.add(game_image)
    db.commit()
    db.refresh(game_image)

    return {
        "status": "success", 
        "message": "Game started with review photo!",
        "game_image_id": game_image.id,
        "lat": float(place.latitude),
        "lng": float(place.longitude)
    }

# ---------------------------------------------------------
# 3. 랜덤 게임 이미지 가져오기
# ---------------------------------------------------------
@router.get("/random")
def get_random_game_image(db: Session = Depends(get_db)):
    random_image = db.query(RoadviewGameImage).order_by(func.random()).first()
    if not random_image:
        raise HTTPException(status_code=404, detail="등록된 게임 이미지가 없습니다.")
        
    return {
        "review_id": random_image.id,
        "place_name": "랜덤 장소",
        "image_url": random_image.image_url,
        "lat": float(random_image.latitude),  # latitude -> lat으로 통일
        "lng": float(random_image.longitude), # longitude -> lng으로 통일
        "city": random_image.city
    }