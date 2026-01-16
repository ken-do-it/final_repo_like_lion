# 1. 파이썬 3.12 슬림 버전 사용
FROM python:3.12-slim

# 2. 작업 폴더
WORKDIR /app

# 3. 환경 변수
ENV PYTHONUNBUFFERED=1

# 빌드 로그에 메시지 출력
RUN echo "⚡ [알림] 메인 서버: CPU 최적화 모드로 빌드 중입니다... ⚡"

# [최적화 1단계] 무거운 'Torch'만 먼저 설치 (캐시됨 :zap:)
# 이 줄은 requirements.txt 파일과 상관없어서 계속 재사용됨!
RUN pip install --no-cache-dir torch==2.2.2+cpu --extra-index-url https://download.pytorch.org/whl/cpu

# [최적화 2단계] 이제서야 파일 복사 (파일이 바뀐 시점)
COPY requirements.txt /app/

# [최적화 3단계] 나머지 설치
# 위 1단계에서 이미 Torch가 깔려있으니, pip가 "어? 깔려있네? 패스!" 하고 넘어감 :rocket:
RUN pip install --no-cache-dir -r requirements.txt

# 5. 소스 코드 복사
COPY . /app/

# 6. 실행 명령어 (임시)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
#CMD ["python", "--version"]