import logging
import os
import hashlib
import requests
import json
from fastapi import FastAPI, HTTPException
# from translation.router import router as translation_router  # AI 번역 라우터 (Moved)
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from database import get_db_connection
from prometheus_fastapi_instrumentator import Instrumentator

# ---------------------------------------------------------
# 번역 관련 설정
# ---------------------------------------------------------
FASTAPI_TRANSLATE_URL = os.getenv("FASTAPI_TRANSLATE_URL", "http://fastapi-ai-translation:8003/api/ai/translate")
AI_SERVICE_API_KEY = os.getenv("AI_SERVICE_API_KEY", "secure-api-key-1234")

def parse_cached_translation(cached_text: str) -> str:
    """캐시된 번역 데이터 파싱 (JSON 형식인 경우 실제 텍스트 추출)"""
    if not cached_text:
        return cached_text

    # JSON 형식인지 확인
    if cached_text.strip().startswith('{'):
        try:
            data = json.loads(cached_text)
            # { "translations": ["..."] } 형식
            if "translations" in data and isinstance(data["translations"], list):
                return data["translations"][0] if data["translations"] else cached_text
            # { "translated_text": "..." } 형식
            if "translated_text" in data:
                return data["translated_text"]
        except (json.JSONDecodeError, IndexError, KeyError):
            pass

    return cached_text

def call_translate_api(text: str, source_lang: str, target_lang: str, timeout: int = 20):
    """FastAPI 번역 서버 호출"""
    if not text or not text.strip():
        return text

    payload = {
        "text": text,
        "source_lang": source_lang,
        "target_lang": target_lang,
    }

    try:
        headers = {"x-ai-api-key": AI_SERVICE_API_KEY}
        resp = requests.post(FASTAPI_TRANSLATE_URL, json=payload, headers=headers, timeout=(3, timeout))
        resp.raise_for_status()
        data = resp.json()

        # 응답 형식에 따라 처리
        result = None
        if "translated_text" in data:
            result = data["translated_text"]
        elif "translations" in data and isinstance(data["translations"], list):
            result = data["translations"][0] if data["translations"] else text

        # 이중 JSON 처리 (translated_text가 JSON 문자열인 경우)
        if result:
            result = parse_cached_translation(result)

        return result if result else text
    except Exception as e:
        logger.error(f"Translation API error: {e}")
        return text

def translate_items(items: List[Dict], target_lang: str, entity_type: str, fields: List[str], conn):
    """
    검색 결과 아이템들에 대해 번역 처리
    1. translation_entries 테이블에서 캐시 확인
    2. 캐시 없으면 번역 API 호출 후 캐시 저장
    """
    if not target_lang or not items:
        return

    cur = conn.cursor()

    for item in items:
        entity_id = item.get("id")
        if not entity_id:
            continue

        # 원본 언어 추정 (기본값: 한국어)
        source_lang = item.get("source_lang", "kor_Hang")

        # 원본 언어와 타겟 언어가 같으면 스킵
        if source_lang == target_lang:
            for field in fields:
                item[f"{field}_translated"] = item.get(field, "")
            continue

        for field in fields:
            original_text = item.get(field, "")
            if not original_text:
                item[f"{field}_translated"] = ""
                continue

            # 1. 캐시 확인
            cur.execute("""
                SELECT translated_text FROM translation_entries
                WHERE entity_type = %s AND entity_id = %s AND field = %s AND target_lang = %s
                LIMIT 1
            """, (entity_type, entity_id, field, target_lang))

            cache_row = cur.fetchone()

            if cache_row:
                # 캐시 Hit - JSON 형식인 경우 파싱
                item[f"{field}_translated"] = parse_cached_translation(cache_row[0])
            else:
                # 캐시 Miss -> 번역 API 호출
                translated = call_translate_api(original_text, source_lang, target_lang)
                item[f"{field}_translated"] = translated

                # 캐시 저장
                if translated and translated != original_text:
                    try:
                        text_hash = hashlib.sha256(original_text.encode("utf-8")).hexdigest()
                        cur.execute("""
                            INSERT INTO translation_entries
                            (entity_type, entity_id, field, source_lang, target_lang, source_hash, translated_text, provider, model, created_at, updated_at, last_used_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW(), NOW())
                            ON CONFLICT (entity_type, entity_id, field, target_lang) DO UPDATE
                            SET translated_text = EXCLUDED.translated_text, source_hash = EXCLUDED.source_hash, updated_at = NOW(), last_used_at = NOW()
                        """, (entity_type, entity_id, field, source_lang, target_lang, text_hash, translated, "fastapi", "nllb"))
                        conn.commit()
                    except Exception as e:
                        logger.error(f"Cache save error: {e}")
                        conn.rollback()

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

