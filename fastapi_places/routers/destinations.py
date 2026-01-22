import asyncio
import logging
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from models import (
    LocalBadge,
    LocalColumn,
    LocalColumnSection,
    Place,
    PlanDetail,
    Shortform,
    TravelPlan,
    User,
)
from schemas import (
    CityContentResponse,
    LocalColumnListResponse,
    PlaceDetailResponse,
    PopularCityResponse,
    ShortformListResponse,
    TravelPlanListResponse,
)
from services.external_places import search_kakao_places
from services.translation_helpers import translate_city_content


logger = logging.getLogger(__name__)
router = APIRouter()


CITY_NAMES = {
    "서울": {"en": "Seoul", "jp": "ソウル", "zh": "首尔"},
    "부산": {"en": "Busan", "jp": "プサン", "zh": "釜山"},
    "제주": {"en": "Jeju", "jp": "チェジュ", "zh": "济州"},
    "대전": {"en": "Daejeon", "jp": "テジョン", "zh": "大田"},
    "대구": {"en": "Daegu", "jp": "テグ", "zh": "大邱"},
    "인천": {"en": "Incheon", "jp": "インチョン", "zh": "仁川"},
    "광주": {"en": "Gwangju", "jp": "クァンジュ", "zh": "光州"},
    "수원": {"en": "Suwon", "jp": "スウォン", "zh": "水原"},
    "전주": {"en": "Jeonju", "jp": "チョンジュ", "zh": "全州"},
    "경주": {"en": "Gyeongju", "jp": "キョンジュ", "zh": "庆州"},
}


@router.get("/destinations/popular", response_model=List[PopularCityResponse])
def get_popular_cities(
    target_lang: str = Query("ko", description="Target language code (ko, en, jp, zh)"),
):
    lang_map = {"ja": "jp", "zh-CN": "zh", "zh-TW": "zh"}
    search_lang = lang_map.get(target_lang, target_lang)

    descriptions = {
        "서울": {
            "ko": "현대와 전통이 공존하는 대한민국의 수도",
            "en": "Capital of South Korea, where modernity meets tradition",
            "jp": "現代と伝統が共存する韓国の首都",
            "zh": "现代与传统并存的韩国首都",
        },
        "부산": {
            "ko": "해운대와 광안리로 유명한 항구 도시",
            "en": "Port city famous for Haeundae and Gwangalli beaches",
            "jp": "海雲台や広安里で有名な港町",
            "zh": "以海云台和广安里闻名的港口城市",
        },
        "제주": {
            "ko": "아름다운 자연과 독특한 문화의 섬",
            "en": "Island with beautiful nature and unique culture",
            "jp": "美しい自然と独特な文化の島",
            "zh": "拥有美丽自然与独特文化的岛屿",
        },
        "대전": {
            "ko": "과학과 교육의 도시",
            "en": "City of science and education",
            "jp": "科学と教育の都市",
            "zh": "科学与教育之城",
        },
        "대구": {
            "ko": "섬유와 패션의 도시",
            "en": "City of textile and fashion",
            "jp": "繊維とファッションの都市",
            "zh": "纺织与时尚之城",
        },
        "인천": {
            "ko": "국제공항과 차이나타운이 있는 관문 도시",
            "en": "Gateway city with International Airport and Chinatown",
            "jp": "国際空港と中華街がある玄関都市",
            "zh": "拥有国际机场和唐人街的门户城市",
        },
        "광주": {
            "ko": "예술과 문화의 도시",
            "en": "City of art and culture",
            "jp": "芸術と文化の都市",
            "zh": "艺术与文化之城",
        },
        "수원": {
            "ko": "화성으로 유명한 역사 도시",
            "en": "Historical city famous for Hwaseong Fortress",
            "jp": "華城で有名な歴史都市",
            "zh": "以华城著称的历史名城",
        },
        "전주": {
            "ko": "한옥마을과 비빔밥의 고향",
            "en": "Home of Hanok Village and Bibimbap",
            "jp": "韓屋村とビビンバの故郷",
            "zh": "韩屋村与拌饭之乡",
        },
        "경주": {
            "ko": "천년의 신라 역사가 살아있는 도시",
            "en": "City where 1,000 years of Silla history lives",
            "jp": "千年の新羅の歴史が息づく街",
            "zh": "千年新罗历史之城",
        },
    }

    city_list = [
        "서울",
        "부산",
        "제주",
        "대전",
        "대구",
        "인천",
        "광주",
        "수원",
        "전주",
        "경주",
    ]

    result = []
    for city_name in city_list:
        desc_dict = descriptions.get(city_name, {})
        desc = desc_dict.get(search_lang) or desc_dict.get("en") or desc_dict.get("ko")
        display_name = CITY_NAMES.get(city_name, {}).get(search_lang, city_name)

        result.append(
            PopularCityResponse(
                city_name=city_name,
                display_name=display_name,
                description=desc,
            )
        )

    return result


