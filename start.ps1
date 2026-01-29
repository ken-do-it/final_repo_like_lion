# NVIDIA GPU 감지 로직
try {
    # nvidia-smi 명령어가 있는지 확인하여 GPU 드라이버 설치 여부 판별
    $gpuCheck = Get-Command "nvidia-smi" -ErrorAction Stop
    
    # GPU 감지 성공 시 메시지 출력 (안전한 실행을 위해 로그는 영문 유지)
    Write-Host "[SUCCESS] NVIDIA GPU detected! Starting in High-Performance (GPU) mode." -ForegroundColor Green
    
    # GPU용 Dockerfile 선택 (Dockerfile.gpu)
    $env:AI_DOCKERFILE = "Dockerfile.gpu"
} catch {
    # GPU 감지 실패(없음) 시 메시지 출력
    Write-Host "[INFO] NVIDIA GPU not found. Starting in Optimized CPU (Light) mode." -ForegroundColor Yellow
    
    # CPU용 기본 Dockerfile 선택 (Dockerfile - 안전한 기본값)
    $env:AI_DOCKERFILE = "Dockerfile"
}

# Docker Compose 빌드 및 실행 시작
Write-Host "Starting Docker Compose... (Dockerfile: $env:AI_DOCKERFILE)" -ForegroundColor Cyan
docker-compose up -d --build
