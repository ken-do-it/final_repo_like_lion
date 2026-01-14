from django.db import models
from django.conf import settings

class Place(models.Model):
    """
    장소 정보 (places)
    - 카카오 API 데이터와 사용자 등록 데이터를 통합 관리
    - 이연주님 설계 반영 (Provider, Category JSON, Thumbnail 등)
    """
    # [1] API 제공자 구분 (카카오 / 사용자)
    class Provider(models.TextChoices):
        KAKAO = 'KAKAO', 'Kakao API'
        USER = 'USER', 'User Registered'

    provider = models.CharField(max_length=50, choices=Provider.choices, default=Provider.KAKAO)

    # [2] 장소 ID 관리
    # 카카오 장소 ID는 유니크하지만, 사용자 등록일 경우 null일 수 있음 -> unique=True 유지하되 null 허용
    place_api_id = models.CharField(max_length=50, unique=True, null=True, blank=True, help_text="카카오맵 장소 ID")

    name = models.TextField(help_text="장소 이름")
    source_lang = models.CharField(max_length=10, default='ko', help_text="작성 언어 (예: ko, en)")

    # [3] 카테고리 (대분류 / 상세분류 JSON)
    class CategoryMain(models.TextChoices):
        RESTAURANT = '음식점', '음식점'
        CAFE = '카페', '카페'
        TOURIST_ATTRACTION = '관광명소', '관광명소'
        ACCOMMODATION = '숙박', '숙박'
        CULTURE = '문화시설', '문화시설'
        SHOPPING = '쇼핑', '쇼핑'
        HOSPITAL = '병원', '병원'
        CONVENIENCE = '편의점', '편의점'
        BANK = '은행', '은행'
        PARKING = '주차장', '주차장'

    category_main = models.CharField(max_length=50, choices=CategoryMain.choices, help_text="메인 카테고리")
    
    # "['음식점', '베이커리', '빵']" 처럼 리스트로 저장하기 위해 JSONField 사용
    # SQLite에서는 텍스트로 저장되지만, PostgreSQL에서는 실제 JSON 타입으로 저장됨 (검색 유리)
    category_detail = models.JSONField(default=list, blank=True, help_text="상세 카테고리 리스트")

    # [
    #     (["호텔", "모텔", "펜션", "게스트하우스", "리조트", "민박", "숙박"], "숙박"),
    #     (["음식점", "식당", "맛집"], "음식점"),
    #     (["카페", "커피"], "카페"),
    #     (["관광", "명소", "여행"], "관광명소"),
    #     (["문화시설", "박물관", "미술관", "공연장"], "문화시설"),
    #     (["쇼핑", "백화점", "마트", "시장"], "쇼핑"),
    #     (["병원", "의원", "약국"], "병원"),
    #     (["편의점"], "편의점"),
    #     (["은행", "ATM"], "은행"),
    #     (["주차장"], "주차장"),
    # ]
    
    # [4] 위치 정보
    address = models.TextField(help_text="도로명 주소")
    city = models.CharField(max_length=50, db_index=True, help_text="도시 (필터링용)")
    
    # 위도/경도 (정밀도 고려하여 Decimal 사용)
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    
    # [5] 썸네일 (여러 장일 수 있으므로 JSON 또는 텍스트 고려 -> 확장성 위해 JSON 추천)
    # 이연주님 코멘트: "text? json? 배포에 맞는 쪽으로" -> JSONField가 가장 유연함
    thumbnail_urls = models.JSONField(default=list, blank=True, null=True, help_text="이미지 URL 리스트")
    
    # [6] 등록자 정보 (사용자 직접 등록 시)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    # [7] 리뷰 통계 (캐시 필드 - 성능 최적화)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00, help_text="평균 별점 (0.00~5.00)")
    review_count = models.IntegerField(default=0, help_text="리뷰 개수")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'places'
        indexes = [
            models.Index(fields=['city']),        # 도시별 검색 최적화
            models.Index(fields=['provider']),    # 제공자별 필터링
            models.Index(fields=['place_api_id']),# API ID 조회
        ]

