"""
FastAPI Places - Main Application
장소 검색 및 현지인 추천 API 서버
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# 환경 변수 로드
load_dotenv()

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI 앱 생성
app = FastAPI(
    title="Korea Trip - Places API",
    description="외국인 대상 한국 여행 플랫폼 - 장소 검색 및 현지인 추천",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS 설정 (모든 도메인 허용 - 개발용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Places Router 등록
from router import router as places_router
app.include_router(places_router)


# 앱 시작 시 테이블 자동 생성
@app.on_event("startup")
def startup_event():
    """앱 시작 시 데이터베이스 테이블 생성"""
    from database import create_tables
    logger.info("Creating database tables...")
    create_tables()
    logger.info("Database tables created successfully!")


@app.get("/")
def root():
    """루트 엔드포인트"""
    return {
        "service": "Korea Trip - Places API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    """헬스 체크"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
