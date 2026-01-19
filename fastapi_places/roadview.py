from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.sql.expression import func
from typing import List
from pydantic import BaseModel
from datetime import datetime

# 기존 모듈들 임포트
from database import get_db
from auth import require_auth
from models import Place, PlaceReview, RoadviewGameImage, RoadviewGameHistory

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

    
    # [중복 방지 로직]
    # 1. 좌표(lat, lng)와 이미지(image_url)가 모두 동일한 경우 -> 중복으로 간주하고 추가 안 함
    # 2. 좌표가 같아도 이미지가 다르면 -> 새로운 데이터로 추가 (사용자 요청사항)
    existing_game_image = db.query(RoadviewGameImage).filter(
        RoadviewGameImage.latitude == place.latitude,
        RoadviewGameImage.longitude == place.longitude,
        RoadviewGameImage.image_url == review.image_url
    ).first()

    if existing_game_image:
        # 이미 존재하면 해당 ID 반환하고 종료 (중복 생성 방지)
        return {
            "status": "success", 
            "message": "Game image already exists (Duplicate skipped).",
            "game_image_id": existing_game_image.id,
            "lat": float(place.latitude),
            "lng": float(place.longitude)
        }

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
# 3. 랜덤 게임 이미지 가져오기 (중복 방지 포함)
# ---------------------------------------------------------
@router.get("/random")
def get_random_game_image(
    exclude_ids: str = Query(None, description="제외할 게임 ID 목록 (쉼표로 구분)"),
    db: Session = Depends(get_db),
    # user_id: int | None = Depends(get_current_user_optional) # 영구 중복 방지 제거 요청으로 인해 주석 처리
):
    query = db.query(RoadviewGameImage)

    # [세션 기반 중복 방지]
    # 프론트엔드에서 현재 세션(한 번의 플레이 흐름) 동안 플레이한 ID 목록을 보내줌
    if exclude_ids:
        try:
            # "1,2,3" -> [1, 2, 3]
            exclude_list = [int(id_str.strip()) for id_str in exclude_ids.split(",") if id_str.strip().isdigit()]
            if exclude_list:
                query = query.filter(RoadviewGameImage.id.notin_(exclude_list))
        except Exception:
            pass  # 파싱 에러 시 무시

    # [영구 중복 방지 로직 제거됨]
    # 사용자 요청: "완전 중복 플레이 방지가 아니라 한번 플레이할때 같은 장소가 안나오게 하고 싶은건데"
    # -> DB 기록(History) 기반 필터링은 제거하고, 세션 기반(exclude_ids) 필터링만 적용

    random_image = query.order_by(func.random()).first()

    if not random_image:
        # 만약 안 푼 문제가 없다면? (전부 다 풀었을 경우) -> 그냥 전체 중에서 랜덤? 아니면 완료 메시지?
        # 일단은 풀었던 것 중에서도 랜덤으로 주도록 fallback (또는 에러 반환)
        # 1차 시도: 그냥 전체 랜덤 (fallback)
        random_image = db.query(RoadviewGameImage).order_by(func.random()).first()
        
        if not random_image:
             raise HTTPException(status_code=404, detail="등록된 게임 이미지가 없습니다.")
        
    return {
        "review_id": random_image.id, # 실제로는 game_image.id
        "place_name": "랜덤 장소",
        "image_url": random_image.image_url,
        "lat": float(random_image.latitude),
        "lng": float(random_image.longitude),
        "city": random_image.city
    }


@router.get("/session")
def get_game_session(
    limit: int = Query(10, le=20, description="가져올 최대 게임 수"),
    db: Session = Depends(get_db)
):
    """
    게임 세션 시작 시 한 번에 여러 개의 게임 데이터를 가져옵니다.
    최대 limit(=10)개까지 랜덤으로 선택하여 반환합니다.
    (결과 페이지를 위해 장소 ID, 리뷰 내용 등 추가 정보 포함)
    """
    # 랜덤으로 limit 개수만큼 조회
    game_images = db.query(RoadviewGameImage).order_by(func.random()).limit(limit).all()
    
    if not game_images:
        raise HTTPException(status_code=404, detail="등록된 게임 이미지가 없습니다.")

    results = []
    for img in game_images:
        # [추가] 장소 정보와 리뷰 내용 찾기 (역추적)
        # 1. 좌표로 장소 찾기
        place = db.query(Place).filter(
            Place.latitude == img.latitude,
            Place.longitude == img.longitude
        ).first()

        # 2. 이미지 URL로 리뷰 찾기
        review = db.query(PlaceReview).filter(
            PlaceReview.image_url == img.image_url
        ).first()

        results.append({
            "game_id": img.id,
            "place_name": place.name if place else "알 수 없는 장소",
            "place_id": place.id if place else None, # 상세 페이지 이동용
            "image_url": img.image_url,
            "lat": float(img.latitude),
            "lng": float(img.longitude),
            "city": img.city,
            "review_content": review.content if review else None, # 리뷰 내용
            "reviewer_nickname": review.user.nickname if review and review.user else "Anonymous"
        })
        
    return {
        "total_count": len(results),
        "games": results
    }


# ---------------------------------------------------------
# 4. 게임 완료 기록 저장 (중복 방지용)
# ---------------------------------------------------------
@router.post("/complete/{game_image_id}")
def complete_game(
    game_image_id: int,
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db)
):
    # 이미 기록이 있는지 확인
    exists = db.query(RoadviewGameHistory).filter(
        RoadviewGameHistory.user_id == user_id,
        RoadviewGameHistory.game_image_id == game_image_id
    ).first()

    if not exists:
        history = RoadviewGameHistory(
            user_id=user_id,
            game_image_id=game_image_id
        )
        db.add(history)
        db.commit()
    
    return {"status": "success", "message": "Game history saved"}