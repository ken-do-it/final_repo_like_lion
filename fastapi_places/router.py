"""
Places API Router
장소 검색, 리뷰, 현지인 인증, 칼럼 관련 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date, datetime
import os
import uuid
import json
from pathlib import Path

from models import (
    Place, PlaceReview, PlaceBookmark, LocalBadge,
    LocalColumn, LocalColumnSection, LocalColumnSectionImage, User
)
from schemas import (
    PlaceSearchRequest, PlaceSearchResult, PlaceAutocompleteRequest,
    PlaceAutocompleteSuggestion, PlaceDetailResponse, PlaceCreateRequest,
    ReviewCreateRequest, ReviewResponse, BookmarkResponse, LocalBadgeAuthRequest,
    LocalBadgeAuthResponse, LocalBadgeStatusResponse, LocalColumnCreateRequest,
    LocalColumnResponse, LocalColumnListResponse, CityContentResponse, PopularCityResponse,
    LocalColumnSectionResponse, LocalColumnSectionImageResponse
)
from service import (
    search_places_hybrid, authenticate_local_badge, check_local_badge_active,
    update_place_review_stats, update_place_thumbnails, remove_place_thumbnail,
    get_or_create_place_by_api_id,
    search_kakao_places, search_google_places, get_google_place_details, reverse_geocode,
    geocode_address
)
from database import get_db
from auth import get_current_user, require_auth

router = APIRouter(prefix="/places", tags=["Places"])


# ==================== 이미지 헬퍼 함수 ====================

def delete_image_file(image_url: str) -> bool:
    """
    이미지 파일 삭제

    Args:
        image_url: 이미지 URL (예: http://localhost:8000/media/place_images/xxx.jpg)

    Returns:
        삭제 성공 여부
    """
    if not image_url:
        return False

    try:
        # URL에서 파일 경로 추출
        # http://localhost:8000/media/place_images/xxx.jpg -> /app/django_app/media/place_images/xxx.jpg
        if "/media/" in image_url:
            relative_path = image_url.split("/media/")[-1]
            file_path = Path(f"/app/django_app/media/{relative_path}")

            if file_path.exists():
                file_path.unlink()
                return True
    except Exception as e:
        print(f"이미지 파일 삭제 실패: {e}")

    return False


async def save_image_file(image: UploadFile, subfolder: str = "place_images") -> str:
    """
    이미지 파일을 저장하고 URL 반환

    Args:
        image: 업로드된 이미지 파일
        subfolder: media 하위 폴더명 (기본: place_images)

    Returns:
        저장된 이미지 URL
    """
    # 1. 파일 확장자 검증
    allowed_extensions = {".jpg", ".jpeg", ".png", ".gif"}
    file_ext = os.path.splitext(image.filename)[1].lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다. 허용: {', '.join(allowed_extensions)}"
        )

    # 2. 파일 크기 검증 (10MB)
    image.file.seek(0, 2)
    file_size = image.file.tell()
    image.file.seek(0)

    max_size = 10 * 1024 * 1024  # 10MB
    if file_size > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"파일 크기가 너무 큽니다. 최대 {max_size // (1024*1024)}MB"
        )

    # 3. 고유 파일명 생성 (UUID)
    unique_filename = f"{uuid.uuid4()}{file_ext}"

    # 4. 저장 경로 설정
    media_dir = Path(f"/app/django_app/media/{subfolder}")
    media_dir.mkdir(parents=True, exist_ok=True)

    file_path = media_dir / unique_filename

    # 5. 파일 저장
    try:
        with open(file_path, "wb") as f:
            content = await image.read()
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 저장 실패: {str(e)}")

    # 6. URL 반환
    return f"http://localhost:8000/media/{subfolder}/{unique_filename}"


# ==================== 장소 검색 ====================

@router.get("/search")
async def search_places(
    query: str = Query(..., min_length=1, description="검색어"),
    category: Optional[str] = Query(None, description="카테고리 필터"),
    city: Optional[str] = Query(None, description="도시 필터"),
    db: Session = Depends(get_db)
):
    """
    장소 검색 (카카오맵 + 구글맵 통합)

    참고: API 특성상 총 결과 수는 제한적일 수 있음 (카카오+구글 합쳐서 최대 ~45개)
    """
    all_results = await search_places_hybrid(query, category, city, db=db)

    return {
        "query": query,
        "total": len(all_results),
        "results": all_results
    }


@router.get("/autocomplete")
async def autocomplete_places(
    q: str = Query(..., min_length=2, description="검색어 (최소 2글자)"),
    limit: int = Query(10, ge=1, le=50)
):
    """
    장소 자동완성 (카카오 API 실시간 조회)
    타이핑하는 동안 실시간으로 장소명 추천
    """
    # 카카오 API로 실시간 검색
    kakao_results = await search_kakao_places(q, limit=limit)

    suggestions = [
        PlaceAutocompleteSuggestion(
            place_api_id=result.get("place_api_id"),
            name=result["name"],
            address=result["address"],
            city=result["city"]
        )
        for result in kakao_results
    ]

    return {"suggestions": suggestions}


# ==================== 장소 상세 ====================

@router.get("/detail")
async def get_place_detail_by_api_id(
    place_api_id: str = Query(..., description="외부 API의 장소 ID"),
    provider: str = Query("KAKAO", description="제공자 (KAKAO, GOOGLE)"),
    name: str = Query(..., description="장소명 (검색용)"),
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_current_user)
):
    """
    장소 상세 정보 조회 (외부 API ID 기반)
    DB에 없으면 외부 API에서 가져와서 저장 (온디맨드 방식)

    반환:
    - DB 저장 정보: name, address, latitude, longitude, category 등
    - 동적 정보 (실시간 API 호출): phone, place_url, opening_hours
    - is_bookmarked: 로그인 사용자의 찜 여부
    """
    # 1. DB 조회 또는 생성 (기본 정보)
    place = await get_or_create_place_by_api_id(
        db=db,
        place_api_id=place_api_id,
        provider=provider,
        name_hint=name
    )

    if not place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")

    # 2. 동적 정보 API 호출
    phone = ""
    place_url = ""
    opening_hours = []

    if provider == "KAKAO":
        # 카카오: 검색 API 직접 호출해서 phone, place_url 가져오기
        import httpx
        import os
        kakao_api_key = os.getenv("YJ_KAKAO_REST_API_KEY", "")
        if kakao_api_key:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(
                        "https://dapi.kakao.com/v2/local/search/keyword.json",
                        headers={"Authorization": f"KakaoAK {kakao_api_key}"},
                        params={"query": name, "size": 5}
                    )
                    if response.status_code == 200:
                        data = response.json()
                        for doc in data.get("documents", []):
                            if doc.get("id") == place_api_id:
                                phone = doc.get("phone", "")
                                place_url = doc.get("place_url", "")
                                break
            except Exception as e:
                print(f"카카오 상세 정보 조회 실패: {e}")

        # 구글에서 영업시간 가져오기 (장소명 + 주소로 검색)
        google_results = await search_google_places(f"{place.name} {place.address}", limit=3)
        if google_results:
            # 첫 번째 결과의 place_id로 상세 정보 조회
            google_place_id = google_results[0].get("place_api_id")
            if google_place_id:
                google_details = await get_google_place_details(google_place_id)
                if google_details:
                    opening_hours = google_details.get("opening_hours", [])

    elif provider == "GOOGLE":
        # 구글: Details API에서 전부 가져오기
        google_details = await get_google_place_details(place_api_id)
        if google_details:
            phone = google_details.get("phone", "")
            opening_hours = google_details.get("opening_hours", [])
            place_url = google_details.get("website", "")

    # 3. 북마크 여부 확인
    is_bookmarked = False
    if user_id:
        bookmark = db.query(PlaceBookmark).filter(
            PlaceBookmark.user_id == user_id,
            PlaceBookmark.place_id == place.id
        ).first()
        is_bookmarked = bookmark is not None

    # 4. DB 데이터 + 동적 정보 합치기
    return {
        # DB 정보
        "id": place.id,
        "provider": place.provider,
        "place_api_id": place.place_api_id,
        "name": place.name,
        "address": place.address,
        "city": place.city,
        "latitude": float(place.latitude),
        "longitude": float(place.longitude),
        "category_main": place.category_main,
        "category_detail": place.category_detail,
        "thumbnail_urls": place.thumbnail_urls,
        "average_rating": float(place.average_rating) if place.average_rating else 0.0,
        "review_count": place.review_count,
        "created_at": place.created_at,
        "updated_at": place.updated_at,
        # 동적 정보 (DB 저장 안함)
        "phone": phone,
        "place_url": place_url,
        "opening_hours": opening_hours,
        # 사용자별 정보
        "is_bookmarked": is_bookmarked
    }


# ==================== 현지인 인증 ====================

@router.post("/local-badge/authenticate", response_model=LocalBadgeAuthResponse)
async def authenticate_badge(
    auth_data: LocalBadgeAuthRequest,
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    현지인 인증 (위치 기반)
    """
    badge, message = await authenticate_local_badge(
        db, user_id, auth_data.latitude, auth_data.longitude
    )

    return LocalBadgeAuthResponse(
        level=badge.level,
        city=badge.city,
        is_active=badge.is_active,
        next_authentication_due=badge.next_authentication_due,
        message=message
    )


@router.get("/local-badge/status", response_model=LocalBadgeStatusResponse)
def get_badge_status(
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    현지인 뱃지 상태 조회
    """
    badge = db.query(LocalBadge).filter(LocalBadge.user_id == user_id).first()

    if not badge:
        return LocalBadgeStatusResponse(
            level=0,
            city=None,
            is_active=False,
            first_authenticated_at=None,
            last_authenticated_at=None,
            next_authentication_due=None,
            maintenance_months=0,
            authentication_count=0
        )

    return LocalBadgeStatusResponse(
        level=badge.level,
        city=badge.city,
        is_active=badge.is_active,
        first_authenticated_at=badge.first_authenticated_at,
        last_authenticated_at=badge.last_authenticated_at,
        next_authentication_due=badge.next_authentication_due,
        maintenance_months=badge.maintenance_months,
        authentication_count=0  # 추후 구현
    )


# ==================== 현지인 칼럼 ====================

@router.get("/local-columns", response_model=List[LocalColumnListResponse])
def get_local_columns(
    city: Optional[str] = Query(None, description="도시 필터"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    현지인 칼럼 목록 조회
    """
    offset = (page - 1) * limit

    query = db.query(LocalColumn)

    # 도시 필터링 (representative_place를 통해)
    if city:
        query = query.join(Place, LocalColumn.representative_place_id == Place.id, isouter=True).filter(
            Place.city == city
        )

    columns = query.order_by(LocalColumn.created_at.desc()).offset(offset).limit(limit).all()

    # 사용자 닉네임 및 뱃지 레벨 조회
    result = []
    for column in columns:
        user = db.query(User).filter(User.id == column.user_id).first()
        badge = db.query(LocalBadge).filter(
            LocalBadge.user_id == column.user_id,
            LocalBadge.is_active == True
        ).first()
        result.append(LocalColumnListResponse(
            id=column.id,
            user_id=column.user_id,
            user_nickname=user.nickname if user else None,
            user_level=badge.level if badge else None,
            title=column.title,
            thumbnail_url=column.thumbnail_url,
            view_count=column.view_count,
            created_at=column.created_at
        ))

    return result


@router.get("/local-columns/{column_id}", response_model=LocalColumnResponse)
def get_local_column_detail(
    column_id: int,
    db: Session = Depends(get_db)
):
    """
    현지인 칼럼 상세 조회 (조회수 증가)
    """
    column = db.query(LocalColumn).filter(LocalColumn.id == column_id).first()

    if not column:
        raise HTTPException(status_code=404, detail="칼럼을 찾을 수 없습니다")

    # 조회수 증가
    column.view_count += 1
    db.commit()

    # 섹션 및 이미지 조회
    sections = db.query(LocalColumnSection).filter(
        LocalColumnSection.column_id == column_id
    ).order_by(LocalColumnSection.order).all()

    section_data = []
    for section in sections:
        images = db.query(LocalColumnSectionImage).filter(
            LocalColumnSectionImage.section_id == section.id
        ).order_by(LocalColumnSectionImage.order).all()

        # 장소명 조회
        place_name = None
        if section.place_id:
            place = db.query(Place).filter(Place.id == section.place_id).first()
            if place:
                place_name = place.name

        from schemas import LocalColumnSectionImageResponse, LocalColumnSectionResponse
        section_data.append(LocalColumnSectionResponse(
            id=section.id,
            title=section.title,
            content=section.content,
            place_id=section.place_id,
            place_name=place_name,
            order=section.order,
            images=[
                LocalColumnSectionImageResponse(
                    id=img.id,
                    image_url=img.image_url,
                    order=img.order
                )
                for img in images
            ]
        ))

    # 사용자 정보 및 뱃지 레벨 조회
    user = db.query(User).filter(User.id == column.user_id).first()
    badge = db.query(LocalBadge).filter(
        LocalBadge.user_id == column.user_id,
        LocalBadge.is_active == True
    ).first()

    return LocalColumnResponse(
        id=column.id,
        user_id=column.user_id,
        user_nickname=user.nickname if user else None,
        user_level=badge.level if badge else None,
        title=column.title,
        content=column.content,
        thumbnail_url=column.thumbnail_url,
        intro_image_url=column.intro_image_url,
        representative_place_id=column.representative_place_id,
        view_count=column.view_count,
        created_at=column.created_at,
        sections=section_data
    )


@router.post("/local-columns", response_model=LocalColumnResponse)
async def create_local_column(
    # FastAPI의 Form과 File을 사용하여 각 필드를 명시적으로 선언
    title: str = Form(...),
    content: str = Form(...),
    sections: str = Form(..., alias='sections'),
    thumbnail: UploadFile = File(...),
    intro_image: Optional[UploadFile] = File(None),
    representative_place_id: Optional[int] = Form(None),
    request: Request = None, # form_data.items()를 위해 유지
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    현지인 칼럼 작성 (현지인 인증 필요)

    multipart/form-data 형식으로 전송:
    - thumbnail: 파일 (필수)
    - intro_image: 파일 (선택)
    - title: 문자열 (필수)
    - content: 문자열 (필수)
    - representative_place_id: 숫자 (선택)
    - sections: JSON 문자열 (섹션 메타데이터)
    - section_X_image_Y: 파일들...
    """
    # 현지인 뱃지 확인
    check_local_badge_active(db, user_id)
    
    # 1. 섹션 데이터 파싱 (이미지 저장 전에 검증)
    try:
        sections_data = json.loads(sections)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="sections는 유효한 JSON이어야 합니다")

    # 2. 섹션 이미지 파일들 수집 (request.form() 필요)
    form_data = await request.form()
    section_images = {}

    # 디버그: form_data 키 출력
    print(f"[DEBUG] form_data keys: {list(form_data.keys())}")

    for key, value in form_data.items():
        print(f"[DEBUG] key: {key}, type: {type(value)}, is UploadFile: {isinstance(value, UploadFile)}")
        if key.startswith('section_') and '_image_' in key:
            # UploadFile 체크 대신 file 속성 존재 여부로 확인
            if hasattr(value, 'file'):
                parts = key.replace('section_', '').split('_image_')
                if len(parts) == 2:
                    try:
                        section_idx = int(parts[0])
                        image_idx = int(parts[1])
                        if section_idx not in section_images:
                            section_images[section_idx] = {}
                        section_images[section_idx][image_idx] = value
                        print(f"[DEBUG] Added section image: section_{section_idx}_image_{image_idx}")
                    except (ValueError, IndexError):
                        pass

    print(f"[DEBUG] section_images collected: {section_images}")

    # 3. 이미지 저장 및 DB 생성 (롤백 가능하도록 저장된 이미지 URL 추적)
    saved_image_urls = []

    try:
        # 3-1. 썸네일 이미지 저장
        thumbnail_url = await save_image_file(thumbnail, "place_images")
        saved_image_urls.append(thumbnail_url)

        # 3-2. 인트로 이미지 저장 (선택)
        intro_image_url = None
        if intro_image:
            intro_image_url = await save_image_file(intro_image, "place_images")
            saved_image_urls.append(intro_image_url)

        # 4. 칼럼 DB 생성
        column = LocalColumn(
            user_id=user_id,
            title=title,
            content=content,
            thumbnail_url=thumbnail_url,
            intro_image_url=intro_image_url,
            representative_place_id=representative_place_id
        )
        db.add(column)

        # 5. 섹션 및 이미지 객체 생성 (아직 commit 안 함)
        sections_to_commit = []
        images_to_commit = []
        
        for idx, section_req in enumerate(sections_data):
            # 장소 정보 처리 (place_id 또는 db_place_id 모두 지원)
            local_place_id = section_req.get('place_id') or section_req.get('db_place_id')
            if not local_place_id and section_req.get('place_api_id'):
                place_api_id = section_req.get('place_api_id')
                place_name = section_req.get('place_name')
                local_place = await get_or_create_place_by_api_id(
                    db, place_api_id=place_api_id, name_hint=place_name
                )
                if local_place:
                    local_place_id = local_place.id
            
            section = LocalColumnSection(
                column=column, # 관계 설정
                place_id=local_place_id,
                order=section_req.get('order', idx),
                title=section_req.get('title', ''),
                content=section_req.get('content', '')
            )
            sections_to_commit.append(section)

            if idx in section_images:
                sorted_images = sorted(section_images[idx].items())
                for img_idx, img_file in sorted_images:
                    img_url = await save_image_file(img_file, "place_images")
                    saved_image_urls.append(img_url)
                    image = LocalColumnSectionImage(
                        section=section, # 관계 설정
                        image_url=img_url,
                        order=img_idx
                    )
                    images_to_commit.append(image)

        db.add_all(sections_to_commit)
        db.add_all(images_to_commit)
        
        # 6. 모든 작업이 성공했을 때 단 한번만 commit
        db.commit()

        # 7. 응답 모델 구성
        db.refresh(column)
        response_sections = []
        for section in sections_to_commit:
            db.refresh(section)
            images_for_response = [
                img for img in images_to_commit if img.section == section
            ]
            # 장소명 조회
            place_name = None
            if section.place_id:
                place = db.query(Place).filter(Place.id == section.place_id).first()
                if place:
                    place_name = place.name
            response_sections.append(
                LocalColumnSectionResponse(
                    id=section.id,
                    title=section.title,
                    content=section.content,
                    place_id=section.place_id,
                    place_name=place_name,
                    order=section.order,
                    images=[
                        LocalColumnSectionImageResponse.model_validate(img, from_attributes=True) for img in images_for_response
                    ]
                )
            )
    except Exception as e:
        for img_url in saved_image_urls:
            delete_image_file(img_url)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"칼럼 저장 실패: {str(e)}")

    user = db.query(User).filter(User.id == user_id).first()
    badge = db.query(LocalBadge).filter(
        LocalBadge.user_id == user_id,
        LocalBadge.is_active == True
    ).first()

    # 최종 응답 모델 구성
    return LocalColumnResponse(
        id=column.id,
        user_id=user_id,
        user_nickname=user.nickname if user else None,
        user_level=badge.level if badge else None,
        title=column.title,
        content=column.content,
        thumbnail_url=column.thumbnail_url,
        intro_image_url=column.intro_image_url,
        representative_place_id=column.representative_place_id,
        view_count=column.view_count,
        created_at=column.created_at,
        sections=response_sections
    )


@router.put("/local-columns/{column_id}", response_model=LocalColumnResponse)
async def update_local_column(
    column_id: int,
    request: Request,
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    현지인 칼럼 수정 (이미지 삭제/변경 포함)

    multipart/form-data 형식으로 전송:
    - title: 문자열 (선택)
    - content: 문자열 (선택)
    - representative_place_id: 숫자 (선택)
    - thumbnail: 파일 (선택, 새 썸네일로 교체)
    - remove_thumbnail: "true" (선택, 썸네일 삭제 - 새 파일 없이)
    - intro_image: 파일 (선택, 새 인트로 이미지로 교체)
    - remove_intro_image: "true" (선택, 인트로 이미지 삭제)
    - sections: JSON 문자열 (선택, 섹션 전체 교체)
        [{
            "title": "섹션1",
            "content": "내용1",
            "place_id": 123,
            "order": 0,
            "keep_images": ["http://.../existing1.jpg", "http://.../existing2.jpg"]
        }]
        - keep_images: 유지할 기존 이미지 URL 배열 (파일 삭제 안 함)
        - keep_images에 없는 기존 이미지는 파일 삭제됨
    - section_X_image_Y: 파일 (새로 추가할 섹션 이미지)
        - 예: section_0_image_0, section_0_image_1, section_1_image_0
        - keep_images 뒤에 순서대로 추가됨
    """
    # 칼럼 존재 확인
    column = db.query(LocalColumn).filter(LocalColumn.id == column_id).first()

    if not column:
        raise HTTPException(status_code=404, detail="칼럼을 찾을 수 없습니다")

    # 본인 확인
    if column.user_id != user_id:
        raise HTTPException(status_code=403, detail="본인의 칼럼만 수정할 수 있습니다")

    # Form 데이터 가져오기
    form_data = await request.form()

    # 1. 기본 필드 추출
    title = form_data.get('title')
    content = form_data.get('content')
    representative_place_id = form_data.get('representative_place_id')

    # 2. 이미지 관련 데이터 추출
    thumbnail = form_data.get('thumbnail')
    remove_thumbnail = form_data.get('remove_thumbnail') == 'true'
    intro_image = form_data.get('intro_image')
    remove_intro_image = form_data.get('remove_intro_image') == 'true'
    sections_json = form_data.get('sections')

    # 3. 섹션 이미지 파일들 수집
    section_images = {}

    # 디버그: form_data 키 출력
    print(f"[DEBUG UPDATE] form_data keys: {list(form_data.keys())}")

    for key, value in form_data.items():
        print(f"[DEBUG UPDATE] key: {key}, type: {type(value)}")
        if key.startswith('section_') and '_image_' in key:
            # UploadFile 체크 대신 file 속성 존재 여부로 확인
            if hasattr(value, 'file'):
                parts = key.replace('section_', '').split('_image_')
                if len(parts) == 2:
                    try:
                        section_idx = int(parts[0])
                        image_idx = int(parts[1])
                        if section_idx not in section_images:
                            section_images[section_idx] = {}
                        section_images[section_idx][image_idx] = value
                        print(f"[DEBUG UPDATE] Added section image: section_{section_idx}_image_{image_idx}")
                    except:
                        pass

    print(f"[DEBUG UPDATE] section_images collected: {section_images}")

    # 4. 섹션 JSON 검증 (이미지 저장 전에)
    new_sections = None
    if sections_json:
        try:
            new_sections = json.loads(sections_json)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="sections는 유효한 JSON이어야 합니다")

    # 5. 롤백을 위한 추적 변수
    saved_new_images = []  # 새로 저장한 이미지 (롤백용)
    old_images_to_delete = []  # DB 성공 후 삭제할 기존 이미지

    try:
        # 6. 기본 필드 수정
        if title:
            column.title = title
        if content:
            column.content = content
        if representative_place_id:
            try:
                column.representative_place_id = int(representative_place_id)
            except:
                pass

        # 7. 썸네일 이미지 처리 (새 이미지 먼저 저장)
        if thumbnail and isinstance(thumbnail, UploadFile):
            new_thumbnail_url = await save_image_file(thumbnail, "place_images")
            saved_new_images.append(new_thumbnail_url)
            if column.thumbnail_url:
                old_images_to_delete.append(column.thumbnail_url)
            column.thumbnail_url = new_thumbnail_url
        elif remove_thumbnail and column.thumbnail_url:
            old_images_to_delete.append(column.thumbnail_url)
            column.thumbnail_url = None

        # 8. 인트로 이미지 처리 (새 이미지 먼저 저장)
        if intro_image and isinstance(intro_image, UploadFile):
            new_intro_url = await save_image_file(intro_image, "place_images")
            saved_new_images.append(new_intro_url)
            if column.intro_image_url:
                old_images_to_delete.append(column.intro_image_url)
            column.intro_image_url = new_intro_url
        elif remove_intro_image and column.intro_image_url:
            old_images_to_delete.append(column.intro_image_url)
            column.intro_image_url = None

        # 9. 섹션 수정 (전체 교체 방식 + keep_images 지원)
        if new_sections is not None:
            # 9-1. 모든 섹션에서 유지할 이미지 URL 수집
            all_keep_images = set()
            for section_req in new_sections:
                keep_images = section_req.get('keep_images', [])
                all_keep_images.update(keep_images)

            # 9-2. 기존 섹션 및 이미지 처리
            old_sections = db.query(LocalColumnSection).filter(
                LocalColumnSection.column_id == column_id
            ).all()

            for old_section in old_sections:
                old_images = db.query(LocalColumnSectionImage).filter(
                    LocalColumnSectionImage.section_id == old_section.id
                ).all()
                for old_img in old_images:
                    # keep_images에 없는 이미지만 삭제 예정
                    if old_img.image_url not in all_keep_images:
                        old_images_to_delete.append(old_img.image_url)
                    db.delete(old_img)
                db.delete(old_section)

            db.flush()

            # 9-3. 새 섹션 생성
            for idx, section_req in enumerate(new_sections):
                # 장소 정보 처리 (place_id 우선, 없으면 place_api_id로 조회/생성)
                local_place_id = section_req.get('place_id')
                if not local_place_id and section_req.get('place_api_id'):
                    place_api_id = section_req.get('place_api_id')
                    place_name = section_req.get('place_name')
                    local_place = await get_or_create_place_by_api_id(
                        db, place_api_id=place_api_id, name_hint=place_name
                    )
                    if local_place:
                        local_place_id = local_place.id

                section = LocalColumnSection(
                    column_id=column.id,
                    place_id=local_place_id,
                    order=section_req.get('order', idx),
                    title=section_req.get('title', ''),
                    content=section_req.get('content', '')
                )
                db.add(section)
                db.flush()

                # 9-4. 기존 이미지 URL 재생성 (keep_images)
                keep_images = section_req.get('keep_images', [])
                img_order = 0
                for keep_url in keep_images:
                    image = LocalColumnSectionImage(
                        section_id=section.id,
                        image_url=keep_url,
                        order=img_order
                    )
                    db.add(image)
                    img_order += 1

                # 9-5. 새 이미지 파일 저장
                if idx in section_images:
                    sorted_images = sorted(section_images[idx].items())
                    for img_idx, img_file in sorted_images:
                        img_url = await save_image_file(img_file, "place_images")
                        saved_new_images.append(img_url)
                        image = LocalColumnSectionImage(
                            section_id=section.id,
                            image_url=img_url,
                            order=img_order
                        )
                        db.add(image)
                        img_order += 1

        db.commit()
        db.refresh(column)

    except Exception as e:
        # DB 저장 실패 시 새로 저장한 이미지 롤백
        for img_url in saved_new_images:
            delete_image_file(img_url)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"칼럼 수정 실패: {str(e)}")

    # 10. DB 성공 후 기존 이미지 파일 삭제
    for old_img_url in old_images_to_delete:
        delete_image_file(old_img_url)

    # 응답 데이터 구성
    sections = db.query(LocalColumnSection).filter(
        LocalColumnSection.column_id == column_id
    ).order_by(LocalColumnSection.order).all()

    section_data = []
    for section in sections:
        images = db.query(LocalColumnSectionImage).filter(
            LocalColumnSectionImage.section_id == section.id
        ).order_by(LocalColumnSectionImage.order).all()

        # 장소명 조회
        place_name = None
        if section.place_id:
            place = db.query(Place).filter(Place.id == section.place_id).first()
            if place:
                place_name = place.name

        from schemas import LocalColumnSectionImageResponse, LocalColumnSectionResponse
        section_data.append(LocalColumnSectionResponse(
            id=section.id,
            title=section.title,
            content=section.content,
            place_id=section.place_id,
            place_name=place_name,
            order=section.order,
            images=[
                LocalColumnSectionImageResponse(
                    id=img.id,
                    image_url=img.image_url,
                    order=img.order
                )
                for img in images
            ]
        ))

    user = db.query(User).filter(User.id == user_id).first()
    badge = db.query(LocalBadge).filter(
        LocalBadge.user_id == user_id,
        LocalBadge.is_active == True
    ).first()

    return LocalColumnResponse(
        id=column.id,
        user_id=column.user_id,
        user_nickname=user.nickname if user else None,
        user_level=badge.level if badge else None,
        title=column.title,
        content=column.content,
        thumbnail_url=column.thumbnail_url,
        intro_image_url=column.intro_image_url,
        representative_place_id=column.representative_place_id,
        view_count=column.view_count,
        created_at=column.created_at,
        sections=section_data
    )


@router.delete("/local-columns/{column_id}")
def delete_local_column(
    column_id: int,
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    현지인 칼럼 삭제 (이미지 파일 포함)
    """
    # 칼럼 존재 확인
    column = db.query(LocalColumn).filter(LocalColumn.id == column_id).first()

    if not column:
        raise HTTPException(status_code=404, detail="칼럼을 찾을 수 없습니다")

    # 본인 확인
    if column.user_id != user_id:
        raise HTTPException(status_code=403, detail="본인의 칼럼만 삭제할 수 있습니다")

    # 1. 섹션 이미지 파일 삭제
    sections = db.query(LocalColumnSection).filter(
        LocalColumnSection.column_id == column_id
    ).all()

    for section in sections:
        images = db.query(LocalColumnSectionImage).filter(
            LocalColumnSectionImage.section_id == section.id
        ).all()

        for img in images:
            delete_image_file(img.image_url)
            db.delete(img)

        db.delete(section)

    # 2. 칼럼 썸네일 이미지 파일 삭제
    if column.thumbnail_url:
        delete_image_file(column.thumbnail_url)

    # 3. 칼럼 인트로 이미지 파일 삭제
    if column.intro_image_url:
        delete_image_file(column.intro_image_url)

    # 4. 칼럼 삭제
    db.delete(column)
    db.commit()

    return {"message": "칼럼이 삭제되었습니다"}


# ==================== 도시별 콘텐츠 ====================

@router.get("/destinations/{city_name}", response_model=CityContentResponse)
def get_city_content(
    city_name: str,
    db: Session = Depends(get_db)
):
    """
    도시별 통합 콘텐츠 조회
    """
    # 장소 10개
    places = db.query(Place).filter(Place.city == city_name).limit(10).all()

    # 현지인 칼럼 10개
    columns = db.query(LocalColumn).join(
        Place, LocalColumn.representative_place_id == Place.id, isouter=True
    ).filter(Place.city == city_name).limit(10).all()

    # 칼럼 데이터 변환
    column_data = []
    for column in columns:
        user = db.query(User).filter(User.id == column.user_id).first()
        column_data.append(LocalColumnListResponse(
            id=column.id,
            user_id=column.user_id,
            user_nickname=user.nickname if user else None,
            title=column.title,
            thumbnail_url=column.thumbnail_url,
            view_count=column.view_count,
            created_at=column.created_at
        ))

    return CityContentResponse(
        places=[PlaceDetailResponse.from_orm(p) for p in places],
        local_columns=column_data,
        shortforms=[],  # 다른 앱 연동 필요
        travel_plans=[]  # 다른 앱 연동 필요
    )


@router.get("/destinations/popular", response_model=List[PopularCityResponse])
def get_popular_cities():
    """
    인기 도시 목록
    """
    popular_cities = [
        {"city_name": "서울", "description": "대한민국의 수도, 현대와 전통이 공존하는 도시"},
        {"city_name": "부산", "description": "해운대와 광안리로 유명한 항구 도시"},
        {"city_name": "제주", "description": "아름다운 자연과 독특한 문화를 가진 섬"},
        {"city_name": "대전", "description": "과학과 교육의 도시"},
        {"city_name": "대구", "description": "섬유와 패션의 도시"},
        {"city_name": "인천", "description": "국제공항과 차이나타운이 있는 관문 도시"},
        {"city_name": "광주", "description": "예술과 문화의 도시"},
        {"city_name": "수원", "description": "화성과 전통시장으로 유명한 역사 도시"},
        {"city_name": "전주", "description": "한옥마을과 비빔밥의 고장"},
        {"city_name": "경주", "description": "신라 천년의 역사가 살아있는 도시"}
    ]

    return [PopularCityResponse(**city) for city in popular_cities]


# ==================== 장소 상세 (DB ID 기반) ====================
# 주의: /{place_id} 패턴은 다른 모든 라우트보다 뒤에 위치해야 함
# 그렇지 않으면 /local-columns, /local-badge 등이 place_id로 해석됨

@router.get("/{place_id}")
async def get_place_detail_by_db_id(
    place_id: int,
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_current_user)
):
    """
    장소 상세 정보 조회 (DB ID 기반)

    반환:
    - DB 저장 정보: name, address, latitude, longitude, category 등
    - 동적 정보 (실시간 API 호출): phone, place_url, opening_hours
    - is_bookmarked: 로그인 사용자의 찜 여부
    """
    # 1. DB에서 장소 조회
    place = db.query(Place).filter(Place.id == place_id).first()

    if not place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")

    # 2. 동적 정보 API 호출
    phone = ""
    place_url = ""
    opening_hours = []

    if place.provider == "KAKAO":
        # 카카오: 검색 API 직접 호출해서 phone, place_url 가져오기
        import httpx
        import os
        kakao_api_key = os.getenv("YJ_KAKAO_REST_API_KEY", "")
        if kakao_api_key and place.name:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(
                        "https://dapi.kakao.com/v2/local/search/keyword.json",
                        headers={"Authorization": f"KakaoAK {kakao_api_key}"},
                        params={"query": place.name, "size": 5}
                    )
                    if response.status_code == 200:
                        data = response.json()
                        for doc in data.get("documents", []):
                            if doc.get("id") == place.place_api_id:
                                phone = doc.get("phone", "")
                                place_url = doc.get("place_url", "")
                                break
            except Exception as e:
                print(f"카카오 상세 정보 조회 실패: {e}")

        # 구글에서 영업시간 가져오기 (장소명 + 주소로 검색)
        google_results = await search_google_places(f"{place.name} {place.address}", limit=3)
        if google_results:
            # 첫 번째 결과의 place_id로 상세 정보 조회
            google_place_id = google_results[0].get("place_api_id")
            if google_place_id:
                google_details = await get_google_place_details(google_place_id)
                if google_details:
                    opening_hours = google_details.get("opening_hours", [])

    elif place.provider == "GOOGLE":
        # 구글: Details API에서 전부 가져오기
        if place.place_api_id:
            google_details = await get_google_place_details(place.place_api_id)
            if google_details:
                phone = google_details.get("phone", "")
                opening_hours = google_details.get("opening_hours", [])
                place_url = google_details.get("website", "")

    # 3. 북마크 여부 확인
    is_bookmarked = False
    if user_id:
        bookmark = db.query(PlaceBookmark).filter(
            PlaceBookmark.user_id == user_id,
            PlaceBookmark.place_id == place.id
        ).first()
        is_bookmarked = bookmark is not None

    # 4. DB 데이터 + 동적 정보 합치기
    return {
        # DB 정보
        "id": place.id,
        "provider": place.provider,
        "place_api_id": place.place_api_id,
        "name": place.name,
        "address": place.address,
        "city": place.city,
        "latitude": float(place.latitude),
        "longitude": float(place.longitude),
        "category_main": place.category_main,
        "category_detail": place.category_detail,
        "thumbnail_urls": place.thumbnail_urls,
        "average_rating": float(place.average_rating) if place.average_rating else 0.0,
        "review_count": place.review_count,
        "created_at": place.created_at,
        "updated_at": place.updated_at,
        # 동적 정보 (DB 저장 안함)
        "phone": phone,
        "place_url": place_url,
        "opening_hours": opening_hours,
        # 사용자별 정보
        "is_bookmarked": is_bookmarked
    }


# ==================== 장소 등록 (사용자) ====================

@router.post("/create", response_model=PlaceDetailResponse)
async def create_user_place(
    place_data: PlaceCreateRequest,
    force: bool = Query(False, description="중복 체크 무시하고 강제 등록"),
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    사용자가 직접 장소 등록

    전제 조건: API(카카오/구글)에서 검색되지 않는 장소여야 함
    주소: 도로명 주소로 등록 권장 (자동 변환)
    - provider: USER
    - place_api_id: null
    - created_by_id: 등록한 사용자 ID

    force=true: 중복 체크 없이 강제 등록
    """
    # 1. 주소 검증 및 정규화 (카카오 주소 검색 API)
    geocode_result = await geocode_address(place_data.address)
    if not geocode_result:
        raise HTTPException(
            status_code=400,
            detail="유효하지 않은 주소입니다. 정확한 주소를 입력해주세요."
        )

    # 도로명 주소와 정확한 좌표 사용
    verified_address = geocode_result["road_address"]
    verified_lat = geocode_result["latitude"]
    verified_lng = geocode_result["longitude"]

    # 2. 좌표 비교 (프론트가 보낸 좌표 vs API 좌표)
    lat_diff = abs(verified_lat - place_data.latitude)
    lng_diff = abs(verified_lng - place_data.longitude)

    # 허용 오차: 0.001도 (약 100m)
    if lat_diff > 0.001 or lng_diff > 0.001:
        raise HTTPException(
            status_code=400,
            detail="주소와 좌표가 일치하지 않습니다. 정확한 위치를 확인해주세요."
        )

    # 도시명 추출
    city = await reverse_geocode(verified_lat, verified_lng)

    # 3. force=false일 때만 중복 체크
    if not force:
        # 3-1. 카카오 장소 API 확인 (최우선)
        kakao_results = await search_kakao_places(place_data.name, verified_address)
        if kakao_results:
            raise HTTPException(
                status_code=400,
                detail="카카오맵에 이미 있는 장소입니다. 검색 후 이용해주세요."
            )

        # 3-2. 구글 장소 API 확인
        google_results = await search_google_places(f"{place_data.name} {verified_address}")
        if google_results:
            raise HTTPException(
                status_code=400,
                detail="구글맵에 이미 있는 장소입니다. 검색 후 이용해주세요."
            )

        # 3-3. DB에서 비슷한 장소 확인 (같은 도시 내 유사한 이름)
        if city:
            # 이름에서 주요 키워드 추출 (공백 기준 첫 단어)
            search_keyword = place_data.name.split()[0] if place_data.name.split() else place_data.name

            similar_places = db.query(Place).filter(
                Place.city == city,
                Place.name.contains(search_keyword)
            ).limit(5).all()

            if similar_places:
                # 409 Conflict 응답
                similar_list = [
                    {
                        "id": p.id,
                        "name": p.name,
                        "address": p.address,
                        "city": p.city,
                        "provider": p.provider
                    }
                    for p in similar_places
                ]
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": "비슷한 장소가 이미 있습니다. 그래도 등록하시겠어요?",
                        "similar_places": similar_list
                    }
                )

    # 4. 장소 생성 (검증된 도로명 주소와 좌표로 저장)
    new_place = Place(
        provider="USER",
        place_api_id=None,
        name=place_data.name,
        address=verified_address,  # 도로명 주소
        city=city,
        latitude=verified_lat,  # 검증된 좌표
        longitude=verified_lng,
        category_main=place_data.category_main,
        category_detail=place_data.category_detail or [],
        thumbnail_urls=[],
        average_rating=0.00,
        review_count=0,
        created_by_id=user_id
    )

    db.add(new_place)
    db.commit()
    db.refresh(new_place)

    return PlaceDetailResponse(
        id=new_place.id,
        provider=new_place.provider,
        place_api_id=new_place.place_api_id,
        name=new_place.name,
        address=new_place.address,
        city=new_place.city,
        latitude=new_place.latitude,
        longitude=new_place.longitude,
        category_main=new_place.category_main,
        category_detail=new_place.category_detail,
        thumbnail_urls=new_place.thumbnail_urls,
        average_rating=new_place.average_rating,
        review_count=new_place.review_count,
        created_at=new_place.created_at,
        updated_at=new_place.updated_at,
        phone="",
        place_url="",
        opening_hours=[]
    )


