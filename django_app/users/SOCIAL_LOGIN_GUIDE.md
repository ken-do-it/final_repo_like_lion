# 🔐 소셜 로그인 설정 가이드

Django-allauth를 사용한 Google, Kakao, Naver 소셜 로그인 설정 방법입니다.

## 📦 1. 패키지 설치

```bash
pip install -r requirements.txt
```

필요한 패키지:
- `django-allauth==0.57.0`
- `requests==2.31.0`

## 🗄️ 2. 데이터베이스 마이그레이션

```bash
python manage.py migrate
```

이 명령으로 django-allauth 관련 테이블들이 생성됩니다:
- `django_site`
- `socialaccount_socialapp`
- `socialaccount_socialaccount`
- `socialaccount_socialtoken`

## 🔧 3. 각 소셜 프로바이더 설정

---

### 🔵 Google 소셜 로그인 설정

#### 3.1 Google Cloud Console에서 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. "API 및 서비스" > "OAuth 동의 화면" 이동

#### 3.2 OAuth 동의 화면 설정

- **사용자 유형**: 외부 선택
- **앱 이름**: Korea Travel Guide
- **사용자 지원 이메일**: 본인 이메일
- **승인된 도메인**: localhost (개발) / 실제 도메인 (배포)
- **범위 추가**: `email`, `profile` 선택

#### 3.3 OAuth 클라이언트 ID 만들기

1. "사용자 인증 정보" 탭 이동
2. "+ 사용자 인증 정보 만들기" > "OAuth 클라이언트 ID" 선택
3. 애플리케이션 유형: **웹 애플리케이션**
4. 승인된 리디렉션 URI 추가:
   ```
   http://localhost:8000/api/users/accounts/google/login/callback/
   http://localhost:8000/api/users/social/callback/google/
   ```
5. 생성 후 **클라이언트 ID**와 **클라이언트 보안 비밀** 복사

#### 3.4 Django Admin에서 Social Application 등록

1. Django 서버 실행: `python manage.py runserver`
2. Admin 페이지 접속: `http://localhost:8000/admin/`
3. "Social applications" > "Add social application" 클릭
4. 정보 입력:
   - **Provider**: Google
   - **Name**: Google Login
   - **Client id**: 복사한 클라이언트 ID
   - **Secret key**: 복사한 클라이언트 보안 비밀
   - **Sites**: example.com 선택
5. 저장

---

### 💬 Kakao 소셜 로그인 설정

#### 3.1 Kakao Developers에서 애플리케이션 생성

