"""
Places API Router
장소 검색, 리뷰, 현지인 인증, 칼럼 관련 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import date, datetime, timedelta
import os
import uuid
import json
import zlib
from pathlib import Path

from models import (
    Place, PlaceReview, PlaceBookmark, LocalBadge,
    LocalColumn, LocalColumnSection, LocalColumnSectionImage, User,
    Shortform, TravelPlan, PlanDetail
)
from schemas import (
    PlaceSearchRequest, PlaceSearchResult, PlaceAutocompleteRequest,
    PlaceAutocompleteSuggestion, PlaceDetailResponse, PlaceCreateRequest,
    ReviewCreateRequest, ReviewResponse, BookmarkResponse, LocalBadgeAuthRequest,
    LocalBadgeAuthResponse, LocalBadgeStatusResponse, LocalColumnCreateRequest,
    LocalColumnResponse, LocalColumnListResponse, CityContentResponse, PopularCityResponse,
    LocalColumnSectionResponse, LocalColumnSectionImageResponse,
    ShortformListResponse, TravelPlanListResponse
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
from translation_client import translate_batch_proxy, translate_texts, detect_source_language



router = APIRouter(prefix="/places", tags=["Places"])


# ==================== S3/로컬 하이브리드 이미지 헬퍼 ====================

def _get_s3_client():
    """
    S3 클라이언트 반환. AWS 자격증명이 없으면 (None, None) 반환.
    Django settings.py와 동일한 환경변수 사용.
    """
    import boto3

    aws_access_key = os.environ.get('AWS_ACCESS_KEY_ID')
    aws_secret_key = os.environ.get('AWS_SECRET_ACCESS_KEY')
    bucket_name = os.environ.get('AWS_STORAGE_BUCKET_NAME')

    if not all([aws_access_key, aws_secret_key, bucket_name]):
        return None, None

    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
            region_name=os.environ.get('AWS_S3_REGION_NAME', 'ap-northeast-2')
        )
        return s3_client, bucket_name
    except Exception as e:
        print(f"S3 클라이언트 생성 실패: {e}")
        return None, None


def _get_s3_url(bucket_name: str, key: str) -> str:
    """S3 객체의 공개 URL 생성"""
    region = os.environ.get('AWS_S3_REGION_NAME', 'ap-northeast-2')
    return f"https://{bucket_name}.s3.{region}.amazonaws.com/{key}"


def _is_s3_url(url: str) -> bool:
    """URL이 S3 URL인지 확인"""
    return url and ('.s3.' in url and '.amazonaws.com' in url)


def delete_image_file(image_url: str) -> bool:
    """
    이미지 파일 삭제 (S3 또는 로컬)

    Args:
        image_url: 이미지 URL

    Returns:
        삭제 성공 여부
    """
    if not image_url:
        return False

    try:
        # S3 URL인 경우
        if _is_s3_url(image_url):
            s3_client, bucket_name = _get_s3_client()
            if s3_client:
                # URL에서 key 추출: https://bucket.s3.region.amazonaws.com/media/xxx.jpg -> media/xxx.jpg
                key = image_url.split('.amazonaws.com/')[-1]
                s3_client.delete_object(Bucket=bucket_name, Key=key)
                return True

        # 로컬 파일인 경우
        elif "/media/" in image_url:
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
    이미지 파일을 저장하고 URL 반환 (S3 또는 로컬)

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

    # 4. 파일 내용 읽기
    content = await image.read()

    # 5. S3 또는 로컬 저장
    s3_client, bucket_name = _get_s3_client()

    if s3_client:
        # S3 모드
        try:
            s3_key = f"media/{subfolder}/{unique_filename}"
            s3_client.put_object(
                Bucket=bucket_name,
                Key=s3_key,
                Body=content,
                ContentType=image.content_type or 'image/jpeg'
            )
            return _get_s3_url(bucket_name, s3_key)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"S3 업로드 실패: {str(e)}")
    else:
        # 로컬 모드
        try:
            media_dir = Path(f"/app/django_app/media/{subfolder}")
            media_dir.mkdir(parents=True, exist_ok=True)

            file_path = media_dir / unique_filename
            with open(file_path, "wb") as f:
                f.write(content)

            # 로컬 URL 반환 (Nginx 프록시 경로 사용)
            return f"/media/{subfolder}/{unique_filename}"
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"파일 저장 실패: {str(e)}")


# ==================== 장소 검색 ====================

@router.get("/search")
async def search_places(
    query: str = Query(..., min_length=1, description="검색어"),
    category: Optional[str] = Query(None, description="카테고리 필터"),
    city: Optional[str] = Query(None, description="도시 필터"),
    lang: Optional[str] = Query(None, description="타겟 언어 (예: eng_Latn)"),
    db: Session = Depends(get_db)
):

    
    all_results = await search_places_hybrid(query, category, city, db=db)

    # [AI 번역 적용]
    if lang:
        try:
            items_to_translate = []
            
            # 각 결과에서 번역할 필드 수집
            for res in all_results:
                # ID가 없으면(검색 결과 등) 텍스트 해시를 ID로 사용
                entity_id_name = res.get("id") or (zlib.adler32(res.get("name", "").encode('utf-8')) & 0xffffffff)
                
                # Name
                items_to_translate.append({
                    "text": res.get("name", ""),
                    "entity_type": "place_name" if res.get("id") else "raw",
                    "entity_id": entity_id_name,
                    "field": "name"
                })
                # Address
                items_to_translate.append({
                    "text": res.get("address", ""),
                    "entity_type": "place_address" if res.get("id") else "raw",
                    "entity_id": entity_id_name, # 같은 엔티티 ID 공유 (필드가 다름)
                    "field": "address"
                })
                # Category
                items_to_translate.append({
                    "text": res.get("category_main", ""),
                    "entity_type": "place_category" if res.get("id") else "raw",
                    "entity_id": entity_id_name,
                    "field": "category_main"
                })

            # [FIX] Transient Cache Collision Issue
            # DB에 없는 장소는 ID가 없어서 entity_id=0으로 중복되어 캐시 충돌 발생
            # 해결: 텍스트의 해시값을 임시 ID로 사용
            
            print(f"DEBUG: Lang={lang}, Items to translate: {len(items_to_translate)}", flush=True)
            
            if items_to_translate:
                translated_map = await translate_batch_proxy(items_to_translate, lang)
                print(f"DEBUG: Translated Map Size: {len(translated_map)}", flush=True)
                

                
                # 결과에 적용 (순서대로 3개씩 매칭)
                current_idx = 0
                for res in all_results:
                    if current_idx in translated_map:
                        res["name_translated"] = translated_map[current_idx]
                    current_idx += 1
                    
                    if current_idx in translated_map:
                        res["address_translated"] = translated_map[current_idx]
                    current_idx += 1
                    
                    if current_idx in translated_map:
                        res["category_main_translated"] = translated_map[current_idx]
                    current_idx += 1
                    
        except Exception as e:
            print(f"Translation failed: {e}")
            import traceback
            traceback.print_exc()

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
    lang: Optional[str] = Query(None, description="타겟 언어"),
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
    result_data = {
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

    # [AI 번역 적용]
    if lang:
        try:
            items_to_translate = [
                {"text": result_data["name"], "entity_type": "place", "entity_id": place.id, "field": "name"},
                {"text": result_data["address"], "entity_type": "place", "entity_id": place.id, "field": "address"},
                {"text": result_data["category_main"], "entity_type": "place", "entity_id": place.id, "field": "category_main"},
                {"text": result_data["city"], "entity_type": "place", "entity_id": place.id, "field": "city"},
            ]
            
            # opening_hours (list of strings) 처리
            category_detail = result_data.get("category_detail") or []
            category_detail_start = len(items_to_translate)
            for idx, cat in enumerate(category_detail):
                items_to_translate.append(
                    {"text": cat, "entity_type": "place_category", "entity_id": place.id, "field": f"category_detail_{idx}"}
                )

            opening_base_idx = len(items_to_translate)
            for oh in opening_hours:
                items_to_translate.append({"text": oh, "entity_type": "place_opening_hours", "entity_id": place.id, "field": "opening_hours"})
                
            translated_map = await translate_batch_proxy(items_to_translate, lang)
            
            # 기본 필드 적용
            if 0 in translated_map: result_data["name"] = translated_map[0]
            if 1 in translated_map: result_data["address"] = translated_map[1]
            if 2 in translated_map: result_data["category_main"] = translated_map[2]
            if 3 in translated_map: result_data["city"] = translated_map[3]
            if category_detail:
                translated_details = []
                for i in range(len(category_detail)):
                    idx = category_detail_start + i
                    translated_details.append(translated_map.get(idx, category_detail[i]))
                result_data["category_detail_translated"] = translated_details

            
            # 영업시간 적용
            new_opening_hours = []
            for i in range(len(opening_hours)):
                idx = opening_base_idx + i
                if idx in translated_map:
                    new_opening_hours.append(translated_map[idx])
                else:
                    new_opening_hours.append(opening_hours[i])
            
            if new_opening_hours:
                result_data["opening_hours"] = new_opening_hours
                
        except Exception as e:
            print(f"Detail translation failed: {e}")

    return result_data


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
    # [TEMPORARY TEST MODE] 모든 사용자에게 Level 5 권한 부여 (테스트용)
    # 번역 기능 테스트 종료 후 반드시 삭제/원복 필요
    return LocalBadgeStatusResponse(
        level=5,
        city="테스트 권한",
        is_active=True,
        first_authenticated_at=date.today(),
        last_authenticated_at=date.today(),
        next_authentication_due=date.today() + timedelta(days=365),
        maintenance_months=12,
        authentication_count=999
    )

    # [ORIGINAL CODE - COMMENTED OUT FOR TESTING]
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
        authentication_count=0
    )
    """


