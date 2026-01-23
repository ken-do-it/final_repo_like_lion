from typing import List, Optional


# ==================== 환경 변수 ====================

# 구글 카테고리 영어 → 한국어 매핑
GOOGLE_CATEGORY_MAP = {
    # 음식/음료
    "restaurant": "음식점",
    "cafe": "카페",
    "bakery": "베이커리",
    "bar": "바",
    "food": "음식점",
    "meal_delivery": "배달음식점",
    "meal_takeaway": "포장음식점",
    # 숙박
    "lodging": "숙박",
    "hotel": "호텔",
    "motel": "모텔",
    "guest_house": "게스트하우스",
    # 관광/레저
    "tourist_attraction": "관광명소",
    "museum": "박물관",
    "art_gallery": "미술관",
    "park": "공원",
    "amusement_park": "놀이공원",
    "aquarium": "수족관",
    "zoo": "동물원",
    "stadium": "경기장",
    "casino": "카지노",
    "night_club": "나이트클럽",
    # 쇼핑
    "shopping_mall": "쇼핑몰",
    "department_store": "백화점",
    "store": "상점",
    "convenience_store": "편의점",
    "supermarket": "슈퍼마켓",
    "clothing_store": "의류매장",
    "shoe_store": "신발매장",
    "jewelry_store": "보석상",
    "book_store": "서점",
    # 교통
    "airport": "공항",
    "train_station": "기차역",
    "subway_station": "지하철역",
    "bus_station": "버스터미널",
    "taxi_stand": "택시승강장",
    "parking": "주차장",
    # 기타
    "spa": "스파",
    "gym": "헬스장",
    "beauty_salon": "미용실",
    "hospital": "병원",
    "pharmacy": "약국",
    "bank": "은행",
    "atm": "ATM",
    "church": "교회",
    "temple": "절",
    "point_of_interest": "관광명소",
    "establishment": "시설",
}


def map_category_to_main(category_detail: List[str]) -> Optional[str]:

    # # """
    # # 카카오 카테고리 → 메인 카테고리 매핑
    # # 수정전
    # # """
    # if not category_detail:
    #     return None

    # first_category = category_detail[0] if category_detail else ""

    # mapping = {
    #     "음식점": "음식점",
    #     "카페": "카페",
    #     "관광명소": "관광명소",
    #     "숙박": "숙박",
    #     "문화시설": "문화시설",
    #     "쇼핑": "쇼핑",
    #     "병원": "병원",
    #     "편의점": "편의점",
    #     "은행": "은행",
    #     "주차장": "주차장"
    # }

    # for key, value in mapping.items():
    #     if key in first_category:
    #         return value

    # return "기타"

    """
    카카오 카테고리 → 메인 카테고리 매핑
    전체 카테고리 리스트를 검사하여 매핑
    수정본
    """
    if not category_detail:
        return None

    # 전체 카테고리를 하나의 문자열로 합침
    full_category = " ".join(category_detail)

    # 우선순위 순으로 매핑 (구체적인 것 먼저)
    mapping_rules = [
        (["호텔", "모텔", "펜션", "게스트하우스", "리조트", "민박", "숙박"], "숙박"),
        (["음식점", "식당", "맛집"], "음식점"),
        (["카페", "커피"], "카페"),
        (["관광", "명소", "여행"], "관광명소"),
        (["문화시설", "박물관", "미술관", "공연장"], "문화시설"),
        (["쇼핑", "백화점", "마트", "시장"], "쇼핑"),
        (["병원", "의원", "약국"], "병원"),
        (["편의점"], "편의점"),
        (["은행", "ATM"], "은행"),
        (["주차장"], "주차장"),
    ]

    for keywords, category in mapping_rules:
        for keyword in keywords:
            if keyword in full_category:
                return category

    return "기타"