app = FastAPI(root_path="/search-api")
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
# ★ DB 설정 
# ---------------------------------------------------------
DB_HOST = os.getenv("DB_HOST", "db")
DB_NAME = os.getenv("DB_NAME", "korea_travel_db")
DB_USER = os.getenv("DB_USER", "myuser")
DB_PASS = os.getenv("DB_PASSWORD", "mypassword")

def init_db():
    """서버 시작 시 테이블이 없으면 생성합니다."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 테이블 생성 (IF NOT EXISTS)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS search_vectors (
                uid SERIAL PRIMARY KEY,
                target_id INT,
                category VARCHAR(50),
                content TEXT,
                embedding vector(384) 
            );
        """)
        # 인덱스 생성 (속도 향상을 위해 권장 - ivfflat 방식 예시)
        # 데이터가 적을 땐 에러가 날 수 있으므로 일단 주석 처리하거나, 데이터 쌓인 후 생성
        # cur.execute("CREATE INDEX ON search_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);")
        
        conn.commit()
        cur.close()
        conn.close()
        logger.info("✅ DB 테이블 초기화 완료 (search_vectors)")
    except Exception as e:
        logger.error(f"❌ DB 초기화 실패: {e}")

@app.on_event("startup")
async def startup_event():
    global model
    
    # 1. DB 테이블 먼저 생성 (순서 중요)
    init_db()
    
    # 2. 모델 로딩
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
        raise HTTPException(status_code=500, detail="모델 로딩 중입니다.")

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
        
        # ★ Unique Index 추가 (중복 방지용)
        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_target_category ON search_vectors (target_id, category);")
        
        # 텍스트 -> 벡터 변환
        embedding = model.encode(request.content).tolist()
        
        # 데이터 저장 (UPSERT: 있으면 업데이트, 없으면 삽입)
        query = """
            INSERT INTO search_vectors (target_id, category, content, embedding) 
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (target_id, category) 
            DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding;
        """
        cur.execute(query, (request.id, request.category, request.content, embedding))
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
    lang: str = None  # 타겟 언어 (예: eng_Latn, kor_Hang, jpn_Jpan, zho_Hans)

# @app.post("/search")
# def search_grouped(request: SearchRequest):
#     logger.info(f"🔍 분류 검색 요청: {request.query}")

#     if model is None:
#         raise HTTPException(status_code=500, detail="모델 로딩 중입니다.")

#     try:
#         conn = get_db_connection()
#         cur = conn.cursor()
        
#         # 1. 쿼리 벡터 변환
#         query_vector = model.encode(request.query).tolist()
#         text_pattern = f"%{request.query}%"

#         # 2. 하이브리드 검색 (키워드 포함 시 우선순위)
#         # category 컬럼도 같이 조회합니다.
#         cur.execute("""
#             SELECT target_id, category, content, (embedding <=> %s::vector) as distance,
#                    CASE WHEN content ILIKE %s THEN 0 ELSE 1 END as match_priority
#             FROM search_vectors
#             ORDER BY match_priority ASC, distance ASC
#             LIMIT 30;  -- 여러 카테고리가 섞여 나오므로 넉넉하게 조회
#         """, (query_vector, text_pattern))
        
#         rows = cur.fetchall()
#         conn.close()
        
#         # 3. ★ 파이썬에서 카테고리별로 박스 담기 (Grouping)
#         grouped_results = {
#             "places": [],
#             "reviews": [],
#             "plans": [],
#             "others": []
#         }
        
#         for r in rows:
#             item = {
#                 "id": r[0],
#                 "content": r[2],
#                 "distance": float(r[3]),
#                 "is_keyword_match": True if r[4] == 0 else False
#             }
            
