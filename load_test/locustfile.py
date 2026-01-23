import random
import time
from locust import HttpUser, task, between
from locust.exception import StopUser

# 이미지나 파일 업로드 시미를 위한 더미 데이터 생성 함수
def create_dummy_image():
    return ("test.jpg", b"dummy_content", "image/jpeg")

class TripUser(HttpUser):
    # 각 유저(User)가 작업(Task)을 실행하는 대기 시간 (1초~3초 랜덤)
    wait_time = between(1, 3)

    # 1. 사이트 접속 및 헤더 설정 (로그인 시뮬레이션은 필요 시 on_start에서 구현)
    # 1. 사이트 접속 및 헤더 설정 (로그인 시뮬레이션)
    def on_start(self):
        # [수정] 50명이 동시에 로그인하면 DB Lock이나 서버 과부하로 500 에러 발생함
        # 이를 방지하기 위해 각 유서가 0.1~5초 사이로 랜덤하게 대기 후 로그인 시작
        time.sleep(random.uniform(0.1, 5.0))

        # 1. 로그인 요청 (Prefix: /api)
        response = self.client.post("/api/users/login/", json={
            "username": "계정 ID",
            "password": "계정 비밀번호"
        })
        
        if response.status_code == 200:
            token = response.json().get("access_token")
            if token:
                # [수정] self.headers 변수가 아닌 self.client.headers에 직접 업데이트해야 세션이 유지됨
                self.client.headers.update({"Authorization": f"Bearer {token}"})
                print(f"Login success! Token set for user.")
            else:
                print("Login successful but no token found")
                self.environment.runner.quit()
        else:
            print(f"Login failed: {response.status_code} - {response.text}")
            raise StopUser()

    # ----------------------------------------------------------------
    # 시나리오 1: 리뷰 남기기 (AI 번역 유발) -> FastAPI (Prefix: /api/v1)
    # ----------------------------------------------------------------
    @task(2)  # 가중치 2: 다른 작업보다 2배 자주 실행
    def leave_review(self):
        place_id = random.randint(1, 100) # 랜덤 장소 ID
        review_data = {
            "place_id": place_id,
            "content": "정말 멋진 곳이네요! 강추합니다. Great place!",
            "rating": 5
        }
        # FastAPI 엔드포인트: /api/v1/places/{place_id}/reviews
        self.client.post(f"/api/v1/places/{place_id}/reviews", data=review_data)

    # ----------------------------------------------------------------
    # 시나리오 2: 칼럼 작성 (AI 번역 유발 가능) -> FastAPI (Prefix: /api/v1)
    # ----------------------------------------------------------------
    @task(1)
    def write_column(self):
        # FastAPI 엔드포인트: /api/v1/places/local-columns
        
        # 더미 파일
        files = {
            "thumbnail": ("thumb.jpg", b"dummy_img_bytes", "image/jpeg")
        }
        
        column_data = {
            "title": f"서울 여행 꿀팁 {random.randint(1, 1000)}",
            "content": "서울의 숨겨진 명소를 소개합니다. 먼저...",
            "sections": '[]' # JSON String for sections
        }
        self.client.post("/api/v1/places/local-columns", data=column_data, files=files)

    # ----------------------------------------------------------------
    # 시나리오 3: 여행 일정 짜기 -> Django (Prefix: /api)
    # ----------------------------------------------------------------
    @task(2)
    def create_plan(self):
        plan_data = {
            "title": "내일로 여행",
            "start_date": "2024-06-01",
            "end_date": "2024-06-05",
            "is_public": True,
            "plan_type": "personal"
        }
        # Django 엔드포인트: /api/plans/
        self.client.post("/api/plans/", json=plan_data)

    # ----------------------------------------------------------------
    # 시나리오 4: 쇼츠 업로드 시도 -> Django (Prefix: /api)
    # ----------------------------------------------------------------
    @task(1)
    def upload_shorts(self):
        # 멀티파트 파일 업로드 시뮬레이션
        files = {
            "video_file": ("video.mp4", b"dummy_video_bytes", "video/mp4"), # Field name check needed
            "thumbnail": ("thumb.jpg", b"dummy_img_bytes", "image/jpeg")
        }
        data = {
            "title": "한강 야경",
            "description": "반포대교 무지개 분수"
        }
        # Django 엔드포인트: /api/shortforms/
        self.client.post("/api/shortforms/", files=files, data=data)

    # ----------------------------------------------------------------
    # 시나리오 5: AI 번역 직접 요청 (번역 서비스 부하 테스트) -> FastAPI (Prefix: /api/v1)
    # ----------------------------------------------------------------
    @task(3)
    def request_translation(self):
        # 검색이나 조회 시 자동으로 번역이 되는 경우를 시뮬레이션
        # 쿼리 파라미터로 lang=en 등을 보내면 백엔드에서 번역 API를 호출함
        random_place_id = random.randint(1, 50)
        # FastAPI 엔드포인트: /api/v1/places/{id}
        self.client.get(f"/api/v1/places/{random_place_id}?lang=en")
