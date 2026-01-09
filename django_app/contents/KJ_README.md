
2025-12-30 쇼츠 모델 수정


 완료된 작업

# 1. Shortform 모델 수정 완료
추가된 필드:

- duration (IntegerField) - 영상 길이(초)
- width (IntegerField) - 영상 너비(px)
- height (IntegerField) - 영상 높이(px)
- file_size (BigIntegerField) - 파일 크기(bytes)
- source_lang (VARCHAR 10) - 자동 감지된 언어 코드 (ko, en, ja, etc)

기능:

- FFmpeg로 추출한 영상 메타데이터를 저장
- 업로드 전 검증 및 사용자에게 정보 표시 가능

<br>


# 2. ShortformView 모델 수정 완료
변경 사항:

- user → null=True, blank=True (비로그인 사용자 허용)
- ip_address 필드 추가 (VARCHAR 45)

기능:

- 로그인 사용자: user_id + 시간으로 중복 체크
- 비로그인 사용자: IP 주소 + 시간으로 중복 체크

<br>

# 3. TranslationEntry 모델 대폭 수정 완료
변경 사항:

- GenericForeignKey 제거
- entity_type (VARCHAR 50) 추가 - 'shortform', 'comment' 등
- entity_id (BIGINT) 추가
- field (VARCHAR 100) - 번역할 필드명
- provider (VARCHAR 50, default='nllb') 추가
- model (VARCHAR 100, default='facebook/nllb-200-distilled-600M') 추가
- created_at, last_used_at 추가


기능:

- 어떤 번역 모델을 사용했는지 추적 가능
- 오래된 캐시 정리 가능 (last_used_at 기준)
- 제공하신 스키마와 완벽히 일치





초기 
```
It is impossible to add the field 'created_at' with 'auto_now_add=True' to translationentry without providing a default. This is because the database needs something to populate existing rows.

Provide a one-off default now which will be set on all existing rows
Quit and manually define a default value in models.py.
Select an option: 1
Please enter the default value as valid Python.
Accept the default 'timezone.now' by pressing 'Enter' or provide another value.
The datetime and django.utils.timezone modules are available, so it is possible to provide e.g. timezone.now as a value.
Type 'exit' to exit this prompt
[default: timezone.now] >>> 그냥 엔터
```

두번째

```
It is impossible to add a non-nullable field 'entity_id' to translationentry without specifying a default. This is because the database needs something to populate existing rows.
Please select a fix:
Provide a one-off default now (will be set on all existing rows with a null value for this column)
Quit and manually define a default value in models.py.
Select an option:

1번 선택후  숫자 0 입력
```

세번째
``` 
It is impossible to add a non-nullable field 'entity_type' to translationentry without specifying a default. This is because the database needs something to populate existing rows.
Please select a fix:

Provide a one-off default now (will be set on all existing rows with a null value for this column)
Quit and manually define a default value in models.py.
Select an option:

1번 선택후 "shortform"  입력
```

네번째 
```
It is impossible to add a non-nullable field 'field' to translationentry without specifying a default. This is because the database needs something to populate existing rows.
Please select a fix:

Provide a one-off default now (will be set on all existing rows with a null value for this column)
Quit and manually define a default value in models.py.
Select an option:

1번 선택후  "content"  입력

```


데이터값이 not null 이라서 ...

쉬운방법 

contents/migrations __init__.py 빼고 0001~.py, 0002~.py 들 지우고 다시 
python manage.py makemigrarions 
python manage.py migrate


---

# Shortform API 구현 및 테스트 (2025-12-31)

## 구현 요약
- ViewSet 기반 숏폼 API: `ShortformViewSet`에서 목록/단건/생성 + 커스텀 액션(좋아요/취소/댓글/조회수).
- 업로드: `video_file` multipart/form-data → `media/shortforms/videos/<uuid>.mp4` 저장, `video_url` 자동 세팅. 현재 인증 없음, superuser를 기본 작성자로 사용.
- 좋아요: `POST /api/shortforms/{id}/like/` (중복 방지), 취소: `DELETE /api/shortforms/{id}/unlike/`.
- 댓글: `GET|POST /api/shortforms/{id}/comments/` (content 필수, superuser 작성).
- 조회수: `POST /api/shortforms/{id}/view/` (user 또는 IP 기준 중복 방지).
- Media 설정: `MEDIA_URL=/media/`, `MEDIA_ROOT=BASE_DIR/media`, dev 서버에서 정적 서빙.

