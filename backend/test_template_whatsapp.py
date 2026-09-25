import asyncio
import os
import sys
import json
from urllib.request import Request, urlopen

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from database import SessionLocal
from models import User

def send_whatsapp_template(phone_number, token, phone_number_id):
    endpoint = f"https://graph.facebook.com/v21.0/{phone_number_id}/messages"
    body = {
        "messaging_product": "whatsapp",
        "to": phone_number,
        "type": "template",
        "template": {
            "name": "hello_world",
            "language": {
                "code": "en_US"
            }
        }
    }
    request = Request(
        endpoint,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=10) as response:
            result = json.loads(response.read().decode("utf-8"))
            print("✅ Template Message Sent Successfully!")
            print("Response:", result)
    except Exception as e:
        print("❌ Failed to send template message:", e)
        if hasattr(e, 'read'):
            print(e.read().decode("utf-8"))

import pytest

@pytest.mark.anyio
async def test_notifications():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.whatsapp_phone.isnot(None)).order_by(User.id.desc()).first()
        if not user:
            print("❌ No users found in the database with a phone number.")
            return

        user_phone = user.whatsapp_phone or user.phone_number
        print(f"Found User: {user.name} ({user.email})")
        print(f"Testing WhatsApp Template for User's Number: {user_phone}...")
        
        token = os.getenv("WHATSAPP_ACCESS_TOKEN")
        phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
        
        send_whatsapp_template(user_phone, token, phone_number_id)
            
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_notifications())