# ==================== 현지인 칼럼 ====================

@router.get("/local-columns", response_model=List[LocalColumnListResponse])
async def get_local_columns(
    city: Optional[str] = Query(None, description="도시 필터"),
    query: Optional[str] = Query(None, description="검색어 (제목/내용)"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    lang: Optional[str] = Query(None, description="타겟 언어"),
    db: Session = Depends(get_db)
):
    """
    현지인 칼럼 목록 조회
    """
    # 기본 쿼리: 최신순 정렬
    q = db.query(LocalColumn).order_by(LocalColumn.created_at.desc())

    # 1. 도시 필터 (기존 로직) -> JOIN 필요
    # (섹션 장소의 도시가 일치하거나 OR 제목에 도시명 포함 - 단순화하여 제목/내용 검색은 별도 query로 처리)
    # 기획상 "도시별 보기"는 보통 별도 진입점이므로, 여기서는 단순 칼럼 목록에서의 필터링으로 가정
    if city:
        # 도시 필터가 있으면 해당 도시와 관련된 칼럼만 (단순화를 위해 제목/내용/장소 연관보다는 명시적 필터링 권장되나,
        # 기존 로직이 없다면 제목 매칭 정도가 가벼움. 여기서는 확장성을 위해 JOIN 사용)
        
        # 섹션에 연결된 장소가 해당 도시인 경우
        subquery = db.query(LocalColumnSection.column_id).join(
            Place, LocalColumnSection.place_id == Place.id
        ).filter(Place.city == city).subquery()

        q = q.filter(
            or_(
                LocalColumn.title.ilike(f'%{city}%'),
                LocalColumn.id.in_(subquery)
            )
        )

    # 2. 검색어 필터 (신규 추가) - Title or Content
    if query:
        search_filter = or_(
            LocalColumn.title.ilike(f"%{query}%"),
            LocalColumn.content.ilike(f"%{query}%")
        )
        q = q.filter(search_filter)

    # 페이징 적용
    offset = (page - 1) * limit
    columns = q.offset(offset).limit(limit).all()
    # 사용자 닉네임 및 뱃지 레벨 조회
    result = []
    
    # [AI 번역 준비]
    items_to_translate = []
    
    for column in columns:
        user = db.query(User).filter(User.id == column.user_id).first()
        badge = db.query(LocalBadge).filter(
            LocalBadge.user_id == column.user_id,
            LocalBadge.is_active == True
        ).first()
        
        item = LocalColumnListResponse(
            id=column.id,
            user_id=column.user_id,
            user_nickname=user.nickname if user else None,
            user_level=badge.level if badge else None,
            title=column.title,
            thumbnail_url=column.thumbnail_url,
            view_count=column.view_count,
            created_at=column.created_at
        )
        result.append(item)
        
        # 번역 대상 수집
        if lang:
             items_to_translate.append({
                "text": column.title,
                "entity_type": "local_column",
                "entity_id": column.id,
                "field": "title"
            })

    # [AI 번역 적용]
    if lang and items_to_translate:
        try:
            translated_map = await translate_batch_proxy(items_to_translate, lang)
            # 순서대로 매핑 (LocalColumnListResponse 객체의 title 수정)
            for idx, item in enumerate(result):
                if idx in translated_map:
                    item.title = translated_map[idx]
        except Exception as e:
            print(f"Local columns translation failed: {e}")

    return result


@router.get("/local-columns/{column_id}", response_model=LocalColumnResponse)
async def get_local_column_detail(
    column_id: int,
    lang: Optional[str] = Query(None, description="타겟 언어"),
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

    # [AI 번역 적용]
    if lang:
        try:
            items_to_translate = []
            
            # 1. Main Column Info (Title, Content)
            items_to_translate.append({"text": column.title, "entity_type": "local_column", "entity_id": column.id, "field": "title"})
            items_to_translate.append({"text": column.content, "entity_type": "local_column", "entity_id": column.id, "field": "content"})
            
            # 2. Sections Info (Title, Content)
            # Keep track of indices
            section_indices = []
            for sec in section_data:
                # Section Title
                items_to_translate.append({"text": sec.title, "entity_type": "local_column_section", "entity_id": sec.id, "field": "title"})
                # Section Content
                items_to_translate.append({"text": sec.content, "entity_type": "local_column_section", "entity_id": sec.id, "field": "content"})
            
            # 3. Translate
            print(f"[DEBUG] items_to_translate ({len(items_to_translate)}): {items_to_translate}")
            translated_map = await translate_batch_proxy(items_to_translate, lang)
            print(f"[DEBUG] translated_map: {translated_map}")
            
            # 4. Apply Translations
            # Main Info
            if 0 in translated_map: column.title = translated_map[0]
            if 1 in translated_map: column.content = translated_map[1]
            
            # Sections
            # 0, 1 are used. Sections start from 2.
            # Each section uses 2 indices (title, content).
            current_idx = 2
            for sec in section_data:
                if current_idx in translated_map: sec.title = translated_map[current_idx]
                current_idx += 1
                
                if current_idx in translated_map: sec.content = translated_map[current_idx]
                current_idx += 1

        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Local column detail translation failed: {e}")

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

# City Name Mapping
CITY_NAMES = {
    "서울": {"en": "Seoul", "jp": "ソウル", "zh": "首尔"},
    "부산": {"en": "Busan", "jp": "釜山", "zh": "釜山"},
    "제주": {"en": "Jeju", "jp": "済州", "zh": "济州"},
    "대전": {"en": "Daejeon", "jp": "大田", "zh": "大田"},
    "대구": {"en": "Daegu", "jp": "大邱", "zh": "大邱"},
    "인천": {"en": "Incheon", "jp": "仁川", "zh": "仁川"},
    "광주": {"en": "Gwangju", "jp": "光州", "zh": "光州"},
    "수원": {"en": "Suwon", "jp": "水原", "zh": "水原"},
    "전주": {"en": "Jeonju", "jp": "全州", "zh": "全州"},
    "경주": {"en": "Gyeongju", "jp": "慶州", "zh": "庆州"},
}

@router.get("/destinations/popular", response_model=List[PopularCityResponse])
def get_popular_cities(target_lang: str = Query("ko", description="Target language code (ko, en, jp, zh)")):
    """
    인기 도시 목록
    - target_lang에 따라 도시 설명을 번역된 텍스트로 반환
    """
    
    # Normalize language code
    lang_map = {'ja': 'jp', 'zh-CN': 'zh', 'zh-TW': 'zh'}
    search_lang = lang_map.get(target_lang, target_lang)
    
    # 다국어 설명 데이터
    descriptions = {
        "서울": {
            "ko": "대한민국의 수도, 현대와 전통이 공존하는 도시",
            "en": "Capital of South Korea, where modernity meets tradition",
            "jp": "現代と伝統が共存する韓国の首都",
            "zh": "韩国首都，传统与现代共存的城市"
        },
        "부산": {
            "ko": "해운대와 광안리로 유명한 항구 도시",
            "en": "Port city famous for Haeundae and Gwangalli beaches",
            "jp": "海雲台と広安里で有名な港町",
            "zh": "以海云台和广安里闻名的港口城市"
        },
        "제주": {
            "ko": "아름다운 자연과 독특한 문화를 가진 섬",
            "en": "Island with beautiful nature and unique culture",
            "jp": "美しい自然と独自の文化を持つ島",
            "zh": "拥有美丽自然和独特文化的岛屿"
        },
        "대전": {
            "ko": "과학과 교육의 도시",
            "en": "City of science and education",
            "jp": "科学と教育の都市",
            "zh": "科学与教育之城"
        },
        "대구": {
            "ko": "섬유와 패션의 도시",
            "en": "City of textile and fashion",
            "jp": "繊維とファッションの都市",
            "zh": "纺织与时尚之城"
        },
        "인천": {
            "ko": "국제공항과 차이나타운이 있는 관문 도시",
            "en": "Gateway city with International Airport and Chinatown",
            "jp": "国際空港とチャイナタウンがある玄関口の都市",
            "zh": "拥有国际机场和唐人街的门户城市"
        },
        "광주": {
            "ko": "예술과 문화의 도시",
            "en": "City of art and culture",
            "jp": "芸術と文化の都市",
            "zh": "艺术与文化之城"
        },
        "수원": {
            "ko": "화성과 전통시장으로 유명한 역사 도시",
            "en": "Historical city famous for Hwaseong Fortress",
            "jp": "華城と伝統市場で有名な歴史都市",
            "zh": "以华城和传统市场闻名的历史名城"
        },
        "전주": {
            "ko": "한옥마을과 비빔밥의 고장",
            "en": "Home of Hanok Village and Bibimbap",
            "jp": "韓屋村とビビンバの本場",
            "zh": "韩屋村和拌饭的故乡"
        },
        "경주": {
            "ko": "신라 천년의 역사가 살아있는 도시",
            "en": "City where 1,000 years of Silla history lives",
            "jp": "新羅千年の歴史が息づく都市",
            "zh": "拥有新罗千年历史的城市"
        }
    }

    # 기본 리스트 (메타데이터용)
    city_list = [
        "서울", "부산", "제주", "대전", "대구", "인천", "광주", "수원", "전주", "경주"
    ]

    result = []
    for city_name in city_list:
        desc_dict = descriptions.get(city_name, {})
        # 요청된 언어가 없으면 영어 -> 한국어 순으로 폴백
        desc = desc_dict.get(search_lang) or desc_dict.get("en") or desc_dict.get("ko")
        
        # 도시 이름 번역
        display_name = CITY_NAMES.get(city_name, {}).get(search_lang, city_name)

        result.append(PopularCityResponse(
            city_name=city_name,
            display_name=display_name,
            description=desc
        ))

    return result


@router.get("/destinations/{city_name}", response_model=CityContentResponse)
async def get_city_content(
    city_name: str,
    target_lang: str = Query("ko", description="Target language code (ko, en, jp, zh)"),
    db: Session = Depends(get_db)
):
    """
    도시별 통합 콘텐츠 조회
    - DB 우선 조회 후, 15개 미만이면 카카오 API로 보충
    """
    from sqlalchemy import or_, distinct

    # 1. DB에서 먼저 조회 (최대 15개)
    db_places = db.query(Place).filter(Place.city == city_name).limit(15).all()

    # 2. 15개 미만이면 카카오 API로 보충 (카테고리별 병렬 검색)
    places = list(db_places)
    if len(places) < 15:
        import asyncio
        from types import SimpleNamespace
        from datetime import datetime

        remaining = 15 - len(places)
        # 기존 place_api_id 목록 (중복 방지용)
        existing_api_ids = {p.place_api_id for p in places if p.place_api_id}

        # 카테고리별 병렬 검색 (맛집 5개 + 관광지 5개 + 카페 5개)
        per_category = min(5, (remaining // 3) + 2)  # 카테고리당 개수
        kakao_results_list = await asyncio.gather(
            search_kakao_places(f"{city_name} 맛집", limit=per_category),
            search_kakao_places(f"{city_name} 관광지", limit=per_category),
            search_kakao_places(f"{city_name} 카페", limit=per_category)
        )

        # 결과 합치기
        all_kakao_results = []
        for results in kakao_results_list:
            all_kakao_results.extend(results)

        for kakao_place in all_kakao_results:
            if len(places) >= 15:
                break
            # 중복 체크
            if kakao_place.get("place_api_id") in existing_api_ids:
                continue

            # 카카오 결과를 Place-like 객체로 변환
            place_obj = SimpleNamespace(
                id=None,
                provider=kakao_place.get("provider", "KAKAO"),
                place_api_id=kakao_place.get("place_api_id"),
                name=kakao_place.get("name"),
                address=kakao_place.get("address"),
                city=kakao_place.get("city"),
                latitude=kakao_place.get("latitude"),
                longitude=kakao_place.get("longitude"),
                category_main=kakao_place.get("category_main"),
                category_detail=kakao_place.get("category_detail", []),
                thumbnail_urls=[],
                average_rating=None,
                review_count=0,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                phone="",
                place_url="",
                opening_hours=[]
            )
            places.append(place_obj)
            existing_api_ids.add(kakao_place.get("place_api_id"))

    # 현지인 칼럼 15개 (제목에 도시명 포함 OR 섹션의 장소가 해당 도시)
    # 1. 제목에 도시명이 포함된 칼럼
    title_match = LocalColumn.title.ilike(f'%{city_name}%')

    # 2. 섹션에 연결된 장소가 해당 도시인 칼럼
    section_place_subquery = db.query(LocalColumnSection.column_id).join(
        Place, LocalColumnSection.place_id == Place.id
    ).filter(Place.city == city_name).distinct().subquery()

    columns = db.query(LocalColumn).filter(
        or_(
            title_match,
            LocalColumn.id.in_(section_place_subquery)
        )
    ).distinct().limit(15).all()

    # 칼럼 데이터 변환
    column_data = []
    for column in columns:
        user = db.query(User).filter(User.id == column.user_id).first()
        badge = db.query(LocalBadge).filter(
            LocalBadge.user_id == column.user_id,
            LocalBadge.is_active == True
        ).first()
        column_data.append(LocalColumnListResponse(
            id=column.id,
            user_id=column.user_id,
            user_nickname=user.nickname if user else None,
            user_level=badge.level if badge else None,
            title=column.title,
            thumbnail_url=column.thumbnail_url,
            view_count=column.view_count,
            created_at=column.created_at
        ))

    # 숏폼 10개 (제목 또는 location에 도시명 포함 + PUBLIC만)
    shortforms = db.query(Shortform).filter(
        Shortform.visibility == 'PUBLIC',
        or_(
            Shortform.title.ilike(f'%{city_name}%'),
            Shortform.location.ilike(f'%{city_name}%')
        )
    ).order_by(Shortform.created_at.desc()).limit(15).all()

    # 숏폼 데이터 변환
    shortform_data = []
    for sf in shortforms:
        user = db.query(User).filter(User.id == sf.user_id).first()
        shortform_data.append(ShortformListResponse(
            id=sf.id,
            user_id=sf.user_id,
            user_nickname=user.nickname if user else None,
            title=sf.title,
            content=sf.content,
            thumbnail_url=sf.thumbnail_url,
            video_url=sf.video_url,
            location=sf.location,
            duration=sf.duration,
            source_lang=sf.source_lang,
            total_likes=sf.total_likes,
            total_views=sf.total_views,
            created_at=sf.created_at
        ))

    # 여행일정 15개 (is_public=True AND (title OR description OR plan_details->place->city))
    # 1. 제목에 도시명 포함
    plan_title_match = TravelPlan.title.ilike(f'%{city_name}%')
    # 2. 설명에 도시명 포함
    plan_desc_match = TravelPlan.description.ilike(f'%{city_name}%')
    # 3. 일정 상세의 장소가 해당 도시인 경우
    plan_place_subquery = db.query(PlanDetail.plan_id).join(
        Place, PlanDetail.place_id == Place.id
    ).filter(Place.city == city_name).distinct().subquery()

    travel_plans = db.query(TravelPlan).filter(
        TravelPlan.is_public == True,
        or_(
            plan_title_match,
            plan_desc_match,
            TravelPlan.id.in_(plan_place_subquery)
        )
    ).order_by(TravelPlan.created_at.desc()).limit(15).all()

    # 여행일정 데이터 변환
    travel_plan_data = []
    for plan in travel_plans:
        user = db.query(User).filter(User.id == plan.user_id).first()
        travel_plan_data.append(TravelPlanListResponse(
            id=plan.id,
            user_id=plan.user_id,
            user_nickname=user.nickname if user else None,
            title=plan.title,
            description=plan.description,
            start_date=plan.start_date,
            end_date=plan.end_date,
            is_public=plan.is_public,
            created_at=plan.created_at
        ))

    # places 변환 (DB 객체 + 카카오 API 결과 혼합)
    place_responses = []
    for p in places:
        if hasattr(p, '__table__'):  # SQLAlchemy 모델인 경우
            place_responses.append(PlaceDetailResponse.from_orm(p))
        else:  # SimpleNamespace (카카오 API 결과)
            place_responses.append(PlaceDetailResponse(
                id=p.id or 0,
                provider=p.provider,
                place_api_id=p.place_api_id,
                name=p.name,
                address=p.address,
                city=p.city,
                latitude=p.latitude,
                longitude=p.longitude,
                category_main=p.category_main,
                category_detail=p.category_detail,
                thumbnail_urls=p.thumbnail_urls,
                average_rating=p.average_rating,
                review_count=p.review_count,
                created_at=p.created_at,
                updated_at=p.updated_at,
                phone=p.phone,
                place_url=p.place_url,
                opening_hours=p.opening_hours
            ))

    # ==================== Batch Translation (Deep Translation) ====================
    # 번역된 도시 이름
    lang_map = {'ja': 'jp', 'zh-CN': 'zh', 'zh-TW': 'zh'}
    lookup_lang = lang_map.get(target_lang, target_lang)
    display_name = CITY_NAMES.get(city_name, {}).get(lookup_lang, city_name)

    # 한국어가 아닐 경우에만 일괄 번역 수행
    if target_lang != "ko":
        texts_to_translate = []
        # Index tracking
        tp_indices = [] # (plan_index, field ('title'|'desc'))
        pl_indices = [] # (place_index, field ('name'|'addr'|'cat'))
        sf_indices = [] # (sf_index, field ('title'))
        col_indices = [] # (col_index, field ('title'))
        
        current_text_idx = 0

        # 1. Travel Plans (title, description)
        for i, plan in enumerate(travel_plan_data):
            if plan.title: 
                texts_to_translate.append(plan.title)
                tp_indices.append((i, 'title'))
            if plan.description:
                texts_to_translate.append(plan.description)
                tp_indices.append((i, 'desc'))
            
        # 2. Places (name, address, category)
        for i, place in enumerate(place_responses):
            if place.name:
                texts_to_translate.append(place.name)
                pl_indices.append((i, 'name'))
            if place.address:
                texts_to_translate.append(place.address)
                pl_indices.append((i, 'addr'))
            if place.category_main:
                texts_to_translate.append(place.category_main)
                pl_indices.append((i, 'cat'))
            
        # 3. Shortforms (title)
        for i, sf in enumerate(shortform_data):
            if sf.title:
                texts_to_translate.append(sf.title)
                sf_indices.append((i, 'title'))
            if sf.content:
                texts_to_translate.append(sf.content)
                sf_indices.append((i, 'content'))
            
        # 4. Local Columns (title)
        for i, col in enumerate(column_data):
            if col.title:
                texts_to_translate.append(col.title)
                col_indices.append((i, 'title'))

        if texts_to_translate:
            # 배치 번역 요청
            try:
                translated_texts = await translate_texts(texts_to_translate, target_lang)
                
                # 결과 적용
                result_idx = 0
                
                # 1. Travel Plans
                for idx, field in tp_indices:
                    if field == 'title': travel_plan_data[idx].title = translated_texts[result_idx]
                    elif field == 'desc': travel_plan_data[idx].description = translated_texts[result_idx]
                    result_idx += 1
                    
                # 2. Places
                for idx, field in pl_indices:
                    if field == 'name': place_responses[idx].name = translated_texts[result_idx]
                    elif field == 'addr': place_responses[idx].address = translated_texts[result_idx]
                    elif field == 'cat': place_responses[idx].category_main = translated_texts[result_idx]
                    result_idx += 1
                    
                # 3. Shortforms
                for idx, field in sf_indices:
                    if field == 'title': shortform_data[idx].title = translated_texts[result_idx]
                    elif field == 'content': shortform_data[idx].content = translated_texts[result_idx]
                    result_idx += 1
                    
                # 4. Local Columns
                for idx, field in col_indices:
                    if field == 'title': column_data[idx].title = translated_texts[result_idx]
                    result_idx += 1
                    
            except Exception as e:
                print(f"Deep translation failed: {str(e)}")
                # 번역 실패 시 원본 그대로 리턴 (Silent Fallback)

    return CityContentResponse(
        places=place_responses,
        local_columns=column_data,
        shortforms=shortform_data,
        travel_plans=travel_plan_data,
        display_name=display_name
    )


# ==================== 장소 상세 (DB ID 기반) ====================
# 주의: /{place_id} 패턴은 다른 모든 라우트보다 뒤에 위치해야 함
# 그렇지 않으면 /local-columns, /local-badge 등이 place_id로 해석됨

@router.get("/{place_id}")
async def get_place_detail_by_db_id(
    place_id: int,
    lang: Optional[str] = Query(None, description="타겟 언어"),
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
    result_data = {
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

    # [AI 번역 적용]
    if lang:
        try:
            items_to_translate = [
                {"text": result_data["name"], "entity_type": "place_name", "entity_id": place.id, "field": "name"},
                {"text": result_data["address"], "entity_type": "place_address", "entity_id": place.id, "field": "address"},
                {"text": result_data["category_main"], "entity_type": "place_category", "entity_id": place.id, "field": "category_main"},
            ]
            
            # opening_hours (list of strings) 번역 추가
            category_detail = result_data.get("category_detail") or []
            category_detail_start = len(items_to_translate)
            for idx, cat in enumerate(category_detail):
                items_to_translate.append(
                    {"text": cat, "entity_type": "place_category", "entity_id": place.id, "field": f"category_detail_{idx}"}
                )

            opening_idx_start = len(items_to_translate)
            for oh in opening_hours:
                items_to_translate.append({"text": oh, "entity_type": "place_hours", "entity_id": place.id, "field": "opening_hours"})

            translated_map = await translate_batch_proxy(items_to_translate, lang)
            
            # 기본 필드 적용
            if 0 in translated_map: result_data["name"] = translated_map[0]
            if 1 in translated_map: result_data["address"] = translated_map[1]
            if 2 in translated_map: result_data["category_main"] = translated_map[2]
            if category_detail:
                translated_details = []
                for i in range(len(category_detail)):
                    idx = category_detail_start + i
                    translated_details.append(translated_map.get(idx, category_detail[i]))
                result_data["category_detail_translated"] = translated_details

            
            # 영업시간 적용
            new_opening_hours = []
            for i in range(len(opening_hours)):
                idx = opening_idx_start + i
                if idx in translated_map:
                    new_opening_hours.append(translated_map[idx])
                else:
                    new_opening_hours.append(opening_hours[i])
            
            if new_opening_hours:
                result_data["opening_hours"] = new_opening_hours

        except Exception as e:
            print(f"Detail translation failed: {e}")

    return result_data


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
async def get_place_reviews(
    place_id: int,
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(20, ge=1, le=100, description="페이지당 개수"),
    order_by: str = Query("latest", description="정렬: latest(최신순), rating_desc(별점높은순), rating_asc(별점낮은순)"),
    has_image: bool = Query(False, description="이미지 첨부 리뷰만 보기"),
    lang: Optional[str] = Query(None, description="타겟 언어"),
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
        review_dict = {
            "id": review.id,
            "place_id": review.place_id,
            "user_id": review.user_id,
            "user_nickname": user.nickname if user else None,
            "rating": review.rating,
            "content": review.content,
            "image_url": review.image_url,
            "created_at": review.created_at
        }
        review_data.append(review_dict)

    # [AI 번역 적용]
    if lang and review_data:
        try:
            items_to_translate = []
            for idx, review in enumerate(review_data):
                items_to_translate.append({
                    "text": review["content"],
                    "entity_type": "review",
                    "entity_id": review["id"],
                    "field": "content"
                })
            
            translated_map = await translate_batch_proxy(items_to_translate, lang)
            
            for idx, review in enumerate(review_data):
                if idx in translated_map:
                    review["content_translated"] = translated_map[idx]
        except Exception as e:
            print(f"Review translation failed: {e}")

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

    # 리뷰 내용의 언어 감지
    detected_lang = detect_source_language(content)

    # 리뷰 생성 (DB 실패 시 이미지 롤백)
    try:
        review = PlaceReview(
            place_id=place_id,
            user_id=user_id,
            rating=rating,
            content=content,
            source_lang=detected_lang,
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

    # 리뷰 내용의 언어 감지
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
