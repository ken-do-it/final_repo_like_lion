# 마이페이지 (My Page) 개발 가이드

## 개요
외국인 관광객을 위한 한국 여행 플랫폼의 마이페이지 기능. 사용자의 프로필, 여행 일정, 예약 내역, 리뷰, 포인트 등을 통합 관리합니다.

## 마이페이지 구조

### 1. 메인 대시보드 (My Page Dashboard)
사용자 로그인 후 접근 가능한 중앙 허브

**주요 섹션:**
- **Profile**: 사용자 프로필 정보
- **Saved**: 저장한 장소 (찜 목록)
- **Reviews**: 작성한 리뷰
- **Itineraries**: AI 생성 여행 일정
- **Bookings**: 예약 내역
- **Points**: 포인트 및 크레딧

**인터랙션:**
- Edit: 정보 수정
- View: 상세 조회
- Manage: 관리 (삭제, 수정 등)

### 2. 프로필 (My Profile)

#### 2.1 프로필 사진
- 사용자 아바타 표시
- 회원 가입 날짜 표시
- 프로필 이미지 업로드/변경 기능

#### 2.2 기본 정보
- **Name**: 사용자 이름
- **Email**: 이메일 주소
- **Country**: 국가
- **City**: 도시

#### 2.3 설정 (Settings)
- **Language**: 언어 설정 (English, Korean 등)
- **Currency**: 통화 설정 (USD, KRW 등)
- **Travel Interests**: 여행 관심사

**편집 기능:**
- 필드 클릭으로 인라인 편집
- 실시간 저장

### 3. 저장한 장소 (My Saved Places)

**카드 레이아웃:**
- 장소 이미지 (컬러풀한 배경)
- 장소 이름
- 위치 정보 (도시, 국가)

**예시 장소:**
- Gyeongbokgung Palace (경복궁) - Seoul
- Bukchon Hanok Village (북촌한옥마을) - Seoul
- Haeundae Beach (해운대) - Busan
- Jeju Island (제주도) - Jeju

**기능:**
- 장소 저장/제거
- 카테고리별 필터링
- 지도 뷰로 전환

### 4. 내 리뷰 (My Reviews)

**리뷰 카드:**
- 장소 이름
- 작성 날짜
- 리뷰 내용
- 별점 (선택사항)

**예시 리뷰:**
```
Gyeongbokgung Palace
Reviewed on Dec 15, 2024
"Amazing historical site! The architecture is breathtaking and the guided tour was very informative. Highly recommend visiting in spring."

Haeundae Beach
Reviewed on Dec 5, 2024
"Absolutely stunning beach! Clean water, great restaurants nearby, and beautiful sunset views. A must-visit in Busan."
```

**기능:**
- 리뷰 작성 (50 포인트 획득)
- 리뷰 수정/삭제
- 사진 첨부

### 5. AI 여행 일정 (My AI Itineraries)

**일정 카드:**
- **Title**: 일정 제목 (예: "5-Day Seoul Adventure")
- **AI Generated**: 생성 날짜
- **Duration**: 여행 기간
- **Budget**: 예산
- **Places**: 방문 장소 수

**예시:**
```
5-Day Seoul Adventure
AI Generated on Dec 20, 2024
Duration: 5 Days | Budget: $800 | Places: 12 Spots

Day Highlights:
- Day 1: Gyeongbokgung (Historical palaces)
- Day 2: Myeongdong (Shopping and Seoul Tower)
- Day 3: Gangnam (Modern Seoul culture)
```

**AI 기능:**
- 관심사 기반 개인화
- 예산 맞춤 추천
- 일정 최적화

**옵션:**
- 일정 다운로드
- 친구와 공유
- 예약 연동

### 6. 예약 내역 (My Bookings)

**예약 상태:**
- **CONFIRMED**: 확정된 예약 (녹색)
- **PENDING**: 대기 중 (주황색)
- **CANCELLED**: 취소됨 (회색)
- **COMPLETED**: 완료됨 (파란색)