@router.get("/destinations/{city_name}", response_model=CityContentResponse)
async def get_city_content(
    city_name: str,
    target_lang: str = Query("ko", description="Target language code (ko, en, jp, zh)"),
    db: Session = Depends(get_db),
):
    from types import SimpleNamespace
    from datetime import datetime

    db_places = db.query(Place).filter(Place.city == city_name).limit(15).all()

    places = list(db_places)
    if len(places) < 15:
        remaining = 15 - len(places)
        existing_api_ids = {p.place_api_id for p in places if p.place_api_id}
        per_category = min(5, (remaining // 3) + 2)
        kakao_results_list = await asyncio.gather(
            search_kakao_places(f"{city_name} 맛집", limit=per_category),
            search_kakao_places(f"{city_name} 관광지", limit=per_category),
            search_kakao_places(f"{city_name} 카페", limit=per_category),
        )

        all_kakao_results = []
        for results in kakao_results_list:
            all_kakao_results.extend(results)

        for kakao_place in all_kakao_results:
            if len(places) >= 15:
                break
            if kakao_place.get("place_api_id") in existing_api_ids:
                continue

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
                opening_hours=[],
            )
            places.append(place_obj)
            existing_api_ids.add(kakao_place.get("place_api_id"))

    title_match = LocalColumn.title.ilike(f"%{city_name}%")
    section_place_subquery = (
        db.query(LocalColumnSection.column_id)
        .join(Place, LocalColumnSection.place_id == Place.id)
        .filter(Place.city == city_name)
        .distinct()
        .subquery()
    )

    columns = (
        db.query(LocalColumn)
        .filter(
            or_(
                title_match,
                LocalColumn.id.in_(section_place_subquery),
            )
        )
        .distinct()
        .limit(15)
        .all()
    )

    column_data = []
    for column in columns:
        user = db.query(User).filter(User.id == column.user_id).first()
        badge = db.query(LocalBadge).filter(
            LocalBadge.user_id == column.user_id,
            LocalBadge.is_active == True,
        ).first()
        column_data.append(
            LocalColumnListResponse(
                id=column.id,
                user_id=column.user_id,
                user_nickname=user.nickname if user else None,
                user_level=badge.level if badge else None,
                title=column.title,
                thumbnail_url=column.thumbnail_url,
                view_count=column.view_count,
                created_at=column.created_at,
            )
        )

    shortforms = (
        db.query(Shortform)
        .filter(
            Shortform.visibility == "PUBLIC",
            or_(
                Shortform.title.ilike(f"%{city_name}%"),
                Shortform.location.ilike(f"%{city_name}%"),
            ),
        )
        .order_by(Shortform.created_at.desc())
        .limit(15)
        .all()
    )

    shortform_data = []
    for sf in shortforms:
        user = db.query(User).filter(User.id == sf.user_id).first()
        shortform_data.append(
            ShortformListResponse(
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
                created_at=sf.created_at,
            )
        )

    plan_title_match = TravelPlan.title.ilike(f"%{city_name}%")
    plan_desc_match = TravelPlan.description.ilike(f"%{city_name}%")
    plan_place_subquery = (
        db.query(PlanDetail.plan_id)
        .join(Place, PlanDetail.place_id == Place.id)
        .filter(Place.city == city_name)
        .distinct()
        .subquery()
    )

    travel_plans = (
        db.query(TravelPlan)
        .filter(
            TravelPlan.is_public == True,
            or_(
                plan_title_match,
                plan_desc_match,
                TravelPlan.id.in_(plan_place_subquery),
            ),
        )
        .order_by(TravelPlan.created_at.desc())
        .limit(15)
        .all()
    )

    travel_plan_data = []
    for plan in travel_plans:
        user = db.query(User).filter(User.id == plan.user_id).first()
        travel_plan_data.append(
            TravelPlanListResponse(
                id=plan.id,
                user_id=plan.user_id,
                user_nickname=user.nickname if user else None,
                title=plan.title,
                description=plan.description,
                start_date=plan.start_date,
                end_date=plan.end_date,
                is_public=plan.is_public,
                created_at=plan.created_at,
            )
        )

    place_responses = []
    for p in places:
        if hasattr(p, "__table__"):
            place_responses.append(PlaceDetailResponse.from_orm(p))
        else:
            place_responses.append(
                PlaceDetailResponse(
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
                    opening_hours=p.opening_hours,
                )
            )

    lang_map = {"ja": "jp", "zh-CN": "zh", "zh-TW": "zh"}
    lookup_lang = lang_map.get(target_lang, target_lang)
    display_name = CITY_NAMES.get(city_name, {}).get(lookup_lang, city_name)

    if target_lang != "ko":
        try:
            await translate_city_content(
                travel_plan_data,
                place_responses,
                shortform_data,
                column_data,
                target_lang,
            )
        except Exception:
            logger.exception("Deep translation failed")

    return CityContentResponse(
        places=place_responses,
        local_columns=column_data,
        shortforms=shortform_data,
        travel_plans=travel_plan_data,
        display_name=display_name,
    )
