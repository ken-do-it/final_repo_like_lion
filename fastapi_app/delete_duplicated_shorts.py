
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "db")
DB_NAME = os.getenv("DB_NAME", "korea_travel_db")
DB_USER = os.getenv("DB_USER", "myuser")
DB_PASS = os.getenv("DB_PASSWORD", "mypassword")

def delete_duplicates():
    try:
        print(f"Connecting to DB {DB_HOST}...")
        conn = psycopg2.connect(host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASS)
        cur = conn.cursor()
        
        # 1. Check current count
        cur.execute("SELECT COUNT(*) FROM search_vectors WHERE category = 'shortform'")
        before_count = cur.fetchone()[0]
        print(f"Current shortform vectors: {before_count}")

        # 2. Delete duplicates, keeping the one with the highest uid (latest)
        delete_sql = """
        DELETE FROM search_vectors
        WHERE uid IN (
            SELECT uid
            FROM (
                SELECT uid,
                       ROW_NUMBER() OVER (
                            PARTITION BY target_id, category 
                            ORDER BY uid DESC
                       ) as row_num
                FROM search_vectors
                WHERE category = 'shortform'
            ) t
            WHERE t.row_num > 1
        );
        """
        
        cur.execute(delete_sql)
        deleted_count = cur.rowcount
        conn.commit()
        
        print(f"Deleted {deleted_count} duplicate entries.")
        
        cur.close()
        conn.close()
        print("Done!")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    delete_duplicates()
