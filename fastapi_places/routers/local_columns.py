import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth import get_current_user, require_auth
from database import get_db
from models import (
    LocalBadge,
    LocalColumn,
    LocalColumnSection,
    LocalColumnSectionImage,
    Place,
    User,
)
from schemas import (
    LocalColumnListResponse,
    LocalColumnResponse,
    LocalColumnSectionImageResponse,
    LocalColumnSectionResponse,
)
from services.badges import check_local_badge_active
from services.external_places import get_or_create_place_by_api_id
from services.media_helpers import delete_image_file, save_image_file
from services.translation_helpers import translate_local_column_detail, translate_local_column_list


logger = logging.getLogger(__name__)
router = APIRouter()


# ==================== 현지인 칼럼 ====================

@router.get("/local-columns", response_model=List[LocalColumnListResponse])
async def get_local_columns(
    city: Optional[str] = Query(None, description="도시 필터"),
    query: Optional[str] = Query(None, description="검색어 (제목/내용)"),
    writer: Optional[str] = Query(None, description="작성자 필터 (예: me)"),
    lang: Optional[str] = Query(None, description="타겟 언어"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user_id_from_token: Optional[int] = Depends(get_current_user),
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
                LocalColumn.title.ilike(f"%{city}%"),
                LocalColumn.id.in_(subquery),
            )
        )

    # 2. 검색어 필터 (신규 추가) - Title or Content
    if query:
        search_filter = or_(
            LocalColumn.title.ilike(f"%{query}%"),
            LocalColumn.content.ilike(f"%{query}%"),
        )
        q = q.filter(search_filter)

    # 작성자 필터 (내 글만 보기)
    if writer == "me":
        if not user_id_from_token:
            # 인증되지 않은 사용자가 내 글 보기를 요청하면 401 에러
            raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
        q = q.filter(LocalColumn.user_id == user_id_from_token)

    # 페이징 적용
    offset = (page - 1) * limit
    columns = q.offset(offset).limit(limit).all()
    # 사용자 닉네임 및 뱃지 레벨 조회
    result = []

    # [AI 번역 준비]
    for column in columns:
        user = db.query(User).filter(User.id == column.user_id).first()
        badge = db.query(LocalBadge).filter(
            LocalBadge.user_id == column.user_id,
            LocalBadge.is_active == True,
        ).first()

        item = LocalColumnListResponse(
            id=column.id,
            user_id=column.user_id,
            user_nickname=user.nickname if user else None,
            user_level=badge.level if badge else None,
            title=column.title,
            thumbnail_url=column.thumbnail_url,
            view_count=column.view_count,
            created_at=column.created_at,
        )
        result.append(item)

    if lang:
        try:
            result = await translate_local_column_list(result, lang)
        except Exception:
            logger.exception("Local columns translation failed")

    return result


@router.get("/local-columns/{column_id}", response_model=LocalColumnResponse)
async def get_local_column_detail(
    column_id: int,
    lang: Optional[str] = Query(None, description="타겟 언어"),
    db: Session = Depends(get_db),
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
                    order=img.order,
                )
                for img in images
            ],
        ))

    # 사용자 정보 및 뱃지 레벨 조회
    user = db.query(User).filter(User.id == column.user_id).first()
    badge = db.query(LocalBadge).filter(
        LocalBadge.user_id == column.user_id,
        LocalBadge.is_active == True,
    ).first()

    # [AI 번역 적용]
    if lang:
        try:
            await translate_local_column_detail(column, section_data, lang)
        except Exception:
            import traceback
            traceback.print_exc()
            logger.exception("Local column detail translation failed")

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
        sections=section_data,
    )


@router.post("/local-columns", response_model=LocalColumnResponse)
async def create_local_column(
    # FastAPI의 Form과 File을 사용하여 각 필드를 명시적으로 선언
    title: str = Form(...),
    content: str = Form(...),
    sections: str = Form(..., alias="sections"),
    thumbnail: UploadFile = File(...),
    intro_image: Optional[UploadFile] = File(None),
    representative_place_id: Optional[int] = Form(None),
    request: Request = None, # form_data.items()를 위해 유지
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db),
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
        if key.startswith("section_") and "_image_" in key:
            # UploadFile 체크 대신 file 속성 존재 여부로 확인
            if hasattr(value, "file"):
                parts = key.replace("section_", "").split("_image_")
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
            representative_place_id=representative_place_id,
        )
        db.add(column)

        # 5. 섹션 및 이미지 객체 생성 (아직 commit 안 함)
        sections_to_commit = []
        images_to_commit = []

        for idx, section_req in enumerate(sections_data):
            # 장소 정보 처리 (place_id 또는 db_place_id 모두 지원)
            local_place_id = section_req.get("place_id") or section_req.get("db_place_id")
            if not local_place_id and section_req.get("place_api_id"):
                place_api_id = section_req.get("place_api_id")
                place_name = section_req.get("place_name")
                local_place = await get_or_create_place_by_api_id(
                    db, place_api_id=place_api_id, name_hint=place_name
                )
                if local_place:
                    local_place_id = local_place.id

            section = LocalColumnSection(
                column=column, # 관계 설정
                place_id=local_place_id,
                order=section_req.get("order", idx),
                title=section_req.get("title", ""),
                content=section_req.get("content", ""),
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
                        order=img_idx,
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

            response_sections.append(LocalColumnSectionResponse(
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
                        order=img.order,
                    )
                    for img in images_for_response
                ],
            ))
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
        sections=response_sections,
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

    for key, value in form_data.items():
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
                    except:
                        pass

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
        if thumbnail and hasattr(thumbnail, 'file') and thumbnail.filename:
            new_thumbnail_url = await save_image_file(thumbnail, "place_images")
            saved_new_images.append(new_thumbnail_url)
            if column.thumbnail_url:
                old_images_to_delete.append(column.thumbnail_url)
            column.thumbnail_url = new_thumbnail_url
        elif remove_thumbnail and column.thumbnail_url:
            old_images_to_delete.append(column.thumbnail_url)
            column.thumbnail_url = None

        # 8. 인트로 이미지 처리 (새 이미지 먼저 저장)
        if intro_image and hasattr(intro_image, 'file') and intro_image.filename:
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
    db: Session = Depends(get_db),
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

    # 칼럼 썸네일 이미지 파일 삭제
    if column.thumbnail_url:
        delete_image_file(column.thumbnail_url)

    # 칼럼 인트로 이미지 파일 삭제
    if column.intro_image_url:
        delete_image_file(column.intro_image_url)

    # 섹션 이미지 파일 삭제
    sections = db.query(LocalColumnSection).filter(LocalColumnSection.column_id == column_id).all()
    
    for section in sections:
        images = db.query(LocalColumnSectionImage).filter(
            LocalColumnSectionImage.section_id == section.id
        ).all()

        for img in images:
            delete_image_file(img.image_url)

    # 1. 섹션 이미지 DB 데이터 일괄 삭제 (서브쿼리 활용)
    db.query(LocalColumnSectionImage).filter(
        LocalColumnSectionImage.section_id.in_(
            db.query(LocalColumnSection.id).filter(LocalColumnSection.column_id == column_id)
        )
    ).delete(synchronize_session=False)

    # 2. 해당 칼럼의 모든 섹션 DB 데이터 일괄 삭제
    db.query(LocalColumnSection).filter(LocalColumnSection.column_id == column_id).delete(synchronize_session=False)

    # 칼럼 삭제
    db.delete(column)
    db.commit()

    return {"message": "칼럼이 삭제되었습니다"}
