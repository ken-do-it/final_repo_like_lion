# fastapi_app/database.py
import psycopg2
import os

def get_db_connection():
    return psycopg2.connect(
        host="db",
        database="korea_travel_db",
        user="myuser",
        password="mypassword"
    )