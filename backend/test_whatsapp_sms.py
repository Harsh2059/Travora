import asyncio
import os
import sys

# Ensure correct import paths to avoid SQLAlchemy metadata duplication
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from database import SessionLocal
from models import User
from services.whatsapp.service import WhatsAppService
from services.notifications.contracts import NotificationRequest
from datetime import datetime, timezone

import pytest

@pytest.mark.anyio
async def test_notifications():
    db = SessionLocal()
    try:
        # Fetch the most recently created user from the database
        user = db.query(User).filter(User.whatsapp_phone.isnot(None)).order_by(User.id.desc()).first()
        if not user:
            user = db.query(User).filter(User.phone_number.isnot(None)).order_by(User.id.desc()).first()
            
        if not user:
            print("❌ No users found in the database with a phone number.")
            return

        user_phone = user.whatsapp_phone or user.phone_number
        print(f"Found User: {user.name} ({user.email})")
        print(f"Testing WhatsApp for User's Number: {user_phone}...")
        
        whatsapp_service = WhatsAppService()
        request = NotificationRequest(
            recipient=user_phone,
            message_type="TEST",
            text=f"Hello {user.name}! This is a test message from Travora to verify your WhatsApp credentials.",
            timestamp=datetime.now(timezone.utc)
        )
        
        result = whatsapp_service.send(request)
        if result.success:
            print("Success: WhatsApp message sent successfully!")
            print("Message ID:", result.provider_message_id)
        else:
            print("Failed to send WhatsApp message.")
            print("Error:", result.error)
            
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_notifications())
