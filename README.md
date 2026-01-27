# ✈️ Tripko - 외국인 관광객을 위한 올인원 AI 여행 플랫폼

https://tripko.p-e.kr/

Tripko는 한국을 방문하는 외국인 관광객들이 언어 장벽과 정보 부족 없이 여행을 즐길 수 있도록 돕는 AI 기반의 올인원 여행 플랫폼입니다.

복잡한 여행 계획을 AI가 자동으로 생성해주고, 실시간 번역, 숙소/교통 예약, 그리고 현지인(Local)이 추천하는 찐 맛집 정보를 제공합니다.

---

## 🏗️ 시스템 아키텍처

Tripko는 기능별로 최적화된 프레임워크를 사용하는 **마이크로서비스 지향 아키텍처(MSA-like)**로 설계되었습니다. 모든 서비스는 Docker Container로 패키징되어 유기적으로 연결됩니다.

### 🧩 서비스 구성

| 서비스명 | 포트 | 기술 스택 | 역할 및 기능 |
|---------|------|----------|-------------|
| Frontend | 80/443 | React (Vite), Tailwind | 사용자 인터페이스, 반응형 웹 (Nginx 서빙) |
| Main Backend | 8000 | Django REST Framework | 유저 인증, 여행 계획 관리, 예약 시스템, 숏폼 콘텐츠 |
| AI Server | 8001 | FastAPI | AI 여행 일정 생성, 여행지 추천 로직 처리 |
| Places Server | 8002 | FastAPI | 고성능 장소 검색, 필터링, 로드뷰 게임, 숙소 정보 |
| Translation | 8003 | FastAPI | 실시간 다국어 AI 번역 서비스 |
| Database | 5432 | PostgreSQL (pgvector) | 관계형 데이터 및 벡터(임베딩) 데이터 저장 |
| Infra/Monitoring | - | Docker, Nginx, Prometheus | 컨테이너 오케스트레이션, 로드밸런싱, 시스템 모니터링 |

---

## ✨ 주요 기능

### 1. 🤖 AI 맞춤형 여행 플래너
- **샌드박스 스타일 계획**: 블록 코딩처럼 여행지를 드래그 앤 드롭하여 자유롭게 일정을 구성
- **AI 자동 생성**: 사용자의 취향, 예산, 기간을 입력하면 최적의 동선을 고려한 여행 계획을 자동으로 생성
- **협업 기능**: 친구를 초대하여 실시간으로 일정을 함께 수정

### 2. 📍 스마트 장소 검색 & 로컬 가이드
- **현지인 뱃지 시스템**: 현지인이 인증한 '찐 맛집' 정보 제공
- **로드뷰 게임**: GeoGuessr 스타일의 위치 추측 게임 (아래 상세 설명)
- **초고속 검색**: FastAPI의 비동기 처리를 활용한 빠른 장소 검색 및 필터링

### 🎮 로드뷰 게임 (Roadview Game)
 GeoGuessr에서 영감을 받은 위치 추측 게임으로, 사용자가 업로드한 여행 사진이나 리뷰 사진을 기반으로 한국의 다양한 장소를 탐험합니다.

### 3. 🗣️ 실시간 AI 번역
- **다국어 지원**: 한국어, 영어, 중국어, 일본어 간의 실시간 텍스트/음성 번역
- **여행 특화 모델**: 여행 상황(주문, 길 찾기 등)에 최적화된 번역 결과

### 4. 🚆 원스톱 예약 시스템
- **교통/숙소 통합**: KTX(기차), 항공권, 지하철 경로 검색 및 예약을 플랫폼 내에서 해결
- **결제 연동**: 토스 페이먼츠(Toss Payments) 등을 연동한 간편 결제

### 5. 🎬 여행 커뮤니티 & 숏폼
- **숏폼 공유**: 틱톡/릴스 스타일의 짧은 여행 영상을 공유하고 위치 정보 태그
- **유저 소셜**: 팔로우, 좋아요, 댓글을 통해 전 세계 여행자들과 소통

---

## 🛠️ 기술 스택

### Frontend
- **Core**: React 18, Vite
- **Styling**: Tailwind CSS, PostCSS
- **State/API**: Axios, Context API
- **Maps**: Google Maps API, Kakao Map API

