# Docker PostgreSQL 데이터베이스 초기화 가이드

데이터베이스를 초기화하는 것은 **저장된 모든 데이터를 영구적으로 삭제**하는 작업입니다. 주의해서 진행해 주세요.

## 방법 1: 데이터베이스만 안전하게 초기화 (추천 ⭐)
> 방금 설정한 AI 모델 캐시(`huggingface_cache`)는 지키고, DB만 날리는 방법입니다.

1.  **컨테이너 중지**
    ```bash
    docker-compose down
    ```

2.  **데이터베이스 볼륨만 삭제**
    (프로젝트 폴더 이름에 따라 볼륨 이름 앞에 접두사가 붙을 수 있습니다. `docker volume ls`로 확인 가능합니다.)
    ```bash
    # 볼륨 이름 확인
    docker volume ls 
    
    # 예: 폴더명이 final_project_oneC라면
    docker volume rm final_project_onec_postgres_data
    ```

3.  **다시 시작 (자동으로 DB 재생성)**
    ```bash
    docker-compose up --build -d
    ```

---

## 방법 2: 모든 것을 초기화 (강력 초기화 💥)
> **주의:** 이 방법은 다운로드 받은 **8GB AI 모델 파일도 함께 삭제**됩니다. 다시 다운로드하려면 시간이 걸립니다.

명령어 한 방으로 컨테이너와 **모든 볼륨(DB + AI캐시)** 을 삭제합니다.

```bash
docker-compose down -v
```
*(옵션 `-v`는 Volumes를 함께 삭제하라는 뜻입니다)*

이후 다시 시작:
```bash
docker-compose up --build -d
```

---

### 💡 중요: 초기화 후 '마이그레이션' 필수!
데이터베이스가 텅 비었으므로, 테이블을 다시 만들어주는 **마이그레이션 작업**을 반드시 해야 합니다.

`docker-compose up`으로 서버를 켠 후, **새로운 터미널**에서 아래 명령어를 실행하세요:

1.  **테이블 생성 (Migrate)**
    ```bash
    docker-compose exec django python manage.py migrate
    ```

2.  **관리자 계정 생성 (Superuser)**
    ```bash
    docker-compose exec django python manage.py createsuperuser
    ```

이 두 가지를 해야 정상적으로 로그인하고 기능을 사용할 수 있습니다!

