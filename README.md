# 🇰🇷 Korea Trip - 여행 계획 플랫폼

외국인 관광객을 위한 한국 여행 계획 서비스입니다.  
AI 기반 여행 추천, 일정 관리, 숏폼 콘텐츠, 예약 시스템을 제공합니다.

## 📌 프로젝트 개요

| 구분 | 내용 |
|------|------|
| 프로젝트명 | Korea Trip |
| 개발 기간 | 2025.12 ~ |
| 팀 구성 | Backend, Frontend, AI, DevOps |
| 라이선스 | Apache 2.0 |

## 🏗️ 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    Traefik Ingress                      │
│                  (k3s Load Balancer)                    │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
   ┌─────────┐  ┌──────────┐  ┌──────────┐
   │ React   │  │  Django  │  │ FastAPI  │
   │ Frontend│  │  Backend │  │ AI Server│
   │ :80     │  │  :8000   │  │  :8001   │
   └─────────┘  └──────────┘  └──────────┘
        │             │             │
        └─────────────┴─────────────┘
                      │
               ┌──────┴──────┐
               │ PostgreSQL  │
               │  Database   │
               └─────────────┘
```

## 🛠️ 기술 스택

### Backend
- **Django 6.0** - 사용자 인증, 비즈니스 로직
- **Django REST Framework** - RESTful API
- **FastAPI** - AI 추천 서버
- **PostgreSQL** - 메인 데이터베이스

### Frontend
- **React 19** - SPA 프레임워크
- **Vite 7** - 빌드 도구

### DevOps
- **Docker** - 컨테이너화
- **k3s** - 경량 Kubernetes
- **GitHub Actions** - CI/CD 파이프라인
- **Traefik** - Ingress Controller

## 📁 프로젝트 구조

```
final_repo/
├── django_app/              # Django 백엔드
│   ├── config/              # 프로젝트 설정
│   ├── users/               # 사용자 관리
│   ├── places/              # 장소 정보
│   ├── plans/               # 여행 일정
│   ├── contents/            # 숏폼 콘텐츠
│   ├── reservations/        # 예약 시스템
│   ├── Dockerfile
│   └── requirements.txt
│
├── fastapi_app/             # FastAPI AI 서버
│   ├── main.py
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                # React 프론트엔드
│   ├── src/
│   ├── Dockerfile
│   └── package.json
│
├── k8s/                     # Kubernetes 매니페스트
│   ├── django.yaml
│   ├── fastapi.yaml
│   ├── frontend.yaml
│   └── ingress.yaml
│
└── .github/
    └── workflows/
        └── deploy.yml       # CI/CD 파이프라인
```

## 🗄️ 데이터베이스 구조

### 주요 모델

| 앱 | 모델 | 설명 |
|----|------|------|
| users | User | 사용자 정보 (소셜 로그인 지원) |
| users | UserPreference | 언어, 알림 설정 |
| users | LocalBadge | 현지인 인증 뱃지 |
| places | Place | 장소 정보 (카카오 API 연동) |
| places | PlaceReview | 장소 리뷰 |
| plans | TravelPlan | 여행 일정 |
| plans | TravelPost | 여행기 게시글 |
| contents | Shortform | 숏폼 영상 |
| contents | TranslationEntry | AI 번역 캐시 |
| reservations | Reservation | 예약 정보 |

## 🚀 CI/CD 파이프라인

> ⚠️ **현재 상태 (2025.12.29 기준)**  
> - ✅ CI (Build & Push): **정상 작동** - Docker Hub에 이미지 푸시 성공  
> - ❌ CD (Deploy): **미작동** - EC2 Elastic IP 미설정으로 배포 단계 실패  
> - 📋 TODO: GitHub Secrets에 `EC2_HOST` 등록 필요

```
[GitHub Push (main)]
        │
        ▼
[GitHub Actions 트리거]
        │
        ├── ✅ Django 이미지 빌드 & Docker Hub 푸시
        ├── ✅ FastAPI 이미지 빌드 & Docker Hub 푸시
        └── ✅ Frontend 이미지 빌드 & Docker Hub 푸시
        │
        ▼
[EC2 SSH 접속] ❌ EC2_HOST 미설정
        │
        ▼
[kubectl rollout restart]
        │
        ▼
