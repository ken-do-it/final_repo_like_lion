import logging
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

# 라이브러리 임포트 확인 (에러 시 로그 출력)
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

#cors 설정
origins = [
    "http://localhost",       # 프론트엔드 (Docker/Nginx)
    "http://localhost:3000",  # 로컬 개발용
    "http://localhost:5173",  # Vite 개발용
]

app.add_middleware(
    CORSMiddleware,
    # 기존: allow_origins=origins,
    # 수정: 무조건 다 허용! (개발용)
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 전역 변수 (모델)
model = None

# DB 설정 (docker-compose.yaml의 서비스 이름 'db' 사용)
DB_HOST = "db"
DB_NAME = "korea_travel_db"
DB_USER = "myuser"
DB_PASS = "mypassword"

@app.on_event("startup")
async def startup_event():
    global model
    logger.info("🚀 AI 모델 로딩 시작... (처음 실행 시 다운로드로 인해 시간이 좀 걸립니다)")
    try:
        # 모델 로드 (약 500MB)
        model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
        logger.info("✅ AI 모델 로딩 완료!")
    except Exception as e:
        logger.error(f"❌ 모델 로딩 실패: {e}")

def get_db_connection():
    """DB 연결 및 pgvector 확장 기능 활성화"""
    try:
        conn = psycopg2.connect(host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASS)
        cur = conn.cursor()
        # 벡터 기능 활성화 (필수)
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        conn.commit()
        register_vector(conn)
        return conn
    except Exception as e:
        logger.error(f"DB 연결 에러: {e}")
        raise HTTPException(status_code=500, detail=f"DB Connection Error: {str(e)}")

# ---------------------------------------------------------
# 1. 데이터 등록 API (Index Data)
# ---------------------------------------------------------
class IndexRequest(BaseModel):
    place_id: int
    content: str  # 예: "경복궁은 조선시대 궁궐입니다"

@app.post("/index-data")
def index_data(request: IndexRequest):
    if model is None:
        raise HTTPException(status_code=500, detail="AI Model is loading... Please wait.")

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 테이블 없으면 생성
        cur.execute("""
            CREATE TABLE IF NOT EXISTS place_vectors (
                id SERIAL PRIMARY KEY,
                place_id INT,
                content TEXT,
                embedding vector(384) 
            );
        """)
        
        # 텍스트 -> 벡터 변환
        embedding = model.encode(request.content).tolist()
        
        # DB 저장
        cur.execute(
            "INSERT INTO place_vectors (place_id, content, embedding) VALUES (%s, %s, %s)",
            (request.place_id, request.content, embedding)
        )
        conn.commit()
        conn.close()
        
        logger.info(f"데이터 등록 성공: {request.content}")
        return {"status": "success", "message": f"Indexed: {request.content}"}
        
    except Exception as e:
        logger.error(f"데이터 등록 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------
# 2. 검색 API (Semantic Search)
# ---------------------------------------------------------
class SearchRequest(BaseModel):
    query: str

@app.post("/search")
def search_places(request: SearchRequest):
    logger.info(f"🔍 하이브리드 검색 요청: {request.query}")

    if model is None:
        raise HTTPException(status_code=500, detail="Model is loading...")

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 1. 검색어 -> 벡터 변환
        query_vector = model.encode(request.query).tolist()
        
        # 2. 텍스트 검색용 패턴 ("%검색어%")
        text_pattern = f"%{request.query}%"
        
        # 3. ★ 핵심 쿼리 변경 (하이브리드 정렬)
        # CASE WHEN 구문을 써서 텍스트가 포함되면(ILIKE) 0번 그룹(최상위), 아니면 1번 그룹으로 나눕니다.
        cur.execute("""
            SELECT place_id, content, (embedding <=> %s::vector) as distance,
                   CASE 
                       WHEN content ILIKE %s THEN 0  -- 텍스트 포함되면 0순위 (가장 위)
                       ELSE 1                        -- 아니면 1순위 (그 다음)
                   END as match_priority
            FROM place_vectors
            ORDER BY match_priority ASC, distance ASC
            LIMIT 10;
        """, (query_vector, text_pattern))
        
        results = cur.fetchall()
        conn.close()
        
        # 결과 반환 (프론트엔드 형식 유지)
        return [
            {
                "place_id": r[0], 
                "content": r[1], 
                "distance": float(r[2]),
                "is_keyword_match": True if r[3] == 0 else False # (참고용) 키워드 매칭 여부
            } 
            for r in results
        ]
        
    except Exception as e:
        logger.error(f"검색 에러: {e}")
        raise HTTPException(status_code=500, detail=str(e))