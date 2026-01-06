# fastapi_app/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# PostgreSQL 연결 정보 (환경 변수 또는 기본값 사용)
DB_HOST = os.getenv("DB_HOST", "db")
DB_NAME = os.getenv("DB_NAME", "korea_travel_db")
DB_USER = os.getenv("DB_USER", "myuser")
DB_PASSWORD = os.getenv("DB_PASSWORD", "mypassword")
DB_PORT = os.getenv("DB_PORT", "5432")

SQLALCHEMY_DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency: FastAPI 라우터에서 데이터베이스 세션을 얻기 위해 사용
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
