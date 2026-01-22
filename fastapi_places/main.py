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
    description=("Places API for search, details, reviews, bookmarks, and local columns. "
                "Use Bearer token for protected endpoints."),
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

# 숙소 전용 라우터 등록
from accommodations import router as accommodations_router
app.include_router(accommodations_router)

# Roadview 라우터 등록
from roadview import router as roadview_router
app.include_router(roadview_router)


# 테이블 생성은 Django 마이그레이션으로 처리
# FastAPI는 기존 테이블을 읽기만 함


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
