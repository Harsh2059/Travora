import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from database import engine
from sqlalchemy import text

def add_missing_columns():
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN sms_enabled BOOLEAN DEFAULT TRUE"))
        print("Added sms_enabled")
    except Exception as e:
        print(f"Skipped sms_enabled: {e}")
        
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN whatsapp_enabled BOOLEAN DEFAULT TRUE"))
        print("Added whatsapp_enabled")
    except Exception as e:
        print(f"Skipped whatsapp_enabled: {e}")
        
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN whatsapp_phone VARCHAR"))
        print("Added whatsapp_phone")
    except Exception as e:
        print(f"Skipped whatsapp_phone: {e}")
        
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'user'"))
        print("Added role")
    except Exception as e:
        print(f"Skipped role: {e}")
        
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN auth_provider VARCHAR DEFAULT 'local'"))
        print("Added auth_provider")
    except Exception as e:
        print(f"Skipped auth_provider: {e}")

if __name__ == "__main__":
    add_missing_columns()
