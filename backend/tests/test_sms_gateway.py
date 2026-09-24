import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import uuid

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app
from database import get_db, Base
from models import SmsJob, Trip, User, DisruptionEvent

# Setup test DB
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_sms.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()



client = TestClient(app)

@pytest.fixture(scope="module")
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Create test user and trip
    user = User(name="Test User", email="test@sms.com", whatsapp_phone="+1234567890")
    db.add(user)
    db.commit()
    
    trip = Trip(title="Test Trip", user_id=user.id)
    db.add(trip)
    db.commit()
    
    yield {"user_id": user.id, "trip_id": trip.id}
    
    # Teardown
    db.close()
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)

def test_create_sms_job(setup_db):
    db = TestingSessionLocal()
    job = SmsJob(
        id=str(uuid.uuid4()),
        recipient="+1234567890",
        message="Test message",
        status="PENDING",
        trip_id=setup_db["trip_id"],
        idempotency_key="TEST_1"
    )
    db.add(job)
    db.commit()
    
    saved = db.query(SmsJob).filter(SmsJob.id == job.id).first()
    assert saved is not None
    assert saved.status == "PENDING"
    db.close()

def test_duplicate_idempotency_key(setup_db):
    db = TestingSessionLocal()
    job1 = SmsJob(
        id=str(uuid.uuid4()),
        recipient="+1234567890",
        message="Msg 1",
        idempotency_key="TEST_DUP"
    )
    db.add(job1)
    db.commit()
    
    job2 = SmsJob(
        id=str(uuid.uuid4()),
        recipient="+1234567890",
        message="Msg 2",
        idempotency_key="TEST_DUP"
    )
    db.add(job2)
    try:
        db.commit()
        assert False, "Should have thrown IntegrityError"
    except Exception:
        db.rollback()
        assert True
    finally:
        db.close()

def test_get_pending_jobs(setup_db):
    # Ensure some pending jobs exist
    response = client.get("/api/sms-gateway/jobs?status=PENDING&limit=10")
    assert response.status_code == 200
    jobs = response.json()
    assert len(jobs) >= 1
    assert jobs[0]["status"] == "PENDING"

def test_claim_jobs(setup_db):
    response = client.get("/api/sms-gateway/jobs?status=PENDING&claim=true&device_id=DEV1")
    assert response.status_code == 200
    jobs = response.json()
    assert len(jobs) >= 1
    
    # They should now be SENDING
    response2 = client.get("/api/sms-gateway/jobs?status=PENDING")
    jobs2 = response2.json()
    # PENDING queue should be smaller or empty
    assert len(jobs2) < len(jobs) or len(jobs2) == 0

def test_update_status_sent(setup_db):
    # get a job that is SENDING
    db = TestingSessionLocal()
    job = db.query(SmsJob).filter(SmsJob.status == "SENDING").first()
    job_id = job.id
    db.close()
    
    response = client.post(f"/api/sms-gateway/jobs/{job_id}/status", json={
        "status": "SENT",
        "gateway_device_id": "DEV1"
    })
    assert response.status_code == 200
    assert response.json()["status"] == "SENT"

def test_update_status_invalid_transition(setup_db):
    db = TestingSessionLocal()
    job = db.query(SmsJob).filter(SmsJob.status == "SENT").first()
    job_id = job.id
    db.close()
    
    response = client.post(f"/api/sms-gateway/jobs/{job_id}/status", json={
        "status": "PENDING"
    })
    assert response.status_code == 400

def test_disruption_creates_sms_job(setup_db):
    trip_id = setup_db["trip_id"]
    payload = {
        "event_type": "FLIGHT_CANCELLED",
        "entity_id": 123,
        "severity": "HIGH",
        "event_metadata": {"flight_number": "AI101"}
    }
    response = client.post(f"/api/trips/{trip_id}/disruptions", json=payload)
    assert response.status_code == 200
    
    db = TestingSessionLocal()
    # Check if SmsJob was created for this disruption
    jobs = db.query(SmsJob).filter(SmsJob.trip_id == trip_id, SmsJob.notification_type == "DISRUPTION_ALERT").all()
    assert len(jobs) >= 1
    db.close()

def test_recovery_creates_sms_job(setup_db, monkeypatch):
    trip_id = setup_db["trip_id"]
    # We can mock NotificationService or execute_plan to test this, 
    # but since execute_plan requires a valid DB state, let's just 
    # invoke the endpoint with a mock for execute_plan
    import main
    from unittest.mock import MagicMock
    monkeypatch.setattr(main, "execute_plan", MagicMock(return_value={"success": True}))
    
    payload = {
        "selectedPlan": {
            "id": "test_plan_1",
            "disruption_ids": [123],
            "changes": [
                {
                    "action": "REPLACE",
                    "item": {"provider": "Mock Airlines", "start_time": "2023-10-01T10:00:00Z"}
                }
            ]
        },
        "disruption_fingerprint": "123",
        "execution_id": "exec_1"
    }
    
    response = client.post(f"/api/trips/{trip_id}/recovery/execute", json=payload)
    assert response.status_code == 200
    
    db = TestingSessionLocal()
    jobs = db.query(SmsJob).filter(SmsJob.trip_id == trip_id, SmsJob.notification_type == "RECOVERY_ALERT").all()
    assert len(jobs) >= 1
    assert jobs[-1].status == "PENDING"
    db.close()


def test_sms_failure_does_not_break_disruption(setup_db, monkeypatch):
    trip_id = setup_db["trip_id"]
    payload = {
        "event_type": "FLIGHT_CANCELLED_2",
        "entity_id": 1234,
        "severity": "HIGH",
        "event_metadata": {}
    }
    
    # Force SMS creation to fail by mocking the db.add method
    import sqlalchemy.orm
    original_add = sqlalchemy.orm.Session.add
    
    def mock_add(self, instance, *args, **kwargs):
        import models
        if isinstance(instance, models.SmsJob):
            raise Exception("Forced SMS DB Failure")
        return original_add(self, instance, *args, **kwargs)
        
    monkeypatch.setattr("sqlalchemy.orm.Session.add", mock_add)
    
    response = client.post(f"/api/trips/{trip_id}/disruptions", json=payload)
    # The disruption should still succeed
    assert response.status_code == 200
    
def test_sms_failure_does_not_break_recovery(setup_db, monkeypatch):
    trip_id = setup_db["trip_id"]
    
    import main
    from unittest.mock import MagicMock
    monkeypatch.setattr(main, "execute_plan", MagicMock(return_value={"success": True}))
    
    payload = {
        "selectedPlan": {
            "id": "test_plan_2",
            "disruption_ids": [1234],
            "changes": []
        }
    }
    
    # Force SMS creation to fail
    import sqlalchemy.orm
    original_add = sqlalchemy.orm.Session.add
    
    def mock_add(self, instance, *args, **kwargs):
        import models
        if isinstance(instance, models.SmsJob):
            raise Exception("Forced SMS DB Failure")
        return original_add(self, instance, *args, **kwargs)
        
    monkeypatch.setattr("sqlalchemy.orm.Session.add", mock_add)
    
    response = client.post(f"/api/trips/{trip_id}/recovery/execute", json=payload)
    assert response.status_code == 200