class PlaceReview(models.Model):
    """
    장소 리뷰 (place_reviews)
    """
    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    content = models.TextField()
    source_lang = models.CharField(max_length=10, default='ko', help_text="작성 언어 (예: ko, en)")
    rating = models.IntegerField(default=5, choices=[(i, str(i)) for i in range(1, 6)]) # 1~5점
    
    # 리뷰 이미지 (옵션)
    image_url = models.CharField(max_length=500, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'place_reviews'
        unique_together = ('user', 'place')  # 한 사용자가 같은 장소에 중복 리뷰 방지
        ordering = ['-created_at']

class PlaceBookmark(models.Model):
    """
    장소 찜하기 (place_bookmarks)
    "한 사람이 한 장소를 여러 번 저장할 게 아니니까 유니크 처리"
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='place_bookmarks')
    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name='bookmarks')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'place_bookmarks'
        unique_together = ('user', 'place') # ★ 중복 찜 방지 (Composite Unique Key)
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['created_at']),
        ]

class LocalColumn(models.Model):
    """
    현지인 추천 칼럼 (local_columns)
    - 현지인이 작성하는 맛집/명소 소개 매거진
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='local_columns')
    
    title = models.CharField(max_length=200, help_text="현지인 칼럼 제목")
    thumbnail_url = models.TextField(blank=True, null=True, help_text="현지인 칼럼 썸네일")
    content = models.TextField(help_text="현지인 칼럼 내용 (서론)")
    source_lang = models.CharField(max_length=10, default='ko', help_text="작성 언어 (예: ko, en)")

    # 칼럼 내부 이미지 (메인 내용에 들어가는 이미지)
    intro_image_url = models.TextField(blank=True, null=True, help_text="현지인 칼럼 내부 이미지")
    
    # 메인 장소 연결 (옵션)
    representative_place = models.ForeignKey(Place, on_delete=models.SET_NULL, null=True, blank=True, help_text="대표 장소 ID")
    
    view_count = models.IntegerField(default=0, help_text="조회수")
    
    # 좋아요 기능은 추후 개발 단계에서 추가 예정 (현재는 제외)
    # like_count = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'local_columns'
        ordering = ['-created_at']

class LocalColumnSection(models.Model):
    """
    칼럼 섹션 (local_column_sections)
    - 칼럼 하나에 여러 장소나 소주제를 담기 위한 섹션
    """
    column = models.ForeignKey(LocalColumn, on_delete=models.CASCADE, related_name='sections')
    
    # 섹션별 장소 연결
    place = models.ForeignKey(Place, on_delete=models.SET_NULL, null=True, blank=True, help_text="섹션과 연결된 장소")
    
    order = models.IntegerField(default=0, help_text="섹션 순서")
    title = models.CharField(max_length=200, blank=True, help_text="섹션 제목")
    content = models.TextField(help_text="섹션 내용 (설명/추천이유)")
    source_lang = models.CharField(max_length=10, default='ko', help_text="작성 언어 (예: ko, en)")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'local_column_sections'
        ordering = ['column', 'order'] # 칼럼별 순서대로 정렬

class LocalColumnSectionImage(models.Model):
    """
    칼럼 섹션 이미지 (local_column_section_images)
    - 섹션 하나에 여러 장의 이미지가 들어갈 수 있음
    """
    section = models.ForeignKey(LocalColumnSection, on_delete=models.CASCADE, related_name='images')
    
    image_url = models.TextField(help_text="칼럼 섹션 이미지 URL")
    order = models.IntegerField(default=0, help_text="이미지 순서")

    class Meta:
        db_table = 'local_column_section_images'
        ordering = ['section', 'order']


class RoadviewGameImage(models.Model):
    """로드뷰 게임 이미지 모델"""
    image_url = models.CharField(max_length=500)
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    city = models.CharField(max_length=50, null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        db_column='created_by_id' # FastAPI와 컬럼명 통일
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'roadview_game_images' # 테이블 이름을 FastAPI와 똑같이 맞춤