## 테스트 커맨드 (로컬)
```
# 업로드
curl -X POST http://127.0.0.1:8000/api/shortforms/ \
  -F "video_file=@/path/to/test.mp4" \
  -F "title=붕어빵" \
  -F "content=길거리 붕어빵" \
  -F "visibility=PUBLIC"

# 목록/단건
curl http://127.0.0.1:8000/api/shortforms/
curl http://127.0.0.1:8000/api/shortforms/1/

# 좋아요/취소
curl -X POST http://127.0.0.1:8000/api/shortforms/1/like/
curl -X DELETE http://127.0.0.1:8000/api/shortforms/1/unlike/

# 댓글 작성/조회
curl -X POST http://127.0.0.1:8000/api/shortforms/1/comments/ \
  -H "Content-Type: application/json" \
  -d "{\"content\": \"댓글 테스트\", \"source_lang\": \"ko\"}"
curl http://127.0.0.1:8000/api/shortforms/1/comments/

# 조회수 기록
curl -X POST http://127.0.0.1:8000/api/shortforms/1/view/
```

## 실제 테스트 결과 (요약)
- 업로드 후 리스트/단건: id=1, `video_url`=/media/shortforms/videos/09c5daf2-22ba-4bc2-bb6e-1d31da4c1a26.mp4
- 좋아요/취소: `{"liked":true,"total_likes":1}` → 취소 후 `{"liked":false,"total_likes":0}`
- 댓글 작성/조회: 댓글 생성 응답(`id`:1, `content`:"댓글 테스트") → 조회 시 리스트에 표시
- 조회수 기록: `{"viewed":true,"total_views":1}` (동일 user/IP로 반복 호출 시 카운트 유지)

## 사용 주의
- ~~인증 미구현: superuser가 반드시 존재해야 하고 기본 작성자로 사용됨.~~ (삭제: 2025-01-09 JWT 인증 및 권한 구현 완료)
- 업로드 실패 시 저장 파일 정리 로직은 생략(개발 편의). 필요 시 추후 정리 추가.

<br>

# 4. Frontend Integration (TestFrontAI) (2025-01-08)
`frontend/src/pages/test_front_ai/` 폴더 내에 구현됨.

### 주요 컴포넌트
- **TestFrontAI.jsx**: 메인 페이지. JWT 로그인 상태 관리(`localStorage`), 언어 설정(`kor_Hang`), API 토큰 검증 로직 포함.
- **ShortsPage.jsx**: 숏폼 리스트 뷰. 무한 스크롤(구현 예정/기본 로드), 썸네일 그리드, 업로드 모달 트리거.
- **ShortsDetailPage.jsx**: 숏폼 상세/재생 뷰.
    - **재생**: `react-player` 사용 (MP4).
    - **수정/삭제**: 본인 글(`ownerId === currentUserId`)인 경우 수정/삭제 버튼 노출.
    - **인라인 수정**: 제목/내용 클릭하여 바로 수정 (`PATCH` 요청).
    - **동영상 교체**: 수정 모드에서 새 파일 선택 시 동영상 파일 교체 지원.
    - **다국어 UI**: `uiGlossary` 매핑을 통해 버튼/라벨 다국어 지원.

### 주요 기능 흐름
1.  **로그인**: `TestFrontAI`에서 토큰 입력 -> `parseJwt`로 검증 -> `localStorage` 저장 -> 하위 컴포넌트에 `accessToken` 전달.
2.  **데이터 동기화**: 수정(PATCH) 성공 시 전체 데이터 다시 Fetch -> 번역 캐시 삭제로 즉시 새 번역 반영.

<br>

# 5. JWT Authentication & Permissions (2025-01-09)
기존의 `superuser` 폴백 로직을 제거하고 표준 JWT 인증을 적용했습니다.

### 백엔드 (`contents/views.py`, `permissions.py`)
- **Permission**: `IsOwnerOrReadOnly`
    - 읽기(`GET`, `HEAD`, `OPTIONS`)는 누구나 가능.
    - 쓰기(`POST`, `PUT`, `PATCH`, `DELETE`)는 **작성자 본인**만 가능.
- **Authentication**: `SimpleJWT` 사용. 요청 헤더에 `Authorization: Bearer <token>` 필수.

### 프론트엔드
- 로그인 유지: 새로고침 해도 `localStorage`에서 토큰을 복구하여 로그인 상태 유지.
- 만료 처리: 앱 시작 시 또는 로그인 시 토큰 만료(`exp`)를 체크하여 자동 로그아웃.



<br>

---

# 리팩토링 보고서: 서비스 레이어(Service Layer) 아키텍처 도입

## 개요 (Introduction)
본 문서는 `contents` 앱의 "뚱뚱한 뷰(Fat View)" 패턴을 "서비스 레이어(Service Layer)" 아키텍처로 리팩토링한 과정을 기록합니다. 이 작업의 목표는 유지보수성 향상, 팀 협업 효율 증대, 그리고 향후 비동기 작업(Celery) 도입을 위한 기반 마련입니다.

## 1. Before: "뚱뚱한 뷰(Fat View)" 패턴
기존의 `views.py`는 너무 많은 책임을 지고 있었습니다. 단순히 HTTP 요청/응답을 처리하는 것을 넘어, 핵심 비즈니스 로직과 저수준 파일 처리까지 모두 담당하고 있었습니다.

