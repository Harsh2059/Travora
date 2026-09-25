from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models
from database import Base
from services.whatsapp.client import MetaWhatsAppClient, WhatsAppClientError
from services.whatsapp.config import WhatsAppConfigurationError, WhatsAppSettings
from services.whatsapp.formatter import format_disruption_alert, format_recovery_notification
from services.whatsapp.handler import WhatsAppWebhookHandler
from services.whatsapp.parser import WhatsAppAction, parse_message
from services.whatsapp.service import WhatsAppService


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def plan():
    return {
        "id": "plan-1",
        "title": "Alternative flight ready",
        "disruption_fingerprint": "7",
        "estimated_additional_cost": 2450,
        "changes": [{
            "action": "REPLACE",
            "original_title": "AI-203",
            "new_title": "AI-205",
            "start_time": "2026-09-22T18:40:00",
        }],
    }


class FakeClient:
    def __init__(self, error=None):
        self.error = error
        self.sent = []

    def send_text(self, recipient, text):
        if self.error:
            raise self.error
        self.sent.append((recipient, text))
        return {"messages": [{"id": "wamid.test"}]}


def test_parser_supports_all_actions_and_unknown():
    assert parse_message(" accept ") == WhatsAppAction.ACCEPT_RECOVERY
    assert parse_message("YES") == WhatsAppAction.ACCEPT_RECOVERY
    assert parse_message("details") == WhatsAppAction.VIEW_RECOVERY
    assert parse_message("recovery") == WhatsAppAction.VIEW_RECOVERY
    assert parse_message("decline") == WhatsAppAction.REJECT_RECOVERY
    assert parse_message("help") == WhatsAppAction.HELP
    assert parse_message("what time is it") == WhatsAppAction.UNKNOWN


def test_recovery_message_is_data_driven(plan):
    message = format_recovery_notification(1, plan)
    assert "AI-203 -> AI-205" in message
    assert "INR 2,450.00" in message
    assert "ACCEPT" in message


def test_disruption_message_uses_available_fields():
    message = format_disruption_alert({
        "event_type": "DELAY",
        "severity": "CRITICAL",
        "event_metadata": {
            "affected_location": "Mumbai Airport (BOM)",
            "reason": "Air traffic control holding delay",
            "delay_minutes": 240,
        },
    })
    assert "Mumbai Airport (BOM)" in message
    assert "Air traffic control holding delay" in message
    assert "240 minutes" in message


def test_disruption_notification_fails_without_traveler_number(db_session, monkeypatch):
    user = models.User(name="Demo Traveler", email="alert@example.com")
    db_session.add(user)
    db_session.commit()
    trip = models.Trip(title="Demo trip", user_id=user.id, version=1)
    db_session.add(trip)
    db_session.commit()

    client = FakeClient()
    monkeypatch.setattr("services.whatsapp.service.DEMO_WHATSAPP_NUMBER", "+919999999999")
    service = WhatsAppService(client)
    disruption = {
        "id": 42,
        "event_type": "DELAY",
        "severity": "HIGH",
        "event_metadata": {"delay_minutes": 45},
    }

    first = service.send_disruption_notification(db_session, trip.id, disruption)
    assert first.success is False
    assert first.status == "FAILED"
    assert first.error == "Traveler has no WhatsApp phone number configured."


def test_disruption_notification_failure_is_recorded_without_raising(db_session):
    user, trip = _traveler(db_session)
    service = WhatsAppService(FakeClient(error=OSError("network down")))

    result = service.send_disruption_notification(
        db_session,
        trip.id,
        {"id": 43, "event_type": "CANCELLED", "severity": "HIGH"},
    )

    assert result.status == "FAILED"
    record = db_session.query(models.NotificationRecord).filter_by(disruption_id=43).one()
    assert record.status == "FAILED"


def test_missing_environment_variables_fail_clearly():
    settings = WhatsAppSettings(mode="real", access_token="", phone_number_id="", api_version="v21.0")
    with pytest.raises(WhatsAppConfigurationError, match="WHATSAPP_ACCESS_TOKEN"):
        MetaWhatsAppClient(settings).send_text("919999999999", "test")


def test_meta_api_failure_is_wrapped(monkeypatch):
    def fail(*args, **kwargs):
        raise OSError("network down")

    monkeypatch.setattr("services.whatsapp.client.urlopen", fail)
    settings = WhatsAppSettings(
        access_token="token", phone_number_id="phone", api_version="v21.0"
    )
    with pytest.raises(WhatsAppClientError, match="unavailable"):
        MetaWhatsAppClient(settings).send_text("919999999999", "test")


