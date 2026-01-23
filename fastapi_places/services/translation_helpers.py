import logging
import zlib
from typing import Any, Dict, List, Optional, Tuple

from translation_client import translate_batch_proxy, translate_texts

logger = logging.getLogger(__name__)


async def translate_place_search_results(results: List[Dict[str, Any]], lang: Optional[str]) -> List[Dict[str, Any]]:
    if not lang or not results:
        return results

    items_to_translate: List[Dict[str, Any]] = []

    for res in results:
        entity_id_name = res.get("id") or (zlib.adler32(res.get("name", "").encode("utf-8")) & 0xFFFFFFFF)
        items_to_translate.append({
            "text": res.get("name", ""),
            "entity_type": "place_name" if res.get("id") else "raw",
            "entity_id": entity_id_name,
            "field": "name"
        })
        items_to_translate.append({
            "text": res.get("address", ""),
            "entity_type": "place_address" if res.get("id") else "raw",
            "entity_id": entity_id_name,
            "field": "address"
        })
        items_to_translate.append({
            "text": res.get("category_main", ""),
            "entity_type": "place_category" if res.get("id") else "raw",
            "entity_id": entity_id_name,
            "field": "category_main"
        })

    if not items_to_translate:
        return results

    translated_map = await translate_batch_proxy(items_to_translate, lang)
    current_idx = 0
    for res in results:
        if current_idx in translated_map:
            res["name_translated"] = translated_map[current_idx]
        current_idx += 1

        if current_idx in translated_map:
            res["address_translated"] = translated_map[current_idx]
        current_idx += 1

        if current_idx in translated_map:
            res["category_main_translated"] = translated_map[current_idx]
        current_idx += 1

    return results


async def translate_place_detail_with_city(
    result_data: Dict[str, Any],
    place_id: int,
    opening_hours: List[str],
    lang: Optional[str],
) -> Dict[str, Any]:
    if not lang:
        return result_data

    items_to_translate = [
        {"text": result_data.get("name", ""), "entity_type": "place", "entity_id": place_id, "field": "name"},
        {"text": result_data.get("address", ""), "entity_type": "place", "entity_id": place_id, "field": "address"},
        {"text": result_data.get("category_main", ""), "entity_type": "place", "entity_id": place_id, "field": "category_main"},
        {"text": result_data.get("city", ""), "entity_type": "place", "entity_id": place_id, "field": "city"},
    ]

    category_detail = result_data.get("category_detail") or []
    category_detail_start = len(items_to_translate)
    for idx, cat in enumerate(category_detail):
        items_to_translate.append({
            "text": cat,
            "entity_type": "place_category",
            "entity_id": place_id,
            "field": f"category_detail_{idx}"
        })

    opening_base_idx = len(items_to_translate)
    for oh in opening_hours:
        items_to_translate.append({
            "text": oh,
            "entity_type": "place_opening_hours",
            "entity_id": place_id,
            "field": "opening_hours"
        })

    translated_map = await translate_batch_proxy(items_to_translate, lang)

    if 0 in translated_map:
        result_data["name"] = translated_map[0]
    if 1 in translated_map:
        result_data["address"] = translated_map[1]
    if 2 in translated_map:
        result_data["category_main"] = translated_map[2]
    if 3 in translated_map:
        result_data["city"] = translated_map[3]

    if category_detail:
        translated_details = []
        for i in range(len(category_detail)):
            idx = category_detail_start + i
            translated_details.append(translated_map.get(idx, category_detail[i]))
        result_data["category_detail_translated"] = translated_details

    new_opening_hours = []
    for i in range(len(opening_hours)):
        idx = opening_base_idx + i
        new_opening_hours.append(translated_map.get(idx, opening_hours[i]))
    if new_opening_hours:
        result_data["opening_hours"] = new_opening_hours

    return result_data


async def translate_place_detail_basic(
    result_data: Dict[str, Any],
    place_id: int,
    opening_hours: List[str],
    lang: Optional[str],
) -> Dict[str, Any]:
    if not lang:
        return result_data

    items_to_translate = [
        {"text": result_data.get("name", ""), "entity_type": "place_name", "entity_id": place_id, "field": "name"},
        {"text": result_data.get("address", ""), "entity_type": "place_address", "entity_id": place_id, "field": "address"},
        {"text": result_data.get("category_main", ""), "entity_type": "place_category", "entity_id": place_id, "field": "category_main"},
    ]

    category_detail = result_data.get("category_detail") or []
    category_detail_start = len(items_to_translate)
    for idx, cat in enumerate(category_detail):
        items_to_translate.append({
            "text": cat,
            "entity_type": "place_category",
            "entity_id": place_id,
            "field": f"category_detail_{idx}"
        })

    opening_idx_start = len(items_to_translate)
    for oh in opening_hours:
        items_to_translate.append({
            "text": oh,
            "entity_type": "place_hours",
            "entity_id": place_id,
            "field": "opening_hours"
        })

    translated_map = await translate_batch_proxy(items_to_translate, lang)

    if 0 in translated_map:
        result_data["name"] = translated_map[0]
    if 1 in translated_map:
        result_data["address"] = translated_map[1]
    if 2 in translated_map:
        result_data["category_main"] = translated_map[2]

    if category_detail:
        translated_details = []
        for i in range(len(category_detail)):
            idx = category_detail_start + i
            translated_details.append(translated_map.get(idx, category_detail[i]))
        result_data["category_detail_translated"] = translated_details

    new_opening_hours = []
    for i in range(len(opening_hours)):
        idx = opening_idx_start + i
        new_opening_hours.append(translated_map.get(idx, opening_hours[i]))
    if new_opening_hours:
        result_data["opening_hours"] = new_opening_hours

    return result_data