### 식별된 핵심 문제점
1.  **관심사 분리(Separation of Concerns) 위반**: `ShortformViewSet` 안에 동영상 파일 IO, `ffprobe` 메타데이터 추출, `ffmpeg` 썸네일 생성, 번역 API 호출 로직이 모두 섞여 있었습니다.
2.  **낮은 재사용성**: 영상 처리 로직이 뷰 메서드(`perform_create` 등) 안에 파묻혀 있어, 다른 곳(예: 관리자 커맨드, 작업 큐)에서 재사용하기 어려웠습니다.
3.  **테스트의 어려움**: 파일 처리 로직 하나를 테스트하려 해도 전체 HTTP 요청 사이클을 모킹(Mocking)해야 했습니다.
4.  **협업 병목 현상**: "영상 처리" 담당 팀원과 "번역" 담당 팀원 모두가 `views.py` 하나만 수정해야 해서 충돌(Conflict) 위험이 매우 높았습니다.

### 코드 지표 (Before)
- **파일**: `django_app/contents/views.py`
- **총 라인 수**: 약 913 줄
- **주요 책임**:
    - HTTP 요청/응답 처리
    - 인증 및 권한 확인
    - 영상 파일 저장 (`save_video_file`)
    - 메타데이터 추출 (`extract_metadata`)
    - 썸네일 생성 (`generate_thumbnail`)
    - 번역 API 호출 (`call_fastapi_translate`)
    - 캐싱 로직 (`translate_and_cache`)

## 2. Plan: 서비스 레이어 아키텍처
"어떻게(How)"에 해당하는 비즈니스 로직을 `views.py`에서 추출하여 전용 **서비스 클래스(Service Class)** 로 옮기고, `views.py`는 "무엇을(What)" 할지 흐름만 제어하도록 변경합니다.

### 새로운 구조
```
django_app/
└── contents/
    ├── services/          # [NEW]
    │   ├── __init__.py
    │   ├── video_service.py      # 영상 IO, FFmpeg, FFprobe 전담
    │   └── translation_service.py # 번역 API 호출, 캐싱 전담
    ├── views.py           # 가벼워진 뷰 (Validation 및 Service 호출만 담당)
    └── ...
```

### 기대 효과
1.  **가벼운 뷰(Thin Views)**: `views.py`는 입력값을 검증하고 `VideoService.process()`나 `TranslationService.translate()`를 호출하는 역할만 수행합니다.
2.  **테스트 용이성**: 서비스 클래스는 HTTP 문맥 없이 독립적으로 단위 테스트(Unit Test)가 가능합니다.
3.  **확장성(Scalability)**: 추출된 서비스 메서드들은 추후 Celery Task(`@shared_task`)로 전환하기에 최적화된 형태입니다.

## 3. 구현 단계 (Implementation Steps)
- [x] `contents/services/__init__.py` 생성
- [x] 영상 처리 로직을 `contents/services/video_service.py`로 추출
- [x] 번역 로직을 `contents/services/translation_service.py`로 추출
- [x] `views.py`가 서비스 레이어를 사용하도록 리팩토링
- [x] 기능 정상 동작 검증

## 4. After: 결과 (Results)
리팩토링이 완료되었습니다. "뚱뚱한 뷰"가 성공적으로 뷰 레이어와 서비스 레이어로 분리되었습니다.

### 코드 지표 (After)
- **파일**: `django_app/contents/views.py`
- **총 라인 수**: 약 400 줄 (**56% 감소**)
- **개선 사항**:
    - `views.py`는 이제 파라미터 파싱과 서비스 호출만 담당합니다.
    - 영상 처리 로직이 `VideoService`로 격리되었습니다.
    - 번역/캐싱 로직이 `TranslationService`로 재사용 가능해졌습니다.

### 포트폴리오 비교 (Before vs After)
| 특징 | Before (Fat View) | After (Service Layer) |
| :--- | :--- | :--- |
| **로직 위치** | 모든 로직이 `views.py`에 혼재 | `services/video_service.py`, `services/translation_service.py`로 분리 |
| **영상 업로드 코드** | HTTP 로직과 섞인 약 50줄 | `VideoService.save_video_file(file)` (뷰에서는 1줄) |
| **번역 로직** | 약 100줄의 헬퍼 함수들 | `TranslationService.translate(...)` |
| **팀 협업 충돌 위험** | 높음 (모두가 `views.py` 수정) | 낮음 (도메인별로 파일 분리됨) |
| **비동기 큐 전환 용이성** | 어려움 | 매우 쉬움 (서비스 메서드에 `@shared_task`만 붙이면 됨) |

### 향후 계획 (Next Steps)
1.  **수동 검증**: 프론트엔드를 통해 업로드 및 번역 기능이 여전히 잘 동작하는지 확인.
2.  **인프라 구축**: Redis 및 Celery 설치.
3.  **비동기 전환**: `VideoService`의 메서드들을 Celery 비동기 작업으로 전환하여 사용자 응답 속도 개선.