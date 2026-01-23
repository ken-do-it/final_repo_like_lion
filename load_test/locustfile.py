
import random
from locust import HttpUser, task, between

# 이미지나 파일 업로드 시미를 위한 더미 데이터 생성 함수
def create_dummy_image():
    return ("test.jpg", b"dummy_content", "image/jpeg")

class TripUser(HttpUser):
    # 각 유저(User)가 작업(Task)을 실행하는 대기 시간 (1초~3초 랜덤)
    wait_time = between(1, 3)

    # 1. 사이트 접속 및 헤더 설정 (로그인 시뮬레이션은 필요 시 on_start에서 구현)
    def on_start(self):
        # 실제 환경에서는 로그인을 먼저 수행하고 토큰을 헤더에 박아야 합니다.
        # self.client.post("/users/login", json={"email":"...", "password":"..."})
        self.headers = {"Authorization": "Bearer YOUR_TEST_TOKEN"}

    # ----------------------------------------------------------------
    # 시나리오 1: 리뷰 남기기 (AI 번역 유발)
    # ----------------------------------------------------------------
    @task(2)  # 가중치 2: 다른 작업보다 2배 자주 실행
    def leave_review(self):
        place_id = random.randint(1, 100) # 랜덤 장소 ID
        review_data = {
            "place": place_id,
            "content": "정말 멋진 곳이네요! 강추합니다. Great place!",
            "rating": 5
        }
        # 백엔드 경로 확인 필요 (예: /places/reviews/)
        self.client.post("/places/reviews/", json=review_data)

    # ----------------------------------------------------------------
    # 시나리오 2: 칼럼 작성 (AI 번역 유발 가능)
    # ----------------------------------------------------------------
    @task(1)
    def write_column(self):
        column_data = {
            "title": f"서울 여행 꿀팁 {random.randint(1, 1000)}",
            "content": "서울의 숨겨진 명소를 소개합니다. 먼저...",
            "location": "Seoul"
        }
        self.client.post("/places/local-columns/", json=column_data)

    # ----------------------------------------------------------------
    # 시나리오 3: 여행 일정 짜기
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
        self.client.post("/plans/", json=plan_data)

    # ----------------------------------------------------------------
    # 시나리오 4: 쇼츠 업로드 시도 (부하가 큰 작업)
    # ----------------------------------------------------------------
    @task(1)
    def upload_shorts(self):
        # 멀티파트 파일 업로드 시뮬레이션
        files = {
            "video": ("video.mp4", b"dummy_video_bytes", "video/mp4"),
            "thumbnail": ("thumb.jpg", b"dummy_img_bytes", "image/jpeg")
        }
        data = {
            "title": "한강 야경",
            "description": "반포대교 무지개 분수"
        }
        self.client.post("/shortforms/", files=files, data=data)

    # ----------------------------------------------------------------
    # 시나리오 5: AI 번역 직접 요청 (번역 서비스 부하 테스트)
    # ----------------------------------------------------------------
    @task(3)
    def request_translation(self):
        # 검색이나 조회 시 자동으로 번역이 되는 경우를 시뮬레이션
        # 쿼리 파라미터로 lang=en 등을 보내면 백엔드에서 번역 API를 호출함
        random_place_id = random.randint(1, 50)
        self.client.get(f"/places/{random_place_id}?lang=en")
