# fastapi_app/database.py
import psycopg2
import os

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "db"),
        database=os.getenv("DB_NAME", "korea_travel_db"),
        user=os.getenv("DB_USER", "myuser"),
        password=os.getenv("DB_PASSWORD", "mypassword")
    )

# DB_HOST = os.getenv("DB_HOST", "db")
# DB_NAME = os.getenv("DB_NAME", "korea_travel_db")
# DB_USER = os.getenv("DB_USER", "myuser")
# DB_PASS = os.getenv("DB_PASSWORD", "mypassword")