1. [Kakao Developers](https://developers.kakao.com/) 접속
2. "내 애플리케이션" > "애플리케이션 추가하기"
3. 앱 이름: Korea Travel Guide
4. 생성 후 **앱 키 > REST API 키** 복사

#### 3.2 플랫폼 설정

1. 내 애플리케이션 선택
2. "플랫폼" > "Web 플랫폼 등록"
3. 사이트 도메인:
   ```
   http://localhost:8000
   ```

#### 3.3 Kakao Login 활성화

1. "카카오 로그인" 메뉴
2. "활성화 설정" ON
3. "Redirect URI" 등록:
   ```
   http://localhost:8000/api/users/accounts/kakao/login/callback/
   http://localhost:8000/api/users/social/callback/kakao/
   ```

#### 3.4 동의항목 설정

1. "카카오 로그인" > "동의항목" 탭
2. 필수 동의 항목:
   - 닉네임
   - 이메일

#### 3.5 보안 설정

1. "보안" 탭
2. "Client Secret" 발급
3. **Client Secret** 복사

#### 3.6 Django Admin에서 등록

1. Admin 페이지 > "Social applications" > "Add social application"
2. 정보 입력:
   - **Provider**: Kakao
   - **Name**: Kakao Login
   - **Client id**: REST API 키
   - **Secret key**: Client Secret
   - **Sites**: example.com 선택
3. 저장

---

### 💚 Naver 소셜 로그인 설정

#### 3.1 네이버 개발자 센터에서 애플리케이션 등록

1. [네이버 개발자 센터](https://developers.naver.com/apps/#/register) 접속
2. "애플리케이션 등록" 클릭
3. 정보 입력:
   - **애플리케이션 이름**: Korea Travel Guide
   - **사용 API**: 네이버 로그인
   - **제공 정보**: 이메일, 닉네임, 프로필 사진

#### 3.2 서비스 환경 설정

- **서비스 URL**:
  ```
  http://localhost:8000
  ```
- **Callback URL**:
  ```
  http://localhost:8000/api/users/accounts/naver/login/callback/
  http://localhost:8000/api/users/social/callback/naver/
  ```

#### 3.3 Client ID/Secret 확인

1. 등록 완료 후 **Client ID**와 **Client Secret** 확인
2. 복사해두기

#### 3.4 Django Admin에서 등록

1. Admin 페이지 > "Social applications" > "Add social application"
2. 정보 입력:
   - **Provider**: Naver
   - **Name**: Naver Login
   - **Client id**: Client ID
   - **Secret key**: Client Secret
   - **Sites**: example.com 선택
3. 저장

---

## 🚀 4. 로그인 페이지에 소셜 로그인 버튼 연결

### HTML 버튼 수정 (login.html)

```html
<!-- Google Login -->
<button type="button" class="social-btn google" onclick="window.location.href='/api/users/accounts/google/login/'">
    <span>🔵</span>
    Continue with Google
</button>

<!-- Kakao Login -->
<button type="button" class="social-btn kakao" onclick="window.location.href='/api/users/accounts/kakao/login/'">
    <span>💬</span>
    Continue with Kakao
</button>

<!-- Naver Login -->
<button type="button" class="social-btn naver" onclick="window.location.href='/api/users/accounts/naver/login/'">
    <span>💚</span>
    Continue with Naver
</button>
```

---

## 📱 5. REST API로 소셜 로그인 사용 (모바일/SPA)

프론트엔드에서 직접 소셜 토큰을 받아 백엔드로 전송하는 방식:

### Google 예제

```javascript
// 1. Google OAuth로 토큰 받기 (프론트엔드)
const googleToken = 'google_access_token_from_oauth';

// 2. 백엔드로 토큰 전송
const response = await fetch('http://localhost:8000/api/users/api/social/login/google/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        access_token: googleToken,
        email: 'user@gmail.com',
        name: 'User Name'
    })
});

const data = await response.json();
// data: { access_token, refresh_token, user }
```

### Kakao 예제

```javascript
const kakaoToken = 'kakao_access_token';

const response = await fetch('http://localhost:8000/api/users/api/social/login/kakao/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        access_token: kakaoToken,
        email: 'user@kakao.com',
        name: 'User Name'
    })
});
```

---

## 🔍 6. 테스트

### 6.1 서버 실행

```bash
python manage.py runserver
```

### 6.2 소셜 로그인 테스트

1. 브라우저에서 `http://localhost:8000/api/users/login-page/` 접속
2. 소셜 로그인 버튼 클릭 (Google/Kakao/Naver)
3. 소셜 계정으로 로그인
4. 자동으로 메인 페이지로 리다이렉트
5. JWT 토큰이 localStorage에 저장됨

### 6.3 API 테스트 페이지 사용

```
http://localhost:8000/api/users/api-test/
```

"Social Login" 엔드포인트에서 테스트 가능

---

## ⚠️ 7. 주의사항

### 환경변수 관리

실제 배포 시 Client ID/Secret을 settings.py에 하드코딩하지 말고 환경변수로 관리:

```python
# settings.py
import os

SOCIALACCOUNT_PROVIDERS = {
    'google': {
        'APP': {
            'client_id': os.environ.get('GOOGLE_CLIENT_ID'),
            'secret': os.environ.get('GOOGLE_CLIENT_SECRET'),
        }
    },
    # ...
}
```

### .env 파일 사용

```bash
# .env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_secret
KAKAO_REST_API_KEY=your_kakao_key
KAKAO_CLIENT_SECRET=your_kakao_secret
NAVER_CLIENT_ID=your_naver_id
NAVER_CLIENT_SECRET=your_naver_secret
```

### HTTPS 필수 (배포 시)

실제 서비스 배포 시:
- 반드시 HTTPS 사용
- Redirect URI를 `https://yourdomain.com/...`로 변경
- 소셜 프로바이더 설정에서 도메인 업데이트

---

## 📊 8. 소셜 로그인 플로우

```
[사용자]
   ↓ (1) 소셜 로그인 버튼 클릭
[Django]
   ↓ (2) /accounts/google/login/ 리다이렉트
[Google OAuth]
   ↓ (3) 사용자 인증
[Google OAuth]
   ↓ (4) /accounts/google/login/callback/ 리다이렉트
[Django-allauth]
   ↓ (5) 사용자 생성/조회
[SocialLoginCallbackView]
   ↓ (6) JWT 토큰 생성
[메인 페이지]
   ↓ (7) 로그인 완료
```

---

## 🛠️ 9. 트러블슈팅

### 문제: "Redirect URI mismatch" 에러

**해결**: 소셜 프로바이더 설정에서 Redirect URI 확인
- Google: 정확히 `http://localhost:8000/api/users/accounts/google/login/callback/`
- Kakao: 정확히 `http://localhost:8000/api/users/accounts/kakao/login/callback/`
- Naver: 정확히 `http://localhost:8000/api/users/accounts/naver/login/callback/`

### 문제: Site matching query does not exist

**해결**:
```bash
python manage.py shell
```
```python
from django.contrib.sites.models import Site
site = Site.objects.get_current()
site.domain = 'localhost:8000'
site.name = 'Korea Travel'
site.save()
```

### 문제: Social Application not found

**해결**: Django Admin에서 Social Application을 먼저 등록해야 합니다.

---

## 📚 10. 참고 자료

- [Django-allauth 공식 문서](https://django-allauth.readthedocs.io/)
- [Google OAuth 문서](https://developers.google.com/identity/protocols/oauth2)
- [Kakao Developers](https://developers.kakao.com/)
- [네이버 개발자 센터](https://developers.naver.com/)

---

완료! 이제 소셜 로그인이 정상적으로 작동합니다. 🎉