### Backend
- **Django + DRF**: 안정적인 데이터 모델링 및 비즈니스 로직 (User, Payment)
- **FastAPI**: 고성능 비동기 처리 및 AI 모델 서빙 (Search, AI)
- **Database**: PostgreSQL 16 (with pgvector extension for AI embeddings)
- **AI/ML**: OpenAI API, PyTorch (Vector Search)

### DevOps & Infrastructure
- **Container**: Docker, Docker Compose
- **CI/CD**: GitHub Actions
- **Server**: AWS EC2 (Ubuntu)
- **Web Server**: Nginx (Reverse Proxy & Static Serving)
- **Monitoring**: Prometheus, Grafana

---

## 💾 데이터베이스 설계

PostgreSQL을 단일 진실 공급원(Single Source of Truth)으로 사용하며, 주요 테이블 구조는 다음과 같습니다.

- **Users**: 사용자 정보, 인증, 국적, 선호 언어/화폐, 소셜 로그인 정보
- **Plans**: 여행 일정(마스터), 세부 일정(디테일), AI 요청 로그
- **Places**: 관광지/맛집 정보, 위경도, 카테고리, 벡터 임베딩(추천용)
- **Contents**: 숏폼 비디오, 썸네일, 해시태그
- **Reservations**: 항공/기차/숙소 예약 내역, 결제 상태

---

## 🚀 설치 및 실행 방법

### 사전 요구사항
- Docker & Docker Compose가 설치되어 있어야 합니다.
- 프로젝트 루트에 `.env` 파일이 필요합니다.

### 1. 레포지토리 클론
```bash
git clone https://github.com/w-a-s-a-n-s/final_repo.git
cd final_repo
```

### 2. 환경 변수 설정
`.env.example` 파일을 복사하여 `.env`를 생성하고 필요한 키 값을 입력합니다.
```bash
cp .env.example .env
# .env 파일 내 DB_PASSWORD, SECRET_KEY, API_KEY 등을 수정하세요.
```

### 3. 서비스 실행 (Docker Compose)
모든 마이크로서비스를 한 번에 실행합니다.
```bash
docker-compose up -d --build
```

### 4. 접속 주소
| 서비스 | URL |
|--------|-----|
| Frontend | http://localhost:80 |
| Backend API | http://localhost:8000/api/ |
| Swagger Docs (Main) | http://localhost:8000/swagger/ |
| Swagger Docs (Places) | http://localhost:8002/docs/ |
| Grafana | http://localhost:3000/ |

---

## 🔄 CI/CD 파이프라인

GitHub Actions를 사용하여 `develop` 브랜치에 푸시될 때마다 자동 배포가 이루어집니다.

1. **Trigger**: `develop` 브랜치에 코드가 push 됨
2. **Build & Push**:
   - Django, FastAPI(AI/Places/Translation), Frontend(React) 이미지를 각각 빌드
   - Docker Hub(`wasanssss/korea-trip-*`) 레지스트리에 이미지 업로드
3. **Deploy**:
   - AWS EC2 서버에 SSH로 접속
   - 최신 `docker-compose.yaml` 및 코드를 `git pull`
   - `docker compose pull`로 최신 이미지를 받아오고 컨테이너 재시작

---

## 📡 API 문서

본 프로젝트는 RESTful API 원칙을 따릅니다. 상세 문서는 각 서버의 Swagger/Redoc을 참고하세요.

### 🔐 Users (Django)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users/register/` | 회원가입 |
| POST | `/api/users/login/` | 로그인 (JWT 발급) |
| GET | `/api/users/profile/` | 프로필 조회 |

### 🗺️ Places (FastAPI)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/places/search?q={query}` | 장소 키워드 검색 |
| GET | `/api/places/{id}/detail` | 장소 상세 정보 및 리뷰 |

### 📅 Plans (AI & Django)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/plans/generate` | AI 여행 일정 생성 요청 |
| GET | `/api/plans/my` | 내 여행 일정 목록 조회 |

### 🗣️ Translation (FastAPI)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/translate` | 텍스트 번역 요청 |

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
