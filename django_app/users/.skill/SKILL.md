# 프로젝트 기술 스택 및 개발 가이드

## 프로젝트 개요
외국인 관광객을 위한 여행지 추천 및 예약 플랫폼 (Triple 스타일)

## 기술 스택

### Backend
- **Framework**: Django 6.0
- **API**: Django REST Framework
- **Database**: SQLite (개발), PostgreSQL/MySQL (프로덕션 권장)
- **Authentication**: JWT (JSON Web Token)
- **CORS**: django-cors-headers

### 주요 기능
1. 사용자 인증 (로그인/회원가입)
   - 일반 로그인 (이메일/비밀번호)
   - 소셜 로그인 (Google, Kakao, Naver)
   - JWT 기반 인증
   - 리프레시 토큰

2. 여행지 추천
3. 여행 일정 생성
4. 교통 예약
5. 현지인 뱃지 시스템

## 데이터베이스 구조

### Users App (로그인/메인페이지 담당)

#### 1. users (사용자 기본 정보)
- AbstractUser 상속
- 소셜 로그인 지원 (LOCAL, GOOGLE, KAKAO, NAVER)
- 계정 상태 관리 (ACTIVE, SUSPENDED, DELETED)
- 프로필 정보 (nickname, country, city, profile_image_url)

#### 2. user_preferences (사용자 설정)
- 언어/통화 설정
- 알림 설정 (push, email, booking, schedule, flight, event)

#### 3. email_verifications (이메일 인증)
- 회원가입, 아이디 찾기, 비밀번호 찾기 용도

#### 4. password_reset_tokens (비밀번호 재설정)
- 토큰 기반 비밀번호 재설정

#### 5. login_sessions (로그인 세션)
- JWT 세션 토큰 관리
- 리프레시 토큰
- 디바이스 정보 및 IP 추적
- 자동 로그인 지원

#### 6. login_history (로그인 이력)
- 로그인 성공/실패 기록
- 보안 모니터링

#### 7. saved_ids (아이디 저장)
- 디바이스별 아이디 저장 기능

#### 8. user_withdrawal (회원 탈퇴 기록)
- 탈퇴 사유 및 상세 정보

#### 9. local_badges (현지인 인증 뱃지)
- 도시별 현지인 인증
- 레벨 시스템 (1-5)
- 인증 유지 관리

## API 엔드포인트 설계

### 인증 API
```
POST   /api/users/register/          # 회원가입
POST   /api/users/login/             # 로그인
POST   /api/users/logout/            # 로그아웃
POST   /api/users/token/refresh/     # 토큰 갱신
POST   /api/users/verify-email/      # 이메일 인증
POST   /api/users/send-verification/ # 인증 코드 발송
```

### 비밀번호 관리
```
POST   /api/users/password/reset/request/  # 비밀번호 재설정 요청
POST   /api/users/password/reset/confirm/  # 비밀번호 재설정 확인
POST   /api/users/password/change/         # 비밀번호 변경
```

### 사용자 프로필
```
GET    /api/users/profile/           # 프로필 조회
PUT    /api/users/profile/           # 프로필 수정
DELETE /api/users/profile/           # 회원 탈퇴
```

### 설정
```
GET    /api/users/preferences/       # 설정 조회
PUT    /api/users/preferences/       # 설정 수정
```

### 소셜 로그인
```
POST   /api/users/social/google/     # Google 로그인
POST   /api/users/social/kakao/      # Kakao 로그인
POST   /api/users/social/naver/      # Naver 로그인
```

### 메인페이지
```
GET    /api/main/                    # 메인페이지 데이터
GET    /api/main/recommendations/    # 추천 여행지
GET    /api/main/popular/            # 인기 여행지
```

## 보안 고려사항

1. **비밀번호**
   - Django의 기본 해싱 (PBKDF2)
   - 최소 8자 이상, 복잡도 검증

2. **JWT 토큰**
   - Access Token: 1시간 유효
   - Refresh Token: 14일 유효
   - HttpOnly 쿠키 사용 권장

3. **이메일 인증**
   - 6자리 랜덤 코드
   - 10분 유효기간

4. **로그인 보안**
   - 실패 이력 기록
   - IP 및 디바이스 추적
   - 다중 세션 관리

## 개발 가이드

### 환경 설정
```bash
# 가상환경 생성
python -m venv venv

# 가상환경 활성화 (Windows)
venv\Scripts\activate

# 가상환경 활성화 (Linux/Mac)
source venv/bin/activate

# 패키지 설치
pip install -r requirements.txt

# 마이그레이션
python manage.py makemigrations
python manage.py migrate

# 슈퍼유저 생성
python manage.py createsuperuser

# 개발 서버 실행
python manage.py runserver
```

### 코드 스타일
- PEP 8 준수
- Django 네이밍 컨벤션 따르기
- Docstring 작성 권장

### 테스트
```bash
# 전체 테스트
python manage.py test

# 특정 앱 테스트
python manage.py test users
```

## 배포

### 환경 변수 (.env)
```
SECRET_KEY=your-secret-key
DEBUG=False
ALLOWED_HOSTS=your-domain.com
DATABASE_URL=your-database-url
JWT_SECRET_KEY=your-jwt-secret
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email
EMAIL_HOST_PASSWORD=your-password
```

### Docker
```bash
# 이미지 빌드
docker build -t travel-platform .

# 컨테이너 실행
docker run -p 8000:8000 travel-platform
```

## 다음 단계

1. JWT 인증 설정 완료
2. 회원가입/로그인 API 구현
3. 이메일 인증 기능 구현
4. 소셜 로그인 연동
5. 메인페이지 API 구현
6. 프론트엔드 연동
7. 테스트 코드 작성
8. 프로덕션 배포

## 참고 문서
- Django 공식 문서: https://docs.djangoproject.com/
- DRF 공식 문서: https://www.django-rest-framework.org/
- JWT 인증: https://django-rest-framework-simplejwt.readthedocs.io/
