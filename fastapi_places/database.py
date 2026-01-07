"""
Database Connection and Session Management
SQLAlchemy ORM 설정
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from dotenv import load_dotenv

# 환경 변수 로드
load_dotenv()

# 데이터베이스 설정
DB_HOST = os.getenv("DB_HOST", "db")
DB_NAME = os.getenv("DB_NAME", "korea_travel_db")
DB_USER = os.getenv("DB_USER", "myuser")
DB_PASS = os.getenv("DB_PASS", "mypassword")
DB_PORT = os.getenv("DB_PORT", "5432")

# SQLAlchemy Base (모델 상속용)
Base = declarative_base()

# SQLAlchemy 엔진 생성
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # 연결 유효성 검사
    pool_size=10,
    max_overflow=20
)

# 세션 팩토리
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """
    데이터베이스 세션 의존성
    FastAPI Depends에서 사용
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """
    모든 테이블 생성
    앱 시작 시 자동으로 호출됨
    """
    Base.metadata.create_all(bind=engine)
