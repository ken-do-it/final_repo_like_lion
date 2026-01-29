# 1. 파이썬 3.12 슬림 버전 사용 (최신 & 경량)
FROM python:3.12-slim

# 2. 작업 폴더 설정
# 1.5. 시스템 패키지 설치 (FFmpeg 포함)
# 1.5. 시스템 패키지 설치 (FFmpeg 포함) - 안정성 개선
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 2. 작업 폴더 설정
WORKDIR /app

# 3. 환경 변수 설정
ENV PYTHONUNBUFFERED=1

# 4. 의존성 설치 (나중에 requirements.txt 생기면 주석 해제)
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# 5. 소스 코드 복사
COPY . /app/

# 6. 실행 명령어 (임시)
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "config.wsgi:application"]
#CMD ["python", "--version"]