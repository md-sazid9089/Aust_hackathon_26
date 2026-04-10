# backend/db.py
"""
Database Connection Utility
===========================
Initializes SQLAlchemy engine using environment variables from .env.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')
DB_HOST = os.getenv('DB_HOST')
DB_PORT = os.getenv('DB_PORT', '3306')
DB_NAME = os.getenv('DB_NAME')
DB_SSL_MODE = os.getenv('DB_SSL_MODE', 'require')

# SQLAlchemy connection string
DATABASE_URL = (
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    f"?ssl_mode={DB_SSL_MODE}"
)

engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)

def check_db_connection():
    try:
        with engine.connect() as conn:
            conn.execute("SELECT 1")
        return True
    except OperationalError as e:
        print(f"[DB ERROR] {e}")
        return False
