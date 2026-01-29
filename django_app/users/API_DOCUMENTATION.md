# Users App API 문서

외국인 관광객을 위한 여행 플랫폼의 로그인/메인페이지 API 문서입니다.

## 목차
- [인증 API](#인증-api)
- [이메일 인증](#이메일-인증)
- [비밀번호 관리](#비밀번호-관리)
- [프로필 및 설정](#프로필-및-설정)
- [메인페이지](#메인페이지)

---

## 인증 API

### 1. 회원가입
**POST** `/api/users/register/`

외국인 관광객 회원가입 API

**Request Body:**
```json
{
  "username": "traveler123",
  "email": "traveler@example.com",
  "password": "SecurePass123!",
  "password_confirm": "SecurePass123!",
  "nickname": "여행자",
  "birth_year": 1990,
  "country": "USA",
  "city": "New York",
  "phone_number": "+1-123-456-7890"
}
```

**Response (201 Created):**
```json
{
  "message": "회원가입이 완료되었습니다.",
  "user": {
    "id": 1,
    "username": "traveler123",
    "email": "traveler@example.com",
    "nickname": "여행자",
    "country": "USA",
    "city": "New York",
    "account_status": "ACTIVE",
    "is_email_verified": false,
    "provider_type": "LOCAL"
  }
}
```

---

### 2. 로그인
**POST** `/api/users/login/`

일반 로그인 API (JWT 토큰 발급)

**Request Body:**
```json
{
  "username": "traveler123",
  "password": "SecurePass123!",
  "remember_me": true
}
```

**Response (200 OK):**
```json
{
  "message": "로그인 성공",
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 1,
    "username": "traveler123",
    "email": "traveler@example.com",
    "nickname": "여행자",
    "preferences": {
      "language": "ko",
      "currency": "KRW"
    }
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "error": "아이디 또는 비밀번호가 올바르지 않습니다."
}
```

---

### 3. 로그아웃
**POST** `/api/users/logout/`

로그아웃 API (세션 삭제)

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response (200 OK):**
```json
{
  "message": "로그아웃되었습니다."
}
```

---

### 4. 토큰 갱신
**POST** `/api/users/token/refresh/`

만료된 액세스 토큰을 갱신하는 API

**Request Body:**
```json
{
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

---

## 이메일 인증

### 5. 인증 코드 발송
**POST** `/api/users/send-verification/`

이메일 인증 코드 발송 API

**Request Body:**
```json
{
  "email": "traveler@example.com",
  "purpose": "SIGNUP"
}
```

**purpose 옵션:**
- `SIGNUP`: 회원가입
- `FIND_ID`: 아이디 찾기
- `FIND_PASSWORD`: 비밀번호 찾기

**Response (200 OK):**
```json
{
  "message": "인증 코드가 발송되었습니다."
}
```

---

### 6. 이메일 인증
**POST** `/api/users/verify-email/`

발송된 인증 코드 확인 API

**Request Body:**
```json
{
  "email": "traveler@example.com",
  "code": "123456"
}
```

**Response (200 OK):**
```json
{
  "message": "이메일 인증이 완료되었습니다."
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": "인증 코드가 만료되었습니다."
}
```

---

## 비밀번호 관리

### 7. 비밀번호 재설정 요청
**POST** `/api/users/password/reset/request/`

비밀번호 재설정 링크 이메일 발송

**Request Body:**
```json
{
  "email": "traveler@example.com"
}
```

**Response (200 OK):**
```json
{
  "message": "비밀번호 재설정 링크가 발송되었습니다."
}
```

---

### 8. 비밀번호 재설정 확인
**POST** `/api/users/password/reset/confirm/`

토큰을 사용한 비밀번호 재설정

**Request Body:**
```json
{
  "token": "abc123def456...",
  "password": "NewSecurePass123!",
  "password_confirm": "NewSecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "message": "비밀번호가 변경되었습니다."
}
```

---

### 9. 비밀번호 변경
**POST** `/api/users/password/change/`

로그인한 사용자의 비밀번호 변경

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "old_password": "SecurePass123!",
  "new_password": "NewSecurePass123!",
  "new_password_confirm": "NewSecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "message": "비밀번호가 변경되었습니다."
}
```

---

## 프로필 및 설정

### 10. 프로필 조회
**GET** `/api/users/profile/`

현재 로그인한 사용자의 프로필 조회

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "username": "traveler123",
  "email": "traveler@example.com",
  "nickname": "여행자",
  "birth_year": 1990,
  "country": "USA",
  "city": "New York",
  "phone_number": "+1-123-456-7890",
  "profile_image_url": "https://example.com/profile.jpg",
  "account_status": "ACTIVE",
  "is_email_verified": true,
  "provider_type": "LOCAL",
  "preferences": {
    "language": "ko",
    "currency": "KRW",
    "push_notification": true,
    "email_notification": true
  },
  "date_joined": "2025-12-30T10:00:00Z",
  "last_login": "2025-12-30T12:00:00Z"
}
```

---

### 11. 프로필 수정
**PUT** `/api/users/profile/`

사용자 프로필 정보 수정

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "nickname": "새로운닉네임",
  "country": "Korea",
  "city": "Seoul",
  "phone_number": "+82-10-1234-5678"
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "username": "traveler123",
  "nickname": "새로운닉네임",
  "country": "Korea",
  "city": "Seoul"
}
```

---

### 12. 회원 탈퇴
**DELETE** `/api/users/profile/`

회원 탈퇴 API

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "password": "SecurePass123!",
  "withdrawal_reason": "불만족",
  "withdrawal_detail": "서비스가 기대에 미치지 못함"
}
```

**Response (200 OK):**
```json
{
  "message": "회원 탈퇴가 완료되었습니다."
}
```

---

### 13. 사용자 설정 조회
**GET** `/api/users/preferences/`

사용자 설정 조회

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response (200 OK):**
```json
{
  "language": "ko",
  "currency": "KRW",
  "push_notification": true,
  "email_notification": true,
  "booking_alert": true,
  "schedule_alert": true,
  "flight_alert": true,
  "event_alert": true
}
```

---

### 14. 사용자 설정 수정
**PUT** `/api/users/preferences/`

사용자 설정 변경

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "language": "en",
  "currency": "USD",
  "push_notification": false,
  "email_notification": true
}
```

**Response (200 OK):**
```json
{
  "language": "en",
  "currency": "USD",
  "push_notification": false,
  "email_notification": true
}
```

---

## 메인페이지

### 15. 메인페이지 데이터
**GET** `/api/users/main/`

메인페이지에 표시할 데이터 조회 (인증 선택)

**Headers (선택):**
```
Authorization: Bearer {access_token}
```

**Response (200 OK) - 비인증 사용자:**
```json
{
  "welcome_message": "외국인 관광객을 위한 여행 플랫폼에 오신 것을 환영합니다!",
  "features": [
    {
      "title": "여행지 추천",
      "description": "AI 기반 맞춤형 여행지 추천",
      "icon": "location"
    },
    {
      "title": "여행 일정 생성",
      "description": "자동으로 최적의 여행 일정 생성",
      "icon": "calendar"
    }
  ],
  "popular_destinations": [
    {
      "name": "서울",
      "country": "대한민국",
      "description": "전통과 현대가 공존하는 도시",
      "image_url": "/static/images/seoul.jpg"
    }
  ]
}
```

**Response (200 OK) - 인증된 사용자:**
```json
{
  "welcome_message": "외국인 관광객을 위한 여행 플랫폼에 오신 것을 환영합니다!",
  "user": {
    "username": "traveler123",
    "nickname": "여행자",
    "profile_image": "https://example.com/profile.jpg"
  },
  "personalized": {
    "language": "ko",
    "currency": "KRW"
  },
  "features": [...],
  "popular_destinations": [...]
}
```

---

### 16. 저장된 아이디 확인
**GET** `/api/users/saved-ids/`

현재 디바이스에 저장된 아이디 목록 조회

**Response (200 OK):**
```json
{
  "saved_ids": ["traveler123", "user456"]
}
```

---

## 에러 코드

| HTTP 상태 코드 | 설명 |
|---------------|------|
| 200 OK | 요청 성공 |
| 201 Created | 리소스 생성 성공 (회원가입 등) |
| 400 Bad Request | 잘못된 요청 (유효성 검증 실패) |
| 401 Unauthorized | 인증 실패 |
| 403 Forbidden | 권한 없음 |
| 404 Not Found | 리소스를 찾을 수 없음 |
| 500 Internal Server Error | 서버 오류 |

---

## 인증 방식

JWT (JSON Web Token) 기반 인증을 사용합니다.

### 토큰 사용 방법
```
Authorization: Bearer {access_token}
```

### 토큰 유효기간
- Access Token: 1시간
- Refresh Token: 14일

### 토큰 갱신
액세스 토큰이 만료되면 리프레시 토큰을 사용하여 `/api/users/token/refresh/` 엔드포인트로 새 액세스 토큰을 발급받습니다.

---

## 참고사항

1. 모든 날짜/시간은 ISO 8601 형식 (UTC 기준)을 사용합니다.
2. 이메일 인증 코드는 10분간 유효합니다.
3. 비밀번호 재설정 토큰은 24시간 유효합니다.
4. 로그인 실패 시 로그인 이력에 기록됩니다.
5. 회원 탈퇴 시 계정은 비활성화되며, 탈퇴 기록이 남습니다.