[배포 완료 🚀]
```

## ⚙️ 로컬 개발 환경 설정

### 사전 요구사항
- Python 3.12+
- Node.js 22+
- Docker & Docker Compose
- Conda (Anaconda 또는 Miniconda) - 선택사항

---

### 방법 1: Conda 사용 (권장)

#### Backend (Django)

```bash
# Conda 환경 생성
conda create -n korea-trip-django python=3.12 -y
conda activate korea-trip-django

# 의존성 설치 및 실행
cd django_app
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

#### Backend (FastAPI)

```bash
# Conda 환경 생성
conda create -n korea-trip-ai python=3.12 -y
conda activate korea-trip-ai

# 의존성 설치 및 실행
cd fastapi_app
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

#### Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

---

### 방법 2: venv 사용

#### Backend (Django)

```bash
cd django_app
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

#### Backend (FastAPI)

```bash
# Conda 환경 생성
conda create -n korea-trip-ai python=3.12 -y
conda activate korea-trip-ai

# 의존성 설치 및 실행
cd fastapi_app
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

#### Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

## 🔐 환경 변수 설정

### GitHub Secrets (CI/CD용)

| Secret 이름 | 설명 |
|-------------|------|
| `DOCKER_USERNAME` | Docker Hub 사용자명 |
| `DOCKER_PASSWORD` | Docker Hub 비밀번호 |
| `EC2_HOST` | EC2 Elastic IP |
| `EC2_USERNAME` | EC2 SSH 사용자명 |
| `EC2_SSH_KEY` | EC2 SSH 개인키 |

### Django 환경 변수 (추가 예정)

```env
SECRET_KEY=your-secret-key
DEBUG=False
DATABASE_URL=postgres://user:pass@host:5432/dbname
ALLOWED_HOSTS=your-domain.com
```

## 📦 필수 OS 패키지 (ffmpeg/ffprobe)
- 영상 메타데이터(duration/width/height) 추출과 썸네일 생성을 위해 ffprobe(=ffmpeg 패키지)이 필요합니다.
- Windows: `winget install --id Gyan.FFmpeg -e --source winget` (또는 `choco install ffmpeg`)
- Ubuntu/Debian: `sudo apt update && sudo apt install -y ffmpeg`
- Amazon Linux 2023/CentOS: `sudo dnf install -y ffmpeg` (또는 `sudo yum install -y ffmpeg`)
- 확인: `ffprobe -version`, `ffmpeg -version`
- 주의: ffmpeg/ffprobe는 Python 패키지가 아니므로 `requirements.txt`에는 포함되지 않으며, 배포 스크립트/서버 프로비저닝 단계에서 OS 패키지로 설치해야 합니다.
- 참고: `pip install Pillow`는 영상 메타데이터(ffprobe) 대체가 불가합니다. 썸네일 후처리 시 이미지를 다루기 위해 선택적으로 추가할 수 있지만, 영상 프레임 추출은 여전히 ffmpeg가 필요합니다.
- 배포 시 환경 변수 설정(필요한 경우 경로 직접 지정 .env에 직접 작성):
  - 예시 (Linux): `FFPROBE_BIN=/usr/bin/ffprobe`, `FFMPEG_BIN=/usr/bin/ffmpeg`
  - 예시 (Windows): `FFPROBE_BIN=C:\Users\...\ffprobe.exe`, `FFMPEG_BIN=C:\Users\...\ffmpeg.exe`
  - OS에 ffmpeg를 설치하고 PATH에 잡히면 env 설정이 없어도 동작하지만, 서비스 실행 계정에서 못 찾을 경우 위 env를 명시합니다.

## 📡 API 엔드포인트

### Ingress 라우팅 규칙

| 경로 | 서비스 | 설명 |
|------|--------|------|
| `/api/ai/*` | FastAPI (8001) | AI 추천 API |
| `/api/*` | Django (8000) | 백엔드 API |
| `/*` | Frontend (80) | React SPA |

## 🧪 테스트

```bash
# Django 테스트
cd django_app
python manage.py test

# Frontend 린트
cd frontend
npm run lint
```

## 📋 향후 개발 계획

- [ ] 환경 변수 분리 (SECRET_KEY 등)
- [ ] Dockerfile 완성 (gunicorn/uvicorn 실행)
- [ ] PostgreSQL 연동
- [ ] CORS 설정
- [ ] API 문서화 (Swagger)
- [ ] 테스트 코드 작성
- [ ] 카카오맵 API 연동
- [ ] AI 여행 추천 기능 구현


## 📄 라이선스

이 프로젝트는 [Apache License 2.0](LICENSE) 라이선스를 따릅니다.


# fastapi ai번역 포트8003번