#             # 꼬리표(category) 확인 후 분류
#             cat = r[1] 
#             if cat == "place":
#                 grouped_results["places"].append(item)
#             elif cat == "review":
#                 grouped_results["reviews"].append(item)
#             elif cat == "plan":
#                 grouped_results["plans"].append(item)
#             else:
#                 grouped_results["others"].append(item)
        
#         return grouped_results
        
#     except Exception as e:
#         logger.error(f"검색 실패: {e}")
#         # 테이블 없음 에러 처리
#         if "relation \"search_vectors\" does not exist" in str(e):
#              raise HTTPException(status_code=404, detail="데이터가 없습니다. /index-data 로 데이터를 먼저 넣어주세요.")
#         raise HTTPException(status_code=500, detail=str(e))


@app.post("/search")
def search_grouped(request: SearchRequest):
    logger.info(f"🔍 고도화된 하이브리드 검색 요청: {request.query}")

    if model is None:
            raise HTTPException(status_code=500, detail="모델 로딩 중입니다.")

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 1. 쿼리 벡터 변환 및 패턴 생성
        query_vector = model.encode(request.query).tolist()
        text_pattern = f"%{request.query}%"
        
        # 2. 통합 하이브리드 쿼리 실행
        # - places, shortforms, local_columns 테이블 실시간 조회 추가
        
        query_sql = """
        WITH ai_results AS (
            -- [1] 검색 엔진 인덱스 테이블 조회
            SELECT target_id, category, content, 
                   (embedding <=> %s::vector) as distance,
                   CASE WHEN content ILIKE %s THEN 0 ELSE 1 END as match_priority
            FROM search_vectors
        ),
        direct_places_results AS (
            -- [2] 장소 테이블 실시간 조회
            SELECT id as target_id, 'place' as category, name || ' ' || address as content,
                   0.45 as distance,
                   0 as match_priority
            FROM places
            WHERE (name ILIKE %s OR address ILIKE %s)
            AND id NOT IN (SELECT target_id FROM search_vectors WHERE category = 'place')
        ),
        direct_shorts_results AS (
            -- [3] 숏츠 테이블 실시간 조회
            SELECT id as target_id, 'shortform' as category, title || ' ' || COALESCE(content, '') as content,
                   0.45 as distance,
                   0 as match_priority
            FROM shortforms
            WHERE (title ILIKE %s OR content ILIKE %s)
            AND id NOT IN (SELECT target_id FROM search_vectors WHERE category = 'shortform')
        ),
        direct_columns_results AS (
            -- [4] ★ 칼럼 테이블 실시간 조회 추가 (NEW)
            SELECT id as target_id, 'localcolumn' as category, title || ' ' || SUBSTRING(content, 1, 300) as content,
                   0.45 as distance,
                   0 as match_priority
            FROM local_columns
            WHERE (title ILIKE %s OR content ILIKE %s)
            AND id NOT IN (SELECT target_id FROM search_vectors WHERE category = 'localcolumn')
        ),
        combined AS (
            SELECT * FROM ai_results
            UNION ALL
            SELECT * FROM direct_places_results
            UNION ALL
            SELECT * FROM direct_shorts_results
            UNION ALL
            SELECT * FROM direct_columns_results
        ),
        ranked AS (
            SELECT *,
                   ROW_NUMBER() OVER(
                       PARTITION BY category 
                       ORDER BY match_priority ASC, distance ASC
                   ) as group_rank
            FROM combined
            WHERE distance < 0.5 OR match_priority = 0
        )
        SELECT target_id, category, content, distance, match_priority
        FROM ranked
        WHERE group_rank <= 15
        ORDER BY match_priority ASC, distance ASC;
        """
        
        # 파라미터 매핑: AI(2) + Place(2) + Short(2) + Column(2) = 총 8개
        cur.execute(query_sql, (
            query_vector, text_pattern, 
            text_pattern, text_pattern, 
            text_pattern, text_pattern,
            text_pattern, text_pattern 
        ))
        
        rows = cur.fetchall()
        conn.close()
        
        # 3. 결과 그룹화
        grouped_results = {
            "places": [],
            "reviews": [],
            "plans": [],
            "shorts": [],
            "columns": [],  # ★ 칼럼 섹션 추가
            "others": []
        }
        
        place_ids = []
        short_ids = []
        column_ids = []
        plan_ids = []
        review_ids = []

        for r in rows:
            item = {
                "id": r[0],
                "content": r[2],
                "distance": float(r[3]),
                "is_keyword_match": True if r[4] == 0 else False
            }

            cat = r[1]
            if cat == "place":
                grouped_results["places"].append(item)
                place_ids.append(item["id"])
            elif cat == "review":
                grouped_results["reviews"].append(item)
                review_ids.append(item["id"])
            elif cat == "plan":
                grouped_results["plans"].append(item)
                plan_ids.append(item["id"])
            elif cat == "shortform":
                grouped_results["shorts"].append(item)
                short_ids.append(item["id"])
            elif cat == "localcolumn": # ★ 칼럼 분류 추가
                grouped_results["columns"].append(item)
                column_ids.append(item["id"])
            else:
                grouped_results["others"].append(item)
        
        # -----------------------------------------------------
        # 4. 추가 정보 조회 (썸네일, 제목 등)
        # -----------------------------------------------------
        
        # [A] Place 추가 정보
        if place_ids:
            try:
                conn_places = get_db_connection()
                cur_places = conn_places.cursor()

                place_query = "SELECT id, thumbnail_urls, average_rating, review_count, name, address, source_lang FROM places WHERE id IN %s"
                cur_places.execute(place_query, (tuple(place_ids),))
                place_rows = cur_places.fetchall()

                # 리뷰 이미지
                review_query = """
                    SELECT DISTINCT ON (place_id) place_id, image_url
                    FROM place_reviews
                    WHERE place_id IN %s AND image_url IS NOT NULL AND image_url != ''
                    ORDER BY place_id, created_at DESC
                """
                cur_places.execute(review_query, (tuple(place_ids),))
                review_rows = cur_places.fetchall()
                review_map = {row[0]: row[1] for row in review_rows}

                place_map = {}
                for pid, urls, rating, count, name, address, src_lang in place_rows:
                    thumb = None
                    if pid in review_map:
                        thumb = review_map[pid]
                    elif urls and isinstance(urls, list) and len(urls) > 0:
                        thumb = urls[0]

                    place_map[pid] = {
                        "thumbnail_url": thumb,
                        "average_rating": float(rating) if rating else 0.0,
                        "review_count": count if count else 0,
                        "name": name,
                        "address": address,
                        "source_lang": src_lang or "kor_Hang"
                    }

                for item in grouped_results["places"]:
                    info = place_map.get(item["id"], {})
                    item["thumbnail_url"] = info.get("thumbnail_url")
                    item["average_rating"] = info.get("average_rating", 0.0)
                    item["review_count"] = info.get("review_count", 0)
                    item["name"] = info.get("name")
                    item["address"] = info.get("address")
                    item["source_lang"] = info.get("source_lang", "kor_Hang")

                cur_places.close()
                conn_places.close()
            except Exception as e:
                logger.error(f"Place detail error: {e}")

        # [B] Shortform 추가 정보
        if short_ids:
            try:
                conn_shorts = get_db_connection()
                cur_shorts = conn_shorts.cursor()

                short_query = "SELECT id, thumbnail_url, title, content, source_lang FROM shortforms WHERE id IN %s"
                cur_shorts.execute(short_query, (tuple(short_ids),))
                short_rows = cur_shorts.fetchall()

                short_map = {}
                for sid, thumb, title, content, src_lang in short_rows:
                    short_map[sid] = {
                        "thumbnail_url": thumb,
                        "title": title,
                        "content": content,
                        "source_lang": src_lang or "kor_Hang"
                    }

                for item in grouped_results["shorts"]:
                    info = short_map.get(item["id"], {})
                    item["thumbnail_url"] = info.get("thumbnail_url")
                    item["title"] = info.get("title")
                    item["content"] = info.get("content")
                    item["source_lang"] = info.get("source_lang", "kor_Hang")

                cur_shorts.close()
                conn_shorts.close()
            except Exception as e:
                logger.error(f"Shortform detail error: {e}")

        # [C] ★ LocalColumn 추가 정보 (NEW)
        if column_ids:
            try:
                conn_cols = get_db_connection()
                cur_cols = conn_cols.cursor()
                
                # 칼럼은 thumbnail_url과 title을 가져옵니다.
                col_query = "SELECT id, thumbnail_url, title FROM local_columns WHERE id IN %s"
                cur_cols.execute(col_query, (tuple(column_ids),))
                col_rows = cur_cols.fetchall()
                
                col_map = {}
                for cid, thumb, title in col_rows:
                    col_map[cid] = {"thumbnail_url": thumb, "title": title}
                
                for item in grouped_results["columns"]:
                    info = col_map.get(item["id"], {})
                    item["thumbnail_url"] = info.get("thumbnail_url")
                    item["title"] = info.get("title")
                    
                cur_cols.close()
                conn_cols.close()
            except Exception as e:
                logger.error(f"Column detail error: {e}")

        # [D] Plan 추가 정보
        if plan_ids:
            try:
                conn_plans = get_db_connection()
                cur_plans = conn_plans.cursor()

                plan_query = "SELECT id, title, description FROM travel_plans WHERE id IN %s"
                cur_plans.execute(plan_query, (tuple(plan_ids),))
                plan_rows = cur_plans.fetchall()

                plan_map = {}
                for pid, title, description in plan_rows:
                    plan_map[pid] = {
                        "title": title,
                        "description": description,
                        "source_lang": "kor_Hang"  # Plans는 source_lang 필드가 없으므로 기본값
                    }

                for item in grouped_results["plans"]:
                    info = plan_map.get(item["id"], {})
                    item["title"] = info.get("title")
                    item["description"] = info.get("description")
                    item["source_lang"] = info.get("source_lang", "kor_Hang")

                cur_plans.close()
                conn_plans.close()
            except Exception as e:
                logger.error(f"Plan detail error: {e}")

        # [E] Review 추가 정보
        if review_ids:
            try:
                conn_reviews = get_db_connection()
                cur_reviews = conn_reviews.cursor()

                review_query = "SELECT id, content, source_lang, rating FROM place_reviews WHERE id IN %s"
                cur_reviews.execute(review_query, (tuple(review_ids),))
                review_rows = cur_reviews.fetchall()

                review_map = {}
                for rid, content, src_lang, rating in review_rows:
                    review_map[rid] = {
                        "content": content,
                        "source_lang": src_lang or "kor_Hang",
                        "rating": rating
                    }

                for item in grouped_results["reviews"]:
                    info = review_map.get(item["id"], {})
                    if info.get("content"):
                        item["content"] = info.get("content")
                    item["source_lang"] = info.get("source_lang", "kor_Hang")
                    item["rating"] = info.get("rating", 5)

                cur_reviews.close()
                conn_reviews.close()
            except Exception as e:
                logger.error(f"Review detail error: {e}")

        # -----------------------------------------------------
        # 5. 번역 처리 (lang 파라미터가 있을 때만)
        # -----------------------------------------------------
        if request.lang:
            try:
                conn_trans = get_db_connection()

                # Places 번역
                if grouped_results["places"]:
                    translate_items(
                        grouped_results["places"],
                        request.lang,
                        "place",
                        ["name", "address"],
                        conn_trans
                    )

                # Shorts 번역
                if grouped_results["shorts"]:
                    translate_items(
                        grouped_results["shorts"],
                        request.lang,
                        "shortform",
                        ["title", "content"],
                        conn_trans
                    )

                # Plans 번역
                if grouped_results["plans"]:
                    translate_items(
                        grouped_results["plans"],
                        request.lang,
                        "travel_plan",
                        ["title", "description"],
                        conn_trans
                    )

                # Reviews 번역
                if grouped_results["reviews"]:
                    translate_items(
                        grouped_results["reviews"],
                        request.lang,
                        "place_review",
                        ["content"],
                        conn_trans
                    )

                conn_trans.close()
            except Exception as e:
                logger.error(f"Translation error: {e}")

        return grouped_results
        
    except Exception as e:
        logger.error(f"검색 실패: {e}")
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