# ==================== 리뷰 ====================

@router.get("/{place_id}/reviews")
def get_place_reviews(
    place_id: int,
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(20, ge=1, le=100, description="페이지당 개수"),
    order_by: str = Query("latest", description="정렬: latest(최신순), rating_desc(별점높은순), rating_asc(별점낮은순)"),
    has_image: bool = Query(False, description="이미지 첨부 리뷰만 보기"),
    db: Session = Depends(get_db)
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
    else:  # latest (기본값)
        query = query.order_by(PlaceReview.created_at.desc())

    # 페이지네이션
    reviews = query.offset(offset).limit(limit).all()

    # 사용자 닉네임 조회
    review_data = []
    for review in reviews:
        user = db.query(User).filter(User.id == review.user_id).first()
        review_data.append(ReviewResponse(
            id=review.id,
            place_id=review.place_id,
            user_id=review.user_id,
            user_nickname=user.nickname if user else None,
            rating=review.rating,
            content=review.content,
            image_url=review.image_url,
            created_at=review.created_at
        ))

    # total도 같은 필터 적용
    total_query = db.query(PlaceReview).filter(PlaceReview.place_id == place_id)
    if has_image:
        total_query = total_query.filter(PlaceReview.image_url.isnot(None))
    total = total_query.count()

    return {
        "page": page,
        "limit": limit,
        "total": total,
        "reviews": review_data
    }


@router.post("/{place_id}/reviews", response_model=ReviewResponse)
async def create_review(
    place_id: int,
    rating: int = Form(..., ge=1, le=5, description="별점 (1~5)"),
    content: str = Form(..., min_length=1, max_length=1000, description="리뷰 내용"),
    image: Optional[UploadFile] = File(None, description="이미지 파일 (선택)"),
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    리뷰 작성 (이미지 파일 업로드 포함)

    - rating: 별점 (1~5)
    - content: 리뷰 내용
    - image: 이미지 파일 (선택, jpg/jpeg/png/gif, 최대 10MB)
    """
    # 장소 존재 확인
    place = db.query(Place).filter(Place.id == place_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")

    # 중복 리뷰 확인
    existing = db.query(PlaceReview).filter(
        PlaceReview.user_id == user_id,
        PlaceReview.place_id == place_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="이미 리뷰를 작성했습니다")

    # 이미지 저장 (있으면)
    image_url = None
    if image:
        image_url = await save_image_file(image, "place_images")

    # 리뷰 생성 (DB 실패 시 이미지 롤백)
    try:
        review = PlaceReview(
            place_id=place_id,
            user_id=user_id,
            rating=rating,
            content=content,
            image_url=image_url
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
        created_at=review.created_at
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
    db: Session = Depends(get_db)
):
    """
    리뷰 수정 (이미지 파일 업로드 포함)

    - rating: 별점 (1~5)
    - content: 리뷰 내용
    - image: 이미지 파일 (선택, jpg/jpeg/png/gif, 최대 10MB)
    - remove_image: true면 기존 이미지 삭제 (새 이미지 없이 삭제만 할 때)
    """
    # 리뷰 존재 확인
    review = db.query(PlaceReview).filter(
        PlaceReview.id == review_id,
        PlaceReview.place_id == place_id
    ).first()

    if not review:
        raise HTTPException(status_code=404, detail="리뷰를 찾을 수 없습니다")

    # 본인 확인
    if review.user_id != user_id:
        raise HTTPException(status_code=403, detail="본인의 리뷰만 수정할 수 있습니다")

    # 이미지 처리 (DB 성공 후 기존 이미지 삭제하는 안전한 방식)
    old_image_url = review.image_url  # 기존 이미지 URL 저장
    new_image_url = None  # 새로 업로드한 이미지 URL
    image_url = review.image_url  # 최종 이미지 URL (기본: 기존 유지)
    should_delete_old = False  # 기존 이미지 삭제 여부

    if image:
        # 새 이미지 먼저 저장 (기존 이미지는 아직 삭제 안 함)
        new_image_url = await save_image_file(image, "place_images")
        image_url = new_image_url
        should_delete_old = bool(old_image_url)
    elif remove_image:
        # 이미지 삭제 요청
        image_url = None
        should_delete_old = bool(old_image_url)

    # 리뷰 수정 (DB 실패 시 새 이미지 롤백)
    try:
        review.rating = rating
        review.content = content
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
        created_at=review.created_at
    )


@router.delete("/{place_id}/reviews/{review_id}")
def delete_review(
    place_id: int,
    review_id: int,
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    리뷰 삭제
    """
    # 리뷰 존재 확인
    review = db.query(PlaceReview).filter(
        PlaceReview.id == review_id,
        PlaceReview.place_id == place_id
    ).first()

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


# ==================== 북마크 (찜하기) ====================

@router.post("/{place_id}/bookmark", response_model=BookmarkResponse)
def add_bookmark(
    place_id: int,
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    장소 찜하기
    """
    # 장소 존재 확인
    place = db.query(Place).filter(Place.id == place_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")

    # 중복 확인
    existing = db.query(PlaceBookmark).filter(
        PlaceBookmark.user_id == user_id,
        PlaceBookmark.place_id == place_id
    ).first()

    if existing:
        return BookmarkResponse(
            place_id=existing.place_id,
            created_at=existing.created_at
        )

    # 북마크 생성
    bookmark = PlaceBookmark(
        user_id=user_id,
        place_id=place_id
    )

    db.add(bookmark)
    db.commit()
    db.refresh(bookmark)

    return BookmarkResponse(
        place_id=bookmark.place_id,
        created_at=bookmark.created_at
    )


@router.delete("/{place_id}/bookmark")
def remove_bookmark(
    place_id: int,
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    장소 찜하기 취소
    """
    bookmark = db.query(PlaceBookmark).filter(
        PlaceBookmark.user_id == user_id,
        PlaceBookmark.place_id == place_id
    ).first()

    if not bookmark:
        raise HTTPException(status_code=404, detail="북마크를 찾을 수 없습니다")

    db.delete(bookmark)
    db.commit()

    return {"message": "북마크가 삭제되었습니다"}
