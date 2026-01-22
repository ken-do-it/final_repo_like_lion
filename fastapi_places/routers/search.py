import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from schemas import PlaceAutocompleteSuggestion
from services.external_places import search_kakao_places
from services.places_search import search_places_hybrid
from services.translation_helpers import translate_place_search_results


logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/search")
async def search_places(
    query: str = Query(..., min_length=1, description="검색어"),
    category: Optional[str] = Query(None, description="카테고리 필터"),
    city: Optional[str] = Query(None, description="도시 필터"),
    lang: Optional[str] = Query(None, description="타겟 언어 (예: eng_Latn)"),
    db: Session = Depends(get_db),
):
    all_results = await search_places_hybrid(query, category, city, db=db)

    if lang:
        try:
            all_results = await translate_place_search_results(all_results, lang)
        except Exception:
            logger.exception("Translation failed")

    return {"query": query, "total": len(all_results), "results": all_results}


@router.get("/autocomplete")
async def autocomplete_places(
    q: str = Query(..., min_length=2, description="검색어 (최소 2글자)"),
    limit: int = Query(10, ge=1, le=50),
):
    kakao_results = await search_kakao_places(q, limit=limit)
    suggestions = [
        PlaceAutocompleteSuggestion(
            place_api_id=result.get("place_api_id"),
            name=result["name"],
            address=result["address"],
            city=result["city"],
        )
        for result in kakao_results
    ]
    return {"suggestions": suggestions}
