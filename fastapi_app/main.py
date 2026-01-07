import logging
import os
from fastapi import FastAPI, HTTPException
# from translation.router import router as translation_router  # AI 번역 라우터 (Moved)
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
from pydantic import BaseModel
# from database import get_db_connection
from prometheus_fastapi_instrumentator import Instrumentator

# 삭제 요청 데이터 모델
class DeleteRequest(BaseModel):
    id: int      # 장고에서 보내준 원본 ID (Place ID)
    category: str


from dotenv import load_dotenv
load_dotenv()


# 필수 라이브러리 체크
try:
    from sentence_transformers import SentenceTransformer
    import psycopg2
    from pgvector.psycopg2 import register_vector
except ImportError as e:
    print(f"CRITICAL ERROR: 필수 라이브러리가 없습니다! -> {e}")

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
Instrumentator().instrument(app).expose(app)

# ---------------------------------------------------------
# CORS 설정 (모든 도메인 허용 - 개발용)
# ---------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 모든 주소 허용 (OPTIONS 400 에러 해결)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 모델 전역 변수
model = None

# ---------------------------------------------------------
# ★ DB 설정 (형님 설정 유지)
# ---------------------------------------------------------
DB_HOST = "db"
DB_NAME = "korea_travel_db"
DB_USER = "myuser"
DB_PASS = "mypassword"

@app.on_event("startup")
async def startup_event():
    global model
    logger.info("🚀 AI 모델 로딩 시작...")
    try:
        model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
        logger.info("✅ AI 모델 로딩 완료!")
    except Exception as e:
        logger.error(f"❌ 모델 로딩 실패: {e}")

def get_db_connection():
    try:
        conn = psycopg2.connect(host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASS)
        cur = conn.cursor()
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        conn.commit()
        register_vector(conn)
        return conn
    except Exception as e:
        logger.error(f"DB 연결 에러: {e}")
        raise HTTPException(status_code=500, detail=f"DB Connection Error: {str(e)}")




# ---------------------------------------------------------
# AI 번역 라우터 등록 (Hugging Face Inference API)
# ---------------------------------------------------------
# ---------------------------------------------------------
# AI 번역 라우터 등록 (Removed: Moved to fastapi_ai_translation)
# ---------------------------------------------------------
# app.include_router(translation_router, prefix="/api/ai", tags=["translation"])






# ---------------------------------------------------------
# 1. 통합 데이터 등록 API (Index Data)
# ---------------------------------------------------------
class IndexRequest(BaseModel):
    id: int          # 원본 ID (장소ID, 칼럼ID, 리뷰ID 등)
    category: str    # 분류 ('place', 'column', 'review', 'plan' 등)
    content: str     # 검색될 텍스트 내용

@app.post("/index-data")
def index_data(request: IndexRequest):
    if model is None:
        raise HTTPException(status_code=500, detail="Model is loading...")

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # ★ 테이블 구조 변경: category 컬럼 추가!
        cur.execute("""
            CREATE TABLE IF NOT EXISTS search_vectors (
                uid SERIAL PRIMARY KEY,
                target_id INT,           -- 원본 데이터의 ID
                category VARCHAR(50),    -- 데이터 종류 (place, review 등)
                content TEXT,
                embedding vector(384) 
            );
        """)
        
        # 텍스트 -> 벡터 변환
        embedding = model.encode(request.content).tolist()
        
        # 데이터 저장 (꼬리표 포함)
        cur.execute(
            "INSERT INTO search_vectors (target_id, category, content, embedding) VALUES (%s, %s, %s, %s)",
            (request.id, request.category, request.content, embedding)
        )
        conn.commit()
        conn.close()
        
        logger.info(f"데이터 등록 성공 [{request.category}]: {request.content}")
        return {"status": "success", "message": f"Indexed ({request.category}): {request.content}"}
        
    except Exception as e:
        logger.error(f"등록 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------
# 2. 통합 검색 API (분류된 결과 반환)
# ---------------------------------------------------------
class SearchRequest(BaseModel):
    query: str

@app.post("/search")
def search_grouped(request: SearchRequest):
    logger.info(f"🔍 분류 검색 요청: {request.query}")

    if model is None:
        raise HTTPException(status_code=500, detail="Model is loading...")

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 1. 쿼리 벡터 변환
        query_vector = model.encode(request.query).tolist()
        text_pattern = f"%{request.query}%"

        # 2. 하이브리드 검색 (키워드 포함 시 우선순위)
        # category 컬럼도 같이 조회합니다.
        cur.execute("""
            SELECT target_id, category, content, (embedding <=> %s::vector) as distance,
                   CASE WHEN content ILIKE %s THEN 0 ELSE 1 END as match_priority
            FROM search_vectors
            ORDER BY match_priority ASC, distance ASC
            LIMIT 30;  -- 여러 카테고리가 섞여 나오므로 넉넉하게 조회
        """, (query_vector, text_pattern))
        
        rows = cur.fetchall()
        conn.close()
        
        # 3. ★ 파이썬에서 카테고리별로 박스 담기 (Grouping)
        grouped_results = {
            "places": [],
            "reviews": [],
            "plans": [],
            "others": []
        }
        
        for r in rows:
            item = {
                "id": r[0],
                "content": r[2],
                "distance": float(r[3]),
                "is_keyword_match": True if r[4] == 0 else False
            }
            
            # 꼬리표(category) 확인 후 분류
            cat = r[1] 
            if cat == "place":
                grouped_results["places"].append(item)
            elif cat == "review":
                grouped_results["reviews"].append(item)
            elif cat == "plan":
                grouped_results["plans"].append(item)
            else:
                grouped_results["others"].append(item)
        
        return grouped_results
        
    except Exception as e:
        logger.error(f"검색 실패: {e}")
        # 테이블 없음 에러 처리
        if "relation \"search_vectors\" does not exist" in str(e):
             raise HTTPException(status_code=404, detail="데이터가 없습니다. /index-data 로 데이터를 먼저 넣어주세요.")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/delete-data")
def delete_data(request: DeleteRequest):
    conn = None
    try:
        # ★ 아까 만든 파일에서 DB 연결을 새로 받아옵니다 (독립 실행)
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 삭제 실행
        cur.execute(
            "DELETE FROM search_vectors WHERE target_id = %s AND category = %s",
            (request.id, request.category)
        )
        conn.commit()
        
        deleted_count = cur.rowcount
        print(f"🗑️ 삭제 완료 [{request.category}] ID: {request.id} (건수: {deleted_count})")
        
        return {
            "status": "deleted", 
            "count": deleted_count, 
            "id": request.id, 
            "category": request.category
        }

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ 삭제 에러: {e}")
        return {"status": "error", "message": str(e)}
        
    finally:
        # 쓴 자원 반납 (깔끔)
        if conn:
            cur.close()
            conn.close()