**예약 정보:**
- Booking ID (예: BK20241220001)
- 예약 이름/패키지
- 날짜
- 참가 인원
- 총 금액

**예시:**
```
[CONFIRMED]
Seoul City Tour Package
Booking ID: BK20241220001
Date: Dec 25-27, 2024
Participants: 2 Adults
Total Price: $350

[PENDING]
Jeju Island 3-Day Trip
Booking ID: BK20241220002
Date: Jan 5-7, 2025
Participants: 1 Adult
Total Price: $550
```

**기능:**
- 예약 상세 조회
- 예약 취소
- 바우처 다운로드
- 예약 변경 요청

### 7. 포인트 & 크레딧 (My Credits & Points)

#### 7.1 포인트 잔액
**주요 정보:**
- **Total Points Balance**: 총 포인트 (예: 2,450)
- **This Month**: 이번 달 적립 (+320)
- **Expires Soon**: 곧 만료될 포인트 (150)

#### 7.2 포인트 획득 방법

**How to Earn Points:**
- **Write a Review**: 50 포인트
- **Complete Booking**: 최대 200 포인트
- **Refer a Friend**: 100 포인트

#### 7.3 포인트 사용 (Redeem Your Points)
- 1000 포인트 = $10 할인

#### 7.4 최근 거래 내역

**Recent Transactions:**
```
Booking Reward        +150    Dec 20, 2024
Review Bonus          +50     Dec 15, 2024
Discount Applied      -100    Dec 10, 2024
```

**거래 유형:**
- 적립 (녹색, +)
- 사용 (빨간색, -)

## 데이터 모델

### User Profile
```python
class User(AbstractUser):
    nickname = models.CharField(max_length=50)
    country = models.CharField(max_length=100)
    city = models.CharField(max_length=100)
    profile_image_url = models.URLField()
    # ... 기타 필드
```

### User Preferences
```python
class UserPreference(models.Model):
    user = models.OneToOneField(User)
    language = models.CharField(max_length=10)  # en, ko 등
    currency = models.CharField(max_length=10)  # USD, KRW 등
    push_notification = models.BooleanField(default=True)
    email_notification = models.BooleanField(default=True)
```

### Saved Places
```python
class SavedPlace(models.Model):
    user = models.ForeignKey(User)
    place = models.ForeignKey(Place)
    saved_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)
```

### Reviews
```python
class PlaceReview(models.Model):
    user = models.ForeignKey(User)
    place = models.ForeignKey(Place)
    rating = models.IntegerField()  # 1-5
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### AI Itineraries
```python
class AIItinerary(models.Model):
    user = models.ForeignKey(User)
    title = models.CharField(max_length=200)
    duration_days = models.IntegerField()
    budget = models.DecimalField()
    places_count = models.IntegerField()
    generated_at = models.DateTimeField(auto_now_add=True)
    itinerary_data = models.JSONField()  # 상세 일정 데이터
```

### Bookings
```python
class Booking(models.Model):
    STATUS_CHOICES = [
        ('CONFIRMED', 'Confirmed'),
        ('PENDING', 'Pending'),
        ('CANCELLED', 'Cancelled'),
        ('COMPLETED', 'Completed'),
    ]

    booking_id = models.CharField(unique=True)
    user = models.ForeignKey(User)
    package_name = models.CharField(max_length=200)
    start_date = models.DateField()
    end_date = models.DateField()
    participants = models.IntegerField()
    total_price = models.DecimalField()
    status = models.CharField(choices=STATUS_CHOICES)
```

### Points System
```python
class UserPoints(models.Model):
    user = models.OneToOneField(User)
    total_points = models.IntegerField(default=0)
    this_month_points = models.IntegerField(default=0)
    expiring_points = models.IntegerField(default=0)