def test_recovery_notification_fails_when_traveler_number_is_missing(
    db_session, plan, monkeypatch
):
    user = models.User(name="Demo Traveler", email="demo@example.com")
    db_session.add(user)
    db_session.commit()
    trip = models.Trip(title="Demo trip", user_id=user.id, version=1)
    db_session.add(trip)
    db_session.commit()

    client = FakeClient()
    monkeypatch.setattr("services.whatsapp.service.DEMO_WHATSAPP_NUMBER", "+91XXXXXXXXXX")
    result = WhatsAppService(client).send_recovery_notification(
        db_session, trip.id, plan
    )

    assert result.success is False
    assert result.status == "FAILED"
    assert result.error == "Traveler has no WhatsApp phone number configured."


def test_recovery_notification_keeps_configured_traveler_number(db_session, plan):
    user, trip = _traveler(db_session)
    client = FakeClient()

    result = WhatsAppService(client).send_recovery_notification(
        db_session, trip.id, plan
    )

    assert result.success is True
    assert client.sent[0][0] == user.whatsapp_phone


def _traveler(db_session):
    user = models.User(name="Test Traveler", email="traveler@example.com", whatsapp_phone="919999999999")
    db_session.add(user)
    db_session.commit()
    trip = models.Trip(title="Test trip", user_id=user.id, version=1)
    db_session.add(trip)
    db_session.commit()
    return user, trip


def test_help_unknown_missing_traveler_and_missing_plan(db_session, plan):
    client = FakeClient()
    handler = WhatsAppWebhookHandler(client, lambda _: None)
    assert handler.handle(db_session, "910000000000", "help")["action"] == "MISSING_TRAVELER"
    user, trip = _traveler(db_session)
    assert handler.handle(db_session, user.whatsapp_phone, "help")["status"] == "SENT"
    assert handler.handle(db_session, user.whatsapp_phone, "nonsense")["action"] == "UNKNOWN"
    assert handler.handle(db_session, user.whatsapp_phone, "view")["action"] == "MISSING_RECOVERY_PLAN"


def test_view_and_reject_actions(db_session, plan):
    user, trip = _traveler(db_session)
    client = FakeClient()
    handler = WhatsAppWebhookHandler(client, lambda _: plan)
    assert handler.handle(db_session, user.whatsapp_phone, "view")["action"] == "VIEW_RECOVERY"
    assert handler.handle(db_session, user.whatsapp_phone, "reject")["action"] == "REJECT_RECOVERY"
    assert len(client.sent) == 2


def test_accept_calls_existing_execution_and_duplicate_is_safe(db_session, plan, monkeypatch):
    user, trip = _traveler(db_session)
    client = FakeClient()
    calls = []

    def execute(**kwargs):
        calls.append(kwargs)
        return {"status": "COMPLETED", "message": "done"}

    monkeypatch.setattr("services.whatsapp.handler.execute_plan", execute)
    monkeypatch.setattr("services.whatsapp.handler.get_active_disruption_fingerprint", lambda db, trip_id: "7")
    handler = WhatsAppWebhookHandler(client, lambda _: plan)
    first = handler.handle(db_session, user.whatsapp_phone, "accept", "same-event")
    second = handler.handle(db_session, user.whatsapp_phone, "yes", "same-event")
    assert first["result"]["status"] == "COMPLETED"
    assert second["result"]["status"] == "COMPLETED"
    assert calls[0]["execution_id"] == calls[1]["execution_id"]


def test_expired_plan_is_not_executed(db_session, plan, monkeypatch):
    user, trip = _traveler(db_session)
    client = FakeClient()
    monkeypatch.setattr("services.whatsapp.handler.get_active_disruption_fingerprint", lambda db, trip_id: "8")
    handler = WhatsAppWebhookHandler(client, lambda _: plan)
    result = handler.handle(db_session, user.whatsapp_phone, "accept", "event")
    assert result["action"] == "EXPIRED_RECOVERY_PLAN"
    assert not result.get("result")


def test_webhook_verification():
    from fastapi.testclient import TestClient
    from main import app

    import os
    os.environ["WHATSAPP_VERIFY_TOKEN"] = "verify-me"
    response = TestClient(app).get(
        "/webhooks/whatsapp",
        params={"hub.mode": "subscribe", "hub.verify_token": "verify-me", "hub.challenge": "12345"},
    )
    assert response.status_code == 200
    assert response.json() == 12345


def test_malformed_webhook_payload():
    from fastapi.testclient import TestClient
    from main import app

    response = TestClient(app).post("/webhooks/whatsapp", json={"entry": []})
    assert response.status_code == 400
