from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import sys
from dotenv import load_dotenv

load_dotenv()

DB_MODE = os.getenv("DB_MODE", "").lower()
DATABASE_URL = os.getenv("DATABASE_URL")
IS_TESTING = "pytest" in sys.modules or os.getenv("TESTING") == "true"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SQLITE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'travel_engine.db')}"

if DB_MODE == "local" or IS_TESTING or (not DATABASE_URL and DB_MODE != "cloud"):
    print("[DB] Database Engine: LOCAL SQLite (travel_engine.db)")
    engine = create_engine(
        SQLITE_URL, connect_args={"check_same_thread": False}
    )
else:
    print("[DB] Database Engine: CLOUD Supabase PostgreSQL")
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
