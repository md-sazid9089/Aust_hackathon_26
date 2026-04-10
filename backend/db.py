# backend/db.py
"""
Database Connection Utility
===========================
Initializes SQLAlchemy engine using environment variables from .env.
"""
import os
from urllib.parse import quote_plus
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME")
DB_SSL_MODE = os.getenv("DB_SSL_MODE", "require")

# SQLAlchemy connection string
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    safe_user = quote_plus(DB_USER or "")
    safe_password = quote_plus(DB_PASSWORD or "")
    DATABASE_URL = f"mysql+pymysql://{safe_user}:{safe_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

connect_args = {}
if DB_SSL_MODE.lower() == "require":
    # Azure MySQL requires secure transport; use system CA bundle for TLS.
    connect_args = {"ssl": {"ca": "/etc/ssl/certs/ca-certificates.crt"}}

engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True, connect_args=connect_args)


def check_db_connection():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except (OperationalError, Exception) as e:
        print(f"[DB ERROR] {e}")
        return False
