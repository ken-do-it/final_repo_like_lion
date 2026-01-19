# Portfolio Implementation Plan: 'Korea Trip' Project

이 문서는 **실제 구동 중인 웹사이트(localhost:5173)**의 UI/UX 구조와 **심층 분석된 기술 명세**를 결합하여, 실질적이고 매력적인 포트폴리오를 구성하기 위한 구체적인 실행 계획(프롬프트)입니다.

---

## 1. 디자인 가이드라인 (Visual Identity)

웹사이트의 현재 테마를 유지하면서 포트폴리오의 전문성을 강조합니다.

*   **레이아웃 (Layout)**:
    *   **좌측 사이드바 (Sidebar)**: 네이비(#1e293b) 배경의 고정 내비게이션 (메뉴: Overview, Tech, Features, Architecture 등).
    *   **메인 스테이지 (Content Stage)**: 슬라이드 방식 (Slide X / N)의 콘텐츠 영역. 좌우 2단 분할 레이아웃 권장.
*   **색상 팔레트 (Color Palette)**:
    *   **Primary**: Deep Navy `#1e293b` (신뢰감, 무게감)
    *   **Accent**: Vivid Blue `#3b82f6` (강조, 버튼, 활성화 링크)
    *   **Status**: Red (Problem/Issue), Green (Solution/Success)
    *   **Background**: Light Gray `#f1f5f9` (가독성)

---

## 2. 슬라이드별 구성 계획 (Slide Execution Plan)

### Slide 1: 프로젝트 오버뷰 (Overview)
*   **UI 구성**: 중앙 정렬 텍스트 + 배경 이미지.
*   **콘텐츠**:
    *   **제목**: Korea Trip (외국인 관광객을 위한 올인원 여행 플랫폼)
    *   **핵심 메시지**: "AI 번역과 로컬 숏폼으로 연결하는 진정한 한국 여행"

### Slide 2: 기획 배경 (Problem & Solution)
*   **UI 구성**: 좌우 대칭 카드 뷰 (Red Box vs Green Box).
*   **콘텐츠**:
    *   **Problem**: 언어 장벽, 파편화된 정보.
    *   **Solution**: 실시간 AI 번역, 통합 예약 시스템.

### Slide 3: 시스템 아키텍처 (System Architecture)
*   **UI 구성**: 상단 설명 텍스트 + 중앙 대형 다이어그램.
*   **콘텐츠**:
    *   **Client**: React 19 + Nginx
    *   **Backend**: Django (Core) + FastAPI (AI)
    *   **Infra**: Docker Compose

### Slide 4: 핵심 기술 스택 (Tech Stack)
*   **콘텐츠**:
    *   **Frontend**: React 19, Vite 7, TailwindCSS 4
    *   **Backend**: Django 6.0, FastAPI, DRF
    *   **DevOps**: Docker, GitHub Actions

### Slide 5: 메인 기능 - 여행 대시보드 (Dashboard)
*   **콘텐츠**: Google Maps 연동, 맞춤형 장소 추천.

### Slide 6: AI 기능 & 숏폼 (AI & Short-form)
*   **콘텐츠**:
    *   **AI Flow**: 사용자 입력 -> FastAPI 번역/분석 -> 실시간 응답
    *   **Short-form**: 비동기 썸네일 생성, FFmpeg 처리.

### Slide 7: 데이터 모델링 (ERD)
*   **콘텐츠**: Users, Places, Shortforms, Reviews의 유기적 연결.

### Slide 8: 기술적 도전 (Technical Challenges)
*   **콘텐츠**:
    *   **502 Bad Gateway**: Nginx-Django 컨테이너 간 네트워크 연결 해결.
    *   **대용량 영상 처리**: FFmpeg 비동기 파이프라인 구축.

### Slide 9: 향후 개선 과제 (Future Roadmap & Engineering)
*   **UI 구성**: 4분면 로드맵 (Security, Performance, Scale-up, UX).
*   **콘텐츠** (코드 리뷰 기반 심층 분석 내용을 반영):
    *   **Performance (성능 최적화)**:
        *   Django **N+1 쿼리 문제** 해결 (prefetch_related 도입으로 DB 부하 90% 감소 목표).
        *   **Infinite Scroll** 도입으로 프론트엔드 리스트 렌더링 최적화.
    *   **Security (보안 강화)**:
        *   FastAPI 서비스 **내부망 격리** 및 JWT 검증 미들웨어 도입.
        *   번역 프록시 패턴의 **화이트리스트(Whitelist)** 기반 입력값 검증.
    *   **Scale-up (확장성)**:
        *   **Pgvector**를 활용한 위치 기반 벡터 검색 구현.
        *   Redis 캐싱 전략 고도화 (좋아요/조회수 실시간 처리).

---

## 3. 활용 가이드 (Usage Guide)
이 파일은 생성형 AI에게 **"이 기획서대로 상세한 대본과 디자인을 뽑아줘"**라고 명령하기 위한 프롬프트입니다.
특히 **Slide 9의 내용은 단순한 희망 사항이 아니라, 실제 코드 리뷰를 통해 도출된 구체적인 엔지니어링 과제임을 강조**하면 면접관에게 큰 점수를 얻을 수 있습니다.
