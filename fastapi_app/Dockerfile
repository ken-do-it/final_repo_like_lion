# 1. 파이썬 3.12 슬림 버전 사용
FROM python:3.12-slim

# 2. 작업 폴더
WORKDIR /app

# 3. 환경 변수
ENV PYTHONUNBUFFERED=1

# 빌드 로그에 메시지 출력
RUN echo "⚡ [알림] 메인 서버: CPU 최적화 모드로 빌드 중입니다... ⚡"

# 4. 의존성 설치 (나중에 requirements.txt 생기면 주석 해제)
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# 5. 소스 코드 복사
COPY . /app/

# 6. 실행 명령어 (임시)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
#CMD ["python", "--version"]