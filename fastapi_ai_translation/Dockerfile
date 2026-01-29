# [기본] 경량 CPU 베이스 이미지 (Safe Default)
# GPU가 없는 환경에서도 빠르게 빌드되고 실행되도록 설계됨
FROM python:3.12-slim

WORKDIR /app

# 빌드 로그에 메시지 출력
RUN echo "🚧 [알림] 현재 CPU 모드(Light)로 빌드 중입니다... 🚧"

# 최소한의 시스템 패키지 설치 (필요시 추가)
# RUN apt-get update && apt-get install -y ...

# CPU 전용 요구사항 파일 복사
COPY requirements.txt .

# 의존성 설치 (CPU 최적화 버전)
# 참고: requirements.txt는 이제 CPU 버전을 가리킴
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY . .

# 포트 개방 (8003)
EXPOSE 8003

# 애플리케이션 실행
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003"]
