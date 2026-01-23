
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "db")
DB_NAME = os.getenv("DB_NAME", "korea_travel_db")
DB_USER = os.getenv("DB_USER", "myuser")
DB_PASS = os.getenv("DB_PASSWORD", "mypassword")

def clean_orphaned_vectors():
    try:
        print(f"Connecting to DB {DB_HOST}...")
        conn = psycopg2.connect(host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASS)
        cur = conn.cursor()
        
        # 1. Get all valid shortform IDs
print("유효한 쇼츠 ID 조회 중...")
        cur.execute("SELECT id FROM shortforms")
        valid_ids = [row[0] for row in cur.fetchall()]
        print(f"Valid Shortform IDs ({len(valid_ids)}): {valid_ids}")

        # 2. Get all vector target_ids for shortforms
print("검색 벡터 target_id 조회 중...")
        cur.execute("SELECT uid, target_id, content FROM search_vectors WHERE category = 'shortform'")
        vectors = cur.fetchall()
        print(f"Total Shortform Vectors: {len(vectors)}")

        # 3. Identify orphans
        orphans = []
        for uid, target_id, content in vectors:
            if target_id not in valid_ids:
                orphans.append(uid)
                print(f"Found Orphan -> UID: {uid}, TargetID: {target_id}, Content: {content[:30]}...")

        # 4. Delete orphans
        if orphans:
            delete_sql = f"DELETE FROM search_vectors WHERE uid IN ({','.join(map(str, orphans))})"
            cur.execute(delete_sql)
            conn.commit()
            print(f"Deleted {len(orphans)} orphaned vectors.")
        else:
print("고아 벡터가 없습니다.")

        cur.close()
        conn.close()
print("완료!")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    clean_orphaned_vectors()