async def translate_local_column_list(result: List[Any], lang: Optional[str]) -> List[Any]:
    if not lang or not result:
        return result

    items_to_translate = []
    for item in result:
        if getattr(item, "title", None):
            items_to_translate.append({
                "text": item.title,
                "entity_type": "local_column",
                "entity_id": item.id,
                "field": "title"
            })

    if not items_to_translate:
        return result

    translated_map = await translate_batch_proxy(items_to_translate, lang)
    for idx, item in enumerate(result):
        if idx in translated_map:
            item.title = translated_map[idx]
    return result


async def translate_local_column_detail(column: Any, section_data: List[Any], lang: Optional[str]) -> None:
    if not lang:
        return

    items_to_translate = [
        {"text": column.title, "entity_type": "local_column", "entity_id": column.id, "field": "title"},
        {"text": column.content, "entity_type": "local_column", "entity_id": column.id, "field": "content"},
    ]

    for sec in section_data:
        items_to_translate.append({
            "text": sec.title,
            "entity_type": "local_column_section",
            "entity_id": sec.id,
            "field": "title"
        })
        items_to_translate.append({
            "text": sec.content,
            "entity_type": "local_column_section",
            "entity_id": sec.id,
            "field": "content"
        })

    translated_map = await translate_batch_proxy(items_to_translate, lang)

    if 0 in translated_map:
        column.title = translated_map[0]
    if 1 in translated_map:
        column.content = translated_map[1]

    current_idx = 2
    for sec in section_data:
        if current_idx in translated_map:
            sec.title = translated_map[current_idx]
        current_idx += 1

        if current_idx in translated_map:
            sec.content = translated_map[current_idx]
        current_idx += 1


async def translate_reviews(review_data: List[Dict[str, Any]], lang: Optional[str]) -> List[Dict[str, Any]]:
    if not lang or not review_data:
        return review_data

    items_to_translate = []
    for review in review_data:
        items_to_translate.append({
            "text": review.get("content", ""),
            "entity_type": "review",
            "entity_id": review.get("id"),
            "field": "content"
        })

    translated_map = await translate_batch_proxy(items_to_translate, lang)

    for idx, review in enumerate(review_data):
        if idx in translated_map:
            review["content_translated"] = translated_map[idx]
    return review_data


async def translate_city_content(
    travel_plan_data: List[Any],
    place_responses: List[Any],
    shortform_data: List[Any],
    column_data: List[Any],
    target_lang: str,
) -> None:
    if target_lang == "ko":
        return

    texts_to_translate: List[str] = []
    tp_indices: List[Tuple[int, str]] = []
    pl_indices: List[Tuple[int, str]] = []
    sf_indices: List[Tuple[int, str]] = []
    col_indices: List[Tuple[int, str]] = []

    for i, plan in enumerate(travel_plan_data):
        if plan.title:
            texts_to_translate.append(plan.title)
            tp_indices.append((i, "title"))
        if plan.description:
            texts_to_translate.append(plan.description)
            tp_indices.append((i, "desc"))

    for i, place in enumerate(place_responses):
        if place.name:
            texts_to_translate.append(place.name)
            pl_indices.append((i, "name"))
        if place.address:
            texts_to_translate.append(place.address)
            pl_indices.append((i, "addr"))
        if place.category_main:
            texts_to_translate.append(place.category_main)
            pl_indices.append((i, "cat"))

    for i, sf in enumerate(shortform_data):
        if sf.title:
            texts_to_translate.append(sf.title)
            sf_indices.append((i, "title"))
        if sf.content:
            texts_to_translate.append(sf.content)
            sf_indices.append((i, "content"))

    for i, col in enumerate(column_data):
        if col.title:
            texts_to_translate.append(col.title)
            col_indices.append((i, "title"))

    if not texts_to_translate:
        return

    translated_texts = await translate_texts(texts_to_translate, target_lang)

    result_idx = 0
    for idx, field in tp_indices:
        if field == "title":
            travel_plan_data[idx].title = translated_texts[result_idx]
        else:
            travel_plan_data[idx].description = translated_texts[result_idx]
        result_idx += 1

    for idx, field in pl_indices:
        if field == "name":
            place_responses[idx].name = translated_texts[result_idx]
        elif field == "addr":
            place_responses[idx].address = translated_texts[result_idx]
        else:
            place_responses[idx].category_main = translated_texts[result_idx]
        result_idx += 1

    for idx, field in sf_indices:
        if field == "title":
            shortform_data[idx].title = translated_texts[result_idx]
        else:
            shortform_data[idx].content = translated_texts[result_idx]
        result_idx += 1

    for idx, field in col_indices:
        if field == "title":
            column_data[idx].title = translated_texts[result_idx]
        result_idx += 1