class PointTransaction(models.Model):
    TRANSACTION_TYPES = [
        ('EARN_REVIEW', 'Review Bonus'),
        ('EARN_BOOKING', 'Booking Reward'),
        ('EARN_REFERRAL', 'Referral Bonus'),
        ('REDEEM_DISCOUNT', 'Discount Applied'),
    ]

    user = models.ForeignKey(User)
    transaction_type = models.CharField(choices=TRANSACTION_TYPES)
    points = models.IntegerField()  # 양수: 적립, 음수: 사용
    description = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
```

## API 엔드포인트

### 프로필 관리
```
GET    /api/users/profile/              # 프로필 조회
PUT    /api/users/profile/              # 프로필 수정
PATCH  /api/users/profile/avatar/       # 프로필 이미지 업로드
GET    /api/users/preferences/          # 설정 조회
PUT    /api/users/preferences/          # 설정 수정
```

### 저장한 장소
```
GET    /api/users/saved-places/         # 저장한 장소 목록
POST   /api/users/saved-places/         # 장소 저장
DELETE /api/users/saved-places/{id}/    # 저장 취소
```

### 리뷰
```
GET    /api/users/reviews/              # 내 리뷰 목록
POST   /api/places/{id}/reviews/        # 리뷰 작성
PUT    /api/reviews/{id}/               # 리뷰 수정
DELETE /api/reviews/{id}/               # 리뷰 삭제
```

### AI 일정
```
GET    /api/users/itineraries/          # AI 일정 목록
POST   /api/itineraries/generate/       # AI 일정 생성
GET    /api/itineraries/{id}/           # 일정 상세
DELETE /api/itineraries/{id}/           # 일정 삭제
POST   /api/itineraries/{id}/share/     # 일정 공유
```

### 예약
```
GET    /api/users/bookings/             # 예약 목록
GET    /api/bookings/{id}/              # 예약 상세
POST   /api/bookings/                   # 예약 생성
PUT    /api/bookings/{id}/cancel/       # 예약 취소
GET    /api/bookings/{id}/voucher/      # 바우처 다운로드
```

### 포인트
```
GET    /api/users/points/               # 포인트 잔액 조회
GET    /api/users/points/transactions/  # 거래 내역
POST   /api/users/points/redeem/        # 포인트 사용
```

## 포인트 시스템 로직

### 포인트 적립 규칙
```python
POINT_RULES = {
    'WRITE_REVIEW': 50,
    'COMPLETE_BOOKING': lambda booking: min(booking.total_price * 0.02, 200),
    'REFER_FRIEND': 100,
}
```

### 포인트 사용
- 1000 포인트 = $10 할인
- 예약 시 자동 적용 가능
- 부분 사용 가능

### 포인트 만료
- 적립일로부터 1년 후 만료
- 만료 30일 전 알림

## UI/UX 가이드라인

### 색상 체계
- **Primary Blue**: #2196F3 (메인 액션)
- **Green**: #4CAF50 (성공, 확정)
- **Orange**: #FF9800 (대기, 경고)
- **Red**: #F44336 (취소, 오류)

### 레이아웃
- 반응형 디자인 (모바일 우선)
- 카드 기반 UI
- 명확한 시각적 계층

### 인터랙션
- 인라인 편집
- 즉각적인 피드백
- 로딩 인디케이터

## 보안 고려사항

1. **인증 필수**
   - 모든 마이페이지 API는 JWT 인증 필요
   - 세션 만료 시 자동 리다이렉트

2. **권한 검증**
   - 사용자 본인의 데이터만 접근 가능
   - Cross-user 데이터 접근 차단

3. **데이터 보호**
   - 개인정보 암호화
   - 민감 정보 마스킹

## 개발 우선순위

### Phase 1 (MVP)
1. ✅ 프로필 조회/수정
2. ✅ 설정 관리
3. 저장한 장소
4. 내 리뷰

### Phase 2
5. AI 여행 일정
6. 예약 내역
7. 포인트 시스템

### Phase 3
8. 소셜 기능 (친구, 공유)
9. 알림 센터
10. 여행 통계 대시보드

## 참고 자료
- Triple App UX/UI
- Airbnb 마이페이지
- Booking.com 사용자 계정
