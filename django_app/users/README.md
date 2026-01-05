# Users App - 로그인 및 메인페이지

외국인 관광객을 위한 여행 플랫폼의 사용자 인증 및 메인페이지를 담당하는 Django 앱입니다.

## 목차
- [프로젝트 구조](#프로젝트-구조)
- [주요 기능](#주요-기능)
- [설치 및 실행](#설치-및-실행)
- [API 문서](#api-문서)
- [데이터베이스 모델](#데이터베이스-모델)

---

## 프로젝트 구조

```
users/
├── models.py              # 데이터베이스 모델
├── serializers.py         # DRF Serializers
├── views.py              # API Views
├── urls.py               # URL 라우팅
├── authentication.py     # JWT 인증 클래스
├── utils.py              # 유틸리티 함수
├── admin.py              # Django Admin 설정
├── API_DOCUMENTATION.md  # API 상세 문서
├── README.md             # 이 파일
└── .skill/
    └── skill.md          # 기술 스택 가이드
```

---

## 주요 기능

### 1. 사용자 인증
- ✅ 회원가입 (이메일 인증)
- ✅ 로그인 (JWT 토큰 발급)
- ✅ 로그아웃 (세션 삭제)
- ✅ 토큰 갱신 (Refresh Token)
- ✅ 아이디 저장 (디바이스별)

### 2. 소셜 로그인 지원
- Google OAuth
- Kakao Login
- Naver Login
※ 소셜 로그인 구현은 향후 추가 예정

### 3. 이메일 인증
- 회원가입 인증
- 아이디 찾기
- 비밀번호 찾기

### 4. 비밀번호 관리
- 비밀번호 재설정 (이메일 링크)
- 비밀번호 변경 (로그인 후)
- 임시 비밀번호 발급

### 5. 프로필 관리
- 프로필 조회/수정
- 회원 탈퇴
- 계정 상태 관리

### 6. 사용자 설정
- 언어 설정 (다국어 지원)
- 통화 설정
- 알림 설정 (푸시, 이메일, 예약 등)

### 7. 메인페이지
- 비인증 사용자: 일반 추천
- 인증된 사용자: 개인화된 추천
- 인기 여행지 표시

### 8. 보안 기능
- 로그인 이력 기록
- IP 주소 추적
- 디바이스 정보 저장
- 세션 관리

---

## 설치 및 실행

### 1. 필수 패키지 설치
```bash
cd /mnt/c/Users/우창호/workspaces/last_project/django_app
pip install -r requirements.txt
```

### 2. 데이터베이스 마이그레이션
```bash
python manage.py makemigrations
python manage.py migrate
```

### 3. 슈퍼유저 생성
```bash
python manage.py createsuperuser
```

### 4. 개발 서버 실행
```bash
python manage.py runserver
```

서버가 실행되면 다음 주소로 접속할 수 있습니다:
- API: http://localhost:8000/api/users/
- Admin: http://localhost:8000/admin/

---

## API 문서

상세한 API 문서는 [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)를 참조하세요.

### 주요 엔드포인트

#### 인증
- `POST /api/users/register/` - 회원가입
- `POST /api/users/login/` - 로그인
- `POST /api/users/logout/` - 로그아웃
- `POST /api/users/token/refresh/` - 토큰 갱신

#### 프로필
- `GET /api/users/profile/` - 프로필 조회
- `PUT /api/users/profile/` - 프로필 수정
- `DELETE /api/users/profile/` - 회원 탈퇴

#### 설정
- `GET /api/users/preferences/` - 설정 조회
- `PUT /api/users/preferences/` - 설정 수정

#### 메인페이지
- `GET /api/users/main/` - 메인페이지 데이터
- `GET /api/users/saved-ids/` - 저장된 아이디 목록

---

## 데이터베이스 모델

### User (사용자)
- Django AbstractUser 상속
- 소셜 로그인 지원 (provider_type)
- 계정 상태 관리 (account_status)

### UserPreference (사용자 설정)
- User와 1:1 관계
- 언어, 통화, 알림 설정

### EmailVerification (이메일 인증)
- 6자리 인증 코드
- 10분 유효기간

### PasswordResetToken (비밀번호 재설정)
- 토큰 기반 재설정
- 24시간 유효기간

### LoginSession (로그인 세션)
- JWT 토큰 저장
- 디바이스 정보 추적

### LoginHistory (로그인 이력)
- 성공/실패 기록
- 보안 모니터링

### SavedId (저장된 아이디)
- 디바이스별 아이디 저장

### UserWithdrawal (회원 탈퇴)
- 탈퇴 사유 기록

### LocalBadge (현지인 뱃지)
- 도시별 현지인 인증
- 레벨 시스템 (1-5)

---

## 환경 설정

### Django Settings (config/settings.py)

```python
# JWT 설정
JWT_SECRET_KEY = SECRET_KEY
JWT_ALGORITHM = 'HS256'
JWT_ACCESS_TOKEN_LIFETIME = 60 * 60  # 1시간
JWT_REFRESH_TOKEN_LIFETIME = 60 * 60 * 24 * 14  # 14일

# 이메일 설정
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True

# CORS 설정
CORS_ALLOW_ALL_ORIGINS = True  # 개발용
CORS_ALLOW_CREDENTIALS = True
```

---

## 보안 고려사항

### 1. 비밀번호
- Django 기본 해싱 (PBKDF2) 사용
- 최소 8자 이상, 복잡도 검증
- 임시 비밀번호 플래그 관리

### 2. JWT 토큰
- Access Token: 1시간 유효
- Refresh Token: 14일 유효
- 서버 측 세션 관리

### 3. 이메일 인증
- 6자리 랜덤 숫자
- 10분 유효기간
- 재발송 시 기존 코드 삭제

### 4. 로그인 보안
- 실패 이력 자동 기록
- IP 주소 추적
- 디바이스 정보 저장

---

## 테스트

```bash
# 전체 테스트
python manage.py test users

# 특정 테스트
python manage.py test users.tests.TestLoginView
```

---

## 향후 개선사항

### 단기
- [ ] 소셜 로그인 연동 (Google, Kakao, Naver)
- [ ] 이메일 템플릿 개선
- [ ] 프로필 이미지 업로드
- [ ] 테스트 코드 작성

### 중기
- [ ] 2단계 인증 (2FA)
- [ ] 로그인 보안 강화 (계정 잠금 등)
- [ ] API Rate Limiting
- [ ] 다국어 지원 완성

### 장기
- [ ] Redis 세션 스토어
- [ ] 웹소켓 알림
- [ ] SSO (Single Sign-On)
- [ ] OAuth 2.0 서버 구축

---

## 문의 및 기여

이 프로젝트는 외국인 관광객을 위한 여행 플랫폼의 일부입니다.

### 팀 역할
- **로그인/메인페이지**: 현재 담당자
- **여행지 추천**: places 앱
- **여행 일정**: plans 앱
- **예약 시스템**: reservations 앱
- **콘텐츠 관리**: contents 앱

---

## 라이선스

이 프로젝트는 교육 목적으로 작성되었습니다.
