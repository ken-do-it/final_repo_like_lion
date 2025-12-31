
2025-12-30 쇼츠 모델 수정


 완료된 작업

# 1. Shortform 모델 수정 완료
추가된 필드:

- duration (IntegerField) - 영상 길이(초)
- width (IntegerField) - 영상 너비(px)
- height (IntegerField) - 영상 높이(px)
- file_size (BigIntegerField) - 파일 크기(bytes)

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
- 인증 미구현: superuser가 반드시 존재해야 하고 기본 작성자로 사용됨.
- 업로드 실패 시 저장 파일 정리 로직은 생략(개발 편의). 필요 시 추후 정리 추가.


