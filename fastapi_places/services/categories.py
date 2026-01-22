GOOGLE_CATEGORY_MAP = {
    "restaurant": "음식점",
    "cafe": "카페",
    "bakery": "베이커리",
    "bar": "바",
    "food": "음식점",
    "meal_delivery": "배달음식점",
    "meal_takeaway": "포장음식점",
    "lodging": "숙박",
    "hotel": "호텔",
    "motel": "모텔",
    "guest_house": "게스트하우스",
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
    "shopping_mall": "쇼핑몰",
    "department_store": "백화점",
    "store": "상점",
    "convenience_store": "편의점",
    "supermarket": "슈퍼마켓",
    "clothing_store": "의류매장",
    "shoe_store": "신발매장",
    "jewelry_store": "보석상",
    "book_store": "서점",
    "airport": "공항",
    "train_station": "기차역",
    "subway_station": "지하철역",
    "bus_station": "버스터미널",
    "taxi_stand": "택시승강장",
    "parking": "주차장",
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


def map_category_to_main(category_detail):
    if not category_detail:
        return None

    full_category = " ".join(category_detail)

    mapping_rules = [
        (
            ["호텔", "모텔", "리조트", "게스트하우스", "펜션", "홈스테이", "숙박"],
            "숙박",
        ),
        (["음식점", "식당", "맛집"], "음식점"),
        (["카페", "베이커리"], "카페"),
        (["관광명소", "명소", "관광지"], "관광명소"),
        (["문화시설", "박물관", "미술관", "전시"], "문화시설"),
        (["쇼핑", "백화점", "마트", "상점"], "쇼핑"),
        (["병원", "약국"], "병원"),
        (["편의점"], "편의점"),
        (["은행", "ATM"], "은행"),
        (["주차장"], "주차장"),
    ]

    for keywords, category in mapping_rules:
        for keyword in keywords:
            if keyword in full_category:
                return category

    return "기타"
