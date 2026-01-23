import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth import require_auth
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


@router.get("/local-columns", response_model=List[LocalColumnListResponse])
async def get_local_columns(
    city: Optional[str] = Query(None, description="도시 필터"),
    query: Optional[str] = Query(None, description="검색어"),
    lang: Optional[str] = Query(None, description="타겟 언어"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    q = db.query(LocalColumn).order_by(LocalColumn.created_at.desc())

    if city:
        subquery = db.query(LocalColumnSection.column_id).join(
            Place, LocalColumnSection.place_id == Place.id
        ).filter(Place.city == city).subquery()

        q = q.filter(
            or_(
                LocalColumn.title.ilike(f"%{city}%"),
                LocalColumn.id.in_(subquery),
            )
        )

    if query:
        search_filter = or_(
            LocalColumn.title.ilike(f"%{query}%"),
            LocalColumn.content.ilike(f"%{query}%"),
        )
        q = q.filter(search_filter)

    offset = (page - 1) * limit
    columns = q.offset(offset).limit(limit).all()

    result = []
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
    column = db.query(LocalColumn).filter(LocalColumn.id == column_id).first()

    if not column:
        raise HTTPException(status_code=404, detail="칼럼을 찾을 수 없습니다")

    column.view_count += 1
    db.commit()

    sections = db.query(LocalColumnSection).filter(
        LocalColumnSection.column_id == column_id
    ).order_by(LocalColumnSection.order).all()

    section_data = []
    for section in sections:
        images = db.query(LocalColumnSectionImage).filter(
            LocalColumnSectionImage.section_id == section.id
        ).order_by(LocalColumnSectionImage.order).all()

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

    user = db.query(User).filter(User.id == column.user_id).first()
    badge = db.query(LocalBadge).filter(
        LocalBadge.user_id == column.user_id,
        LocalBadge.is_active == True,
    ).first()

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
    title: str = Form(...),
    content: str = Form(...),
    sections: str = Form(..., alias="sections"),
    thumbnail: UploadFile = File(...),
    intro_image: Optional[UploadFile] = File(None),
    representative_place_id: Optional[int] = Form(None),
    request: Request = None,
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db),
):
    check_local_badge_active(db, user_id)

    try:
        sections_data = json.loads(sections)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="sections는 유효한 JSON이어야 합니다")

    form_data = await request.form()
    section_images = {}

    print(f"[DEBUG] form_data keys: {list(form_data.keys())}")

    for key, value in form_data.items():
        print(f"[DEBUG] key: {key}, type: {type(value)}, is UploadFile: {isinstance(value, UploadFile)}")
        if key.startswith("section_") and "_image_" in key:
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

    saved_image_urls = []

    try:
        thumbnail_url = await save_image_file(thumbnail, "place_images")
        saved_image_urls.append(thumbnail_url)

        intro_image_url = None
        if intro_image:
            intro_image_url = await save_image_file(intro_image, "place_images")
            saved_image_urls.append(intro_image_url)

        column = LocalColumn(
            user_id=user_id,
            title=title,
            content=content,
            thumbnail_url=thumbnail_url,
            intro_image_url=intro_image_url,
            representative_place_id=representative_place_id,
        )
        db.add(column)

        sections_to_commit = []
        images_to_commit = []

        for idx, section_req in enumerate(sections_data):
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
                column=column,
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
                        section=section,
                        image_url=img_url,
                        order=img_idx,
                    )
                    images_to_commit.append(image)

        db.add_all(sections_to_commit)
        db.add_all(images_to_commit)
        db.commit()

        db.refresh(column)
        response_sections = []
        for section in sections_to_commit:
            db.refresh(section)
            images_for_response = [
                img for img in images_to_commit if img.section == section
            ]
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

        return LocalColumnResponse(
            id=column.id,
            user_id=column.user_id,
            user_nickname=None,
            user_level=None,
            title=column.title,
            content=column.content,
            thumbnail_url=column.thumbnail_url,
            intro_image_url=column.intro_image_url,
            representative_place_id=column.representative_place_id,
            view_count=column.view_count,
            created_at=column.created_at,
            sections=response_sections,
        )

    except Exception as e:
        for url in saved_image_urls:
            delete_image_file(url)
        raise HTTPException(status_code=500, detail=f"칼럼 저장 실패: {str(e)}")


