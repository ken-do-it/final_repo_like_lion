# 1. 파이썬 3.12 슬림 버전 사용
FROM python:3.12-slim

# 2. 작업 폴더
WORKDIR /app

# 3. 환경 변수
ENV PYTHONUNBUFFERED=1

# 4. 의존성 설치
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# 5. 소스 코드 복사
COPY . /app/

# 6. 실행 명령어 (임시, 포트 8002)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
