
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



