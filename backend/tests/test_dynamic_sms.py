import pytest
from datetime import datetime, timedelta
from database import SessionLocal, Base, engine
import models
from services.notifications.sms_generator import DynamicSmsGenerator
from services.notifications.service import NotificationService
from services.notifications.contracts import NotificationChannel


@pytest.fixture(scope="module")
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    user = db.query(models.User).filter(models.User.email == "dynamic@sms.com").first()
    if not user:
        user = models.User(name="Dynamic Test User", email="dynamic@sms.com", whatsapp_phone="+919876543210")
        db.add(user)
        db.commit()

    trip = models.Trip(title="Dynamic SMS Test Trip", user_id=user.id)
    db.add(trip)
    db.commit()

    yield {"db": db, "user": user, "trip": trip}
    db.close()


def test_dynamic_disruption_sms_flight():
    disruption = {
        "id": 101,
        "event_type": "FLIGHT_DELAY",
        "event_metadata": {"delay_minutes": 150},
        "item": {
            "type": "FLIGHT",
            "provider": "Vistara",
            "booking_id": "UK-812",
            "origin": "Bangalore",
            "destination": "Delhi",
            "start_time": "2026-09-24T14:30:00",
        },
    }
    msg = DynamicSmsGenerator.generate_disruption_sms(disruption)
    assert "Flight Vistara UK-812" in msg
    assert "(Bangalore → Delhi)" in msg
    assert "delayed by 150 mins" in msg
    assert "Open Travora" in msg
    assert "None" not in msg
    assert "null" not in msg


def test_dynamic_disruption_sms_train():
    disruption = {
        "id": 102,
        "event_type": "TRAIN_CANCEL",
        "item": {
            "type": "TRAIN",
            "provider": "Indian Railways",
            "booking_id": "12951",
            "origin": "Mumbai Central",
            "destination": "New Delhi",
            "start_time": "17:00",
        },
    }
    msg = DynamicSmsGenerator.generate_disruption_sms(disruption)
    assert "Train Indian Railways 12951" in msg
    assert "(Mumbai Central → New Delhi)" in msg
    assert "cancelled" in msg
    assert "None" not in msg


def test_dynamic_disruption_sms_bus():
    disruption = {
        "id": 103,
        "event_type": "BUS_DELAY",
        "item": {
            "type": "BUS",
            "provider": "Zingbus",
            "origin": "Pune",
            "destination": "Goa",
            "start_time": "21:00",
        },
    }
    msg = DynamicSmsGenerator.generate_disruption_sms(disruption)
    assert "Bus Zingbus" in msg
    assert "(Pune → Goa)" in msg
    assert "delayed" in msg


def test_dynamic_recovery_sms_single_segment_with_pnr():
    plan = {
        "id": "PLAN_FLIGHT_RECOVERY",
        "changes": [
            {
                "action": "REPLACE",
                "item": {
                    "type": "FLIGHT",
                    "provider": "Air India",
                    "booking_id": "AI-902",
                    "origin": "Mumbai",
                    "destination": "Delhi",
                    "start_time": "2026-09-24T20:15:00",
                    "end_time": "2026-09-24T22:30:00",
                    "item_metadata": {"pnr": "DEF456"},
                },
            }
        ],
    }
    msg = DynamicSmsGenerator.generate_recovery_sms(plan)
    assert "Recovery confirmed." in msg
    assert "New Flight: Air India AI-902" in msg
    assert "Mumbai → Delhi" in msg
    assert "Departure: 20:15 | Arrival: 22:30" in msg
    assert "PNR/Ref: DEF456" in msg
    assert "None" not in msg


def test_dynamic_recovery_sms_multisegment():
    plan = {
        "id": "PLAN_MULTISEGMENT",
        "changes": [
            {
                "action": "REPLACE",
                "item": {
                    "type": "FLIGHT",
                    "provider": "IndiGo",
                    "booking_id": "6E-501",
                    "origin": "Delhi",
                    "destination": "Jaipur",
                    "start_time": "18:00",
                    "end_time": "19:00",
                    "item_metadata": {"pnr": "IND789"},
                },
            },
            {
                "action": "ADD",
                "item": {
                    "type": "CAB",
                    "provider": "Uber",
                    "origin": "Jaipur Airport",
                    "destination": "Hotel Taj",
                    "start_time": "19:15",
                    "item_metadata": {"booking_reference": "UBER-999"},
                },
            },
        ],
    }
    msg = DynamicSmsGenerator.generate_recovery_sms(plan)
    assert "Recovery confirmed." in msg
    assert "1. Flight: IndiGo 6E-501" in msg
    assert "Delhi → Jaipur" in msg
    assert "PNR/Ref: IND789" in msg
    assert "2. Cab: Uber" in msg
    assert "Jaipur Airport → Hotel Taj" in msg
    assert "PNR/Ref: UBER-999" in msg


def test_different_data_produces_different_sms():
    disr1 = {
        "id": 201,
        "event_type": "FLIGHT_DELAY",
        "item": {"type": "FLIGHT", "provider": "AirlineA", "booking_id": "FL-001", "origin": "CityA", "destination": "CityB"},
    }
    disr2 = {
        "id": 202,
        "event_type": "TRAIN_CANCEL",
        "item": {"type": "TRAIN", "provider": "TrainOperatorB", "booking_id": "TR-999", "origin": "StationC", "destination": "StationD"},
    }
    msg1 = DynamicSmsGenerator.generate_disruption_sms(disr1)
    msg2 = DynamicSmsGenerator.generate_disruption_sms(disr2)

    assert msg1 != msg2
    assert "FL-001" in msg1
    assert "TR-999" in msg2
    assert "CityA" in msg1
    assert "StationC" in msg2


def test_notification_service_sms_disruption_idempotency(setup_db):
    db = setup_db["db"]
    trip = setup_db["trip"]

    # Clean up existing test records if re-running in persistent DB
    db.query(models.NotificationRecord).filter(models.NotificationRecord.disruption_id == 8888).delete()
    db.query(models.SmsJob).filter(models.SmsJob.idempotency_key == "DISR_8888").delete()
    db.commit()

    service = NotificationService()
    disruption = {
        "id": 8888,
        "event_type": "FLIGHT_CANCEL",
        "item": {"type": "FLIGHT", "provider": "TestAir", "booking_id": "TA-100", "origin": "OriginX", "destination": "DestY"},
    }

    # First call queues job
    res1 = service.send_disruption_notification(db, NotificationChannel.SMS, trip.id, disruption)
    assert res1.success is True
    assert res1.status == "QUEUED"

    # Second call detects idempotency key DISR_8888
    res2 = service.send_disruption_notification(db, NotificationChannel.SMS, trip.id, disruption)
    assert res2.success is True
    assert res2.status == "ALREADY_QUEUED"


def test_optional_missing_fields_cleanliness():
    item = {"type": "CAB", "provider": "Ola"}
    seg = DynamicSmsGenerator.extract_segment_info(item)
    assert seg["origin"] is None
    assert seg["destination"] is None
    assert seg["pnr"] is None

    msg = DynamicSmsGenerator.generate_disruption_sms({"event_type": "TRANSFER_FAILURE", "item": item})
    assert "None" not in msg
    assert "null" not in msg
    assert "undefined" not in msg
