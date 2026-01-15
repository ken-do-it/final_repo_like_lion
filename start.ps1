# NVIDIA GPU 확인
try {
    # nvidia-smi 명령어가 있는지 확인하여 GPU 드라이버 설치 여부 판별
    $gpuCheck = Get-Command "nvidia-smi" -ErrorAction Stop
    Write-Host "✅ NVIDIA GPU 감지됨! 고성능(GPU) 설정으로 시작합니다." -ForegroundColor Green
    
    # GPU용 명시적 Dockerfile 사용
    $env:AI_DOCKERFILE = "Dockerfile.gpu"
} catch {
    Write-Host "⚠️ NVIDIA GPU를 찾을 수 없습니다. CPU 최적화(경량) 설정으로 전환합니다." -ForegroundColor Yellow
    
    # CPU용 기본 Dockerfile 사용 (안전한 기본값)
    $env:AI_DOCKERFILE = "Dockerfile"
}

# Docker Compose 실행
Write-Host "🚀 Docker Compose 시작 중... (설정 파일: $env:AI_DOCKERFILE)" -ForegroundColor Cyan
docker-compose up --build