@router.put("/local-columns/{column_id}", response_model=LocalColumnResponse)
async def update_local_column(
    column_id: int,
    title: str = Form(...),
    content: str = Form(...),
    sections: str = Form(..., alias="sections"),
    thumbnail: Optional[UploadFile] = File(None),
    intro_image: Optional[UploadFile] = File(None),
    representative_place_id: Optional[int] = Form(None),
    request: Request = None,
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db),
):
    column = db.query(LocalColumn).filter(LocalColumn.id == column_id).first()
    if not column:
        raise HTTPException(status_code=404, detail="칼럼을 찾을 수 없습니다")

    if column.user_id != user_id:
        raise HTTPException(status_code=403, detail="본인의 칼럼만 수정할 수 있습니다")

    try:
        sections_data = json.loads(sections)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="sections는 유효한 JSON이어야 합니다")

    form_data = await request.form()
    section_images = {}
    for key, value in form_data.items():
        if key.startswith("section_") and "_image_" in key:
            if hasattr(value, "file"):
                parts = key.replace("section_", "").split("_image_")
                if len(parts) == 2:
                    try:
                        section_idx = int(parts[0])
                        image_idx = int(parts[1])
                        if section_idx not in section_images:
                            section_images[section_idx] = {}
                        section_images[section_idx][image_idx] = value
                    except (ValueError, IndexError):
                        pass

    saved_image_urls = []
    old_thumbnail_url = column.thumbnail_url
    old_intro_image_url = column.intro_image_url

    try:
        if thumbnail:
            new_thumbnail_url = await save_image_file(thumbnail, "place_images")
            saved_image_urls.append(new_thumbnail_url)
            column.thumbnail_url = new_thumbnail_url
        if intro_image:
            new_intro_image_url = await save_image_file(intro_image, "place_images")
            saved_image_urls.append(new_intro_image_url)
            column.intro_image_url = new_intro_image_url

        column.title = title
        column.content = content
        column.representative_place_id = representative_place_id

        db.query(LocalColumnSectionImage).filter(
            LocalColumnSectionImage.section_id.in_(
                db.query(LocalColumnSection.id).filter(LocalColumnSection.column_id == column_id)
            )
        ).delete(synchronize_session=False)
        db.query(LocalColumnSection).filter(LocalColumnSection.column_id == column_id).delete(synchronize_session=False)

        sections_to_commit = []
        images_to_commit = []

        for idx, section_req in enumerate(sections_data):
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
                column=column,
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
                        section=section,
                        image_url=img_url,
                        order=img_idx,
                    )
                    images_to_commit.append(image)

        db.add_all(sections_to_commit)
        db.add_all(images_to_commit)
        db.commit()

        if thumbnail and old_thumbnail_url:
            delete_image_file(old_thumbnail_url)
        if intro_image and old_intro_image_url:
            delete_image_file(old_intro_image_url)

        db.refresh(column)
        response_sections = []
        for section in sections_to_commit:
            db.refresh(section)
            images_for_response = [
                img for img in images_to_commit if img.section == section
            ]
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

        return LocalColumnResponse(
            id=column.id,
            user_id=column.user_id,
            user_nickname=None,
            user_level=None,
            title=column.title,
            content=column.content,
            thumbnail_url=column.thumbnail_url,
            intro_image_url=column.intro_image_url,
            representative_place_id=column.representative_place_id,
            view_count=column.view_count,
            created_at=column.created_at,
            sections=response_sections,
        )

    except Exception as e:
        for url in saved_image_urls:
            delete_image_file(url)
        raise HTTPException(status_code=500, detail=f"칼럼 수정 실패: {str(e)}")


@router.delete("/local-columns/{column_id}")
def delete_local_column(
    column_id: int,
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db),
):
    column = db.query(LocalColumn).filter(LocalColumn.id == column_id).first()
    if not column:
        raise HTTPException(status_code=404, detail="칼럼을 찾을 수 없습니다")

    if column.user_id != user_id:
        raise HTTPException(status_code=403, detail="본인의 칼럼만 삭제할 수 있습니다")

    if column.thumbnail_url:
        delete_image_file(column.thumbnail_url)
    if column.intro_image_url:
        delete_image_file(column.intro_image_url)

    sections = db.query(LocalColumnSection).filter(LocalColumnSection.column_id == column_id).all()
    for section in sections:
        images = db.query(LocalColumnSectionImage).filter(
            LocalColumnSectionImage.section_id == section.id
        ).all()
        for img in images:
            delete_image_file(img.image_url)

    db.query(LocalColumnSectionImage).filter(
        LocalColumnSectionImage.section_id.in_(
            db.query(LocalColumnSection.id).filter(LocalColumnSection.column_id == column_id)
        )
    ).delete(synchronize_session=False)

    db.query(LocalColumnSection).filter(LocalColumnSection.column_id == column_id).delete(synchronize_session=False)

    db.delete(column)
    db.commit()

    return {"message": "칼럼이 삭제되었습니다"}
