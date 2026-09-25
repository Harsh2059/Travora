import json
from datetime import datetime, timezone
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models
from database import Base
from services.notifications.contracts import NotificationChannel
from services.notifications.service import NotificationService
from services.recovery.execution_engine import execute_plan
from services.whatsapp.client import MetaWhatsAppClient
from services.whatsapp.context import (
    clear_in_memory_contexts,
    get_active_recovery_context,
    get_latest_recovery_context,
    store_recovery_context,
)
from services.whatsapp.formatter import (
    format_disruption_alert,
    format_recovery_confirmation,
    format_whatsapp_recovery_options,
)
from services.whatsapp.handler import WhatsAppWebhookHandler
from services.whatsapp.parser import WhatsAppAction, parse_message_with_option
from services.whatsapp.service import WhatsAppService


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    clear_in_memory_contexts()
    try:
        yield session
    finally:
        session.close()
        clear_in_memory_contexts()


class FakeWhatsAppClient:
    def __init__(self, error=None):
        self.error = error
        self.sent = []

    def send_text(self, recipient, text):
        if self.error:
            raise self.error
        self.sent.append((recipient, text))
        return {"messages": [{"id": f"wamid.{len(self.sent)}"}]}


def _make_traveler_and_trip(db, phone="+919999999999"):
    user = models.User(name="Jane Traveler", email="jane@example.com", whatsapp_phone=phone)
    db.add(user)
    db.commit()
    trip = models.Trip(title="Mumbai to Delhi", user_id=user.id, version=1)
    db.add(trip)
    db.commit()
    item = models.ItineraryItem(
        trip_id=trip.id,
        type="FLIGHT",
        provider="Air India",
        origin="Mumbai",
        destination="Delhi",
        start_time=datetime(2026, 9, 22, 18, 30),
        end_time=datetime(2026, 9, 22, 20, 35),
        cost=5000.0,
        item_metadata={"flight_number": "AI123"},
    )
    db.add(item)
    db.commit()
    return user, trip, item


def _make_sample_plans(trip_id=1):
    plan_a = {
        "id": f"plan_p4_1_{trip_id}",
        "trip_id": trip_id,
        "title": "Priority-Preserving (IndiGo 6E456)",
        "category": "PRIORITY_PRESERVING",
        "is_recommended": True,
        "estimated_additional_cost": 4850.0,
        "cost_estimate": {"estimated_additional_cost": 4850.0, "currency": "INR"},
        "changes": [{
            "node_id": "1",
            "action": "REPLACE",
            "type": "FLIGHT",
            "provider": "IndiGo",
            "original_title": "Flight AI123",
            "original_details": {
                "origin": "Mumbai",
                "destination": "Delhi",
                "start_time": "2026-09-22T18:30:00",
                "flight_number": "AI123",
            },
            "new_title": "IndiGo 6E456",
            "new_details": {
                "flight_number": "6E456",
                "departure_time": "20:15",
                "arrival_time": "22:20",
                "fare": 4850,
            },
            "origin": "Mumbai",
            "destination": "Delhi",
            "start_time": "2026-09-22T20:15:00",
            "end_time": "2026-09-22T22:20:00",
            "estimated_cost": 4850.0,
        }],
    }
    plan_b = {
        "id": f"plan_p4_2_{trip_id}",
        "trip_id": trip_id,
        "title": "Alternative (Rajdhani Express)",
        "category": "ALTERNATIVE",
        "is_recommended": False,
        "estimated_additional_cost": 2450.0,
        "cost_estimate": {"estimated_additional_cost": 2450.0, "currency": "INR"},
        "changes": [{
            "node_id": "1",
            "action": "REPLACE",
            "type": "TRAIN",
            "provider": "Indian Railways",
            "original_title": "Flight AI123",
            "original_details": {
                "origin": "Mumbai",
                "destination": "Delhi",
                "start_time": "2026-09-22T18:30:00",
                "flight_number": "AI123",
            },
            "new_title": "Rajdhani Express",
            "new_details": {
                "train_number": "12951",
                "departure_time": "21:40",
                "arrival_time": "08:15",
                "fare": 2450,
            },
            "origin": "Mumbai",
            "destination": "Delhi",
            "start_time": "2026-09-22T21:40:00",
            "end_time": "2026-09-23T08:15:00",
            "estimated_cost": 2450.0,
        }],
    }
    plan_c = {
        "id": f"plan_p4_3_{trip_id}",
        "trip_id": trip_id,
        "title": "Alternative (Volvo AC)",
        "category": "ALTERNATIVE",
        "is_recommended": False,
        "estimated_additional_cost": 1900.0,
        "cost_estimate": {"estimated_additional_cost": 1900.0, "currency": "INR"},
        "changes": [{
            "node_id": "1",
            "action": "REPLACE",
            "type": "BUS",
            "provider": "Zingbus",
            "original_title": "Flight AI123",
            "original_details": {
                "origin": "Mumbai",
                "destination": "Delhi",
                "start_time": "2026-09-22T18:30:00",
                "flight_number": "AI123",
            },
            "new_title": "Volvo AC",
            "new_details": {
                "departure_time": "19:30",
                "arrival_time": "10:00",
                "fare": 1900,
            },
            "origin": "Mumbai",
            "destination": "Delhi",
            "start_time": "2026-09-22T19:30:00",
            "end_time": "2026-09-23T10:00:00",
            "estimated_cost": 1900.0,
        }],
    }
    return [plan_a, plan_b, plan_c]


# 1. Disruption creates WhatsApp options
def test_1_disruption_creates_whatsapp_options(db_session):
    user, trip, item = _make_traveler_and_trip(db_session)
    client = FakeWhatsAppClient()
    service = WhatsAppService(client)
    plans = _make_sample_plans(trip.id)[:2]

    disruption = {
        "id": 101,
        "event_type": "CANCELLATION",
        "item": {
            "type": "FLIGHT",
            "provider": "Air India",
            "origin": "Mumbai",
            "destination": "Delhi",
            "flight_number": "AI123",
            "start_time": "2026-09-22T18:30:00",
        },
    }

    result = service.send_disruption_notification(db_session, trip.id, disruption, plans=plans)
    assert result.success is True
    assert len(client.sent) == 1
    recipient, msg = client.sent[0]
    assert recipient == user.whatsapp_phone
    assert "🚨 TRAVORA TRAVEL ALERT" in msg
    assert "Mumbai → Delhi" in msg
    assert "Flight: AI123" in msg
    assert "1️⃣ ✈️ Alternative Flight" in msg
    assert "2️⃣ 🚆 Train" in msg
    assert "👉 Reply with:" in msg


# 2. Two recovery plans produce options 1 and 2
def test_2_two_recovery_plans_produce_options_1_and_2():
    plans = _make_sample_plans()[:2]
    msg = format_whatsapp_recovery_options(1, None, plans)
    assert "1️⃣" in msg
    assert "2️⃣" in msg
    assert "3️⃣" not in msg
    assert "1️⃣ Select Option 1" in msg
    assert "2️⃣ Select Option 2" in msg
    assert "3️⃣ Select Option 3" not in msg


# 3. Three recovery plans produce options 1, 2 and 3
def test_3_three_recovery_plans_produce_options_1_2_and_3():
    plans = _make_sample_plans()[:3]
    msg = format_whatsapp_recovery_options(1, None, plans)
    assert "1️⃣ ✈️ Alternative Flight" in msg
    assert "2️⃣ 🚆 Train" in msg
    assert "3️⃣ 🚌 Bus" in msg
    assert "1️⃣ Select Option 1" in msg
    assert "2️⃣ Select Option 2" in msg
    assert "3️⃣ Select Option 3" in msg
    assert "Reply 0️⃣ to cancel." in msg


# 4. No fake options are displayed and no null/None printed
def test_4_no_fake_options_are_displayed():
    # Only 1 plan provided
    plans = [_make_sample_plans()[0]]
    msg = format_whatsapp_recovery_options(1, None, plans)
    assert "1️⃣" in msg
    assert "2️⃣" not in msg
    assert "None" not in msg
    assert "null" not in msg
    assert "undefined" not in msg


# 5. Option 1 resolves to the correct actual plan
def test_5_option_1_resolves_to_correct_actual_plan(db_session, monkeypatch):
    user, trip, item = _make_traveler_and_trip(db_session)
    plans = _make_sample_plans(trip.id)
    store_recovery_context(
        db=db_session,
        sender=user.whatsapp_phone,
        trip_id=trip.id,
        disruption_id=101,
        disruption_fingerprint="101",
        plans=plans,
    )

    executed_plans = []
    def fake_execute(**kwargs):
        executed_plans.append(kwargs["plan"])
        return {
            "status": "COMPLETED",
            "message": "booked",
            "confirmed_bookings": [{
                "status": "BOOKED",
                "replacement_title": "IndiGo 6E456",
                "provider": "IndiGo",
                "type": "FLIGHT",
                "origin": "Mumbai",
                "destination": "Delhi",
                "departure_time": "2026-09-22T20:15:00",
                "arrival_time": "2026-09-22T22:20:00",
                "pnr": "IND123",
            }],
        }

    monkeypatch.setattr("services.whatsapp.handler.execute_plan", fake_execute)
    monkeypatch.setattr("services.whatsapp.handler.get_active_disruption_fingerprint", lambda db, tid: "101")

    client = FakeWhatsAppClient()
    handler = WhatsAppWebhookHandler(client)
    res = handler.handle(db_session, user.whatsapp_phone, "1")

    assert res["status"] == "SENT"
    assert len(executed_plans) == 1
    assert executed_plans[0]["id"] == plans[0]["id"]
    assert "IndiGo" in executed_plans[0]["title"]
    # Check confirmation message sent
    assert "✅ RECOVERY CONFIRMED" in client.sent[0][1]
    assert "IndiGo 6E456" in client.sent[0][1]
    assert "PNR: IND123" in client.sent[0][1]


# 6. Option 2 resolves to the correct actual plan
def test_6_option_2_resolves_to_correct_actual_plan(db_session, monkeypatch):
    user, trip, item = _make_traveler_and_trip(db_session)
    plans = _make_sample_plans(trip.id)
    store_recovery_context(
        db=db_session,
        sender=user.whatsapp_phone,
        trip_id=trip.id,
        disruption_id=101,
        disruption_fingerprint="101",
        plans=plans,
    )

    executed_plans = []
    def fake_execute(**kwargs):
        executed_plans.append(kwargs["plan"])
        return {
            "status": "COMPLETED",
            "message": "booked",
            "confirmed_bookings": [{
                "status": "BOOKED",
                "replacement_title": "Rajdhani Express",
                "provider": "Indian Railways",
                "type": "TRAIN",
                "origin": "Mumbai",
                "destination": "Delhi",
                "departure_time": "2026-09-22T21:40:00",
                "arrival_time": "2026-09-23T08:15:00",
                "pnr": "PNR-TRAIN-456",
            }],
        }

    monkeypatch.setattr("services.whatsapp.handler.execute_plan", fake_execute)
    monkeypatch.setattr("services.whatsapp.handler.get_active_disruption_fingerprint", lambda db, tid: "101")

    client = FakeWhatsAppClient()
    handler = WhatsAppWebhookHandler(client)
    # Test with keycap emoji
    res = handler.handle(db_session, user.whatsapp_phone, "2️⃣")

    assert res["status"] == "SENT"
    assert len(executed_plans) == 1
    assert executed_plans[0]["id"] == plans[1]["id"]
    assert "Rajdhani" in executed_plans[0]["title"]
    assert "Rajdhani Express" in client.sent[0][1]


# 7. Invalid option does not execute anything
def test_7_invalid_option_does_not_execute_anything(db_session, monkeypatch):
    user, trip, item = _make_traveler_and_trip(db_session)
    plans = _make_sample_plans(trip.id)[:2]  # only 1 and 2
    store_recovery_context(
        db=db_session,
        sender=user.whatsapp_phone,
        trip_id=trip.id,
        disruption_id=101,
        disruption_fingerprint="101",
        plans=plans,
    )

    execute_called = []
    monkeypatch.setattr("services.whatsapp.handler.execute_plan", lambda **kw: execute_called.append(kw))

    client = FakeWhatsAppClient()
    handler = WhatsAppWebhookHandler(client)
    res = handler.handle(db_session, user.whatsapp_phone, "5")

    assert res["action"] == "INVALID_OPTION"
    assert len(execute_called) == 0
    assert "⚠️ Invalid option." in client.sent[0][1]
    assert "Please reply with one of the available recovery option numbers." in client.sent[0][1]


# 8. 0 cancels
def test_8_zero_cancels_active_recovery(db_session):
    user, trip, item = _make_traveler_and_trip(db_session)
    plans = _make_sample_plans(trip.id)
    ctx = store_recovery_context(
        db=db_session,
        sender=user.whatsapp_phone,
        trip_id=trip.id,
        disruption_id=101,
        disruption_fingerprint="101",
        plans=plans,
    )
    assert ctx.status == "ACTIVE"

    client = FakeWhatsAppClient()
    handler = WhatsAppWebhookHandler(client)
    res = handler.handle(db_session, user.whatsapp_phone, "0")

    assert res["action"] == "CANCEL_RECOVERY"
    assert "❌ Recovery selection cancelled." in client.sent[0][1]
    assert "Your journey has not been changed." in client.sent[0][1]

    # Verify context is cancelled
    active = get_active_recovery_context(db_session, user.whatsapp_phone, trip.id)
    assert active is None


# 9. No active context gives a friendly response
def test_9_no_active_context_gives_friendly_response(db_session):
    user, trip, item = _make_traveler_and_trip(db_session)
    client = FakeWhatsAppClient()
    handler = WhatsAppWebhookHandler(client)
    res = handler.handle(db_session, user.whatsapp_phone, "1")

    assert res["action"] == "NO_ACTIVE_RECOVERY"
    assert "ℹ️ There is no active recovery selection for your journey." in client.sent[0][1]


# 10. Duplicate "1" does not execute twice
def test_10_duplicate_one_does_not_execute_twice(db_session, monkeypatch):
    user, trip, item = _make_traveler_and_trip(db_session)
    plans = _make_sample_plans(trip.id)
    store_recovery_context(
        db=db_session,
        sender=user.whatsapp_phone,
        trip_id=trip.id,
        disruption_id=101,
        disruption_fingerprint="101",
        plans=plans,
    )

    call_count = [0]
    def fake_execute(**kwargs):
        call_count[0] += 1
        return {
            "status": "COMPLETED",
            "message": "booked",
            "confirmed_bookings": [{"status": "BOOKED", "provider": "IndiGo", "pnr": "IND1"}],
        }

    monkeypatch.setattr("services.whatsapp.handler.execute_plan", fake_execute)
    monkeypatch.setattr("services.whatsapp.handler.get_active_disruption_fingerprint", lambda db, tid: "101")

    client = FakeWhatsAppClient()
    handler = WhatsAppWebhookHandler(client)

    # First send: executes
    first_res = handler.handle(db_session, user.whatsapp_phone, "1")
    assert first_res["action"] == "SELECT_OPTION"
    assert call_count[0] == 1

    # Second send: idempotent notice, does NOT call execute again
    second_res = handler.handle(db_session, user.whatsapp_phone, "1")
    assert second_res["action"] == "ALREADY_SELECTED"
    assert call_count[0] == 1  # Not incremented!
    assert "ℹ️ This recovery option has already been selected." in client.sent[1][1]


# 11. Multiple disruptions keep separate option mappings
def test_11_multiple_disruptions_keep_separate_mappings(db_session):
    user, trip, item = _make_traveler_and_trip(db_session)
    plans_a = _make_sample_plans(trip.id)[:2]
    plans_b = [
        {
            "id": "plan_b_custom_1",
            "trip_id": trip.id,
            "title": "Disruption B Plan",
            "changes": [{
                "node_id": "1",
                "action": "REPLACE",
                "type": "BUS",
                "provider": "IntrCity",
                "new_title": "IntrCity SmartBus",
            }],
        }
    ]

    # Disruption A
    ctx_a = store_recovery_context(
        db=db_session,
        sender=user.whatsapp_phone,
        trip_id=trip.id,
        disruption_id=201,
        disruption_fingerprint="201",
        plans=plans_a,
    )

    # Disruption B
    ctx_b = store_recovery_context(
        db=db_session,
        sender=user.whatsapp_phone,
        trip_id=trip.id,
        disruption_id=202,
        disruption_fingerprint="202",
        plans=plans_b,
    )

    # Retrieve context A specifically
    fetched_a = get_active_recovery_context(db_session, user.whatsapp_phone, trip.id, disruption_id=201)
    assert fetched_a is not None
    assert fetched_a.options["1"] == plans_a[0]["id"]
    assert fetched_a.disruption_id == 201

    # Retrieve context B specifically
    fetched_b = get_active_recovery_context(db_session, user.whatsapp_phone, trip.id, disruption_id=202)
    assert fetched_b is not None
    assert fetched_b.options["1"] == "plan_b_custom_1"
    assert fetched_b.disruption_id == 202

    # Context A was not deleted
    assert fetched_a.options["1"] != fetched_b.options["1"]


# 12. Dynamic confirmation formatting handles missing optional fields cleanly
def test_12_dynamic_confirmation_format_clean():
    plan = {
        "changes": [{
            "type": "CAB",
            "new_title": "Uber Premier",
            "origin": "Airport",
            "destination": "Hotel",
        }]
    }
    result = {
        "status": "COMPLETED",
        "confirmed_bookings": [{
            "type": "CAB",
            "replacement_title": "Uber Premier",
            "origin": "Airport",
            "destination": "Hotel",
            "pnr": None,  # no PNR for cab
            "departure_time": None,
        }],
    }
    msg = format_recovery_confirmation(plan, result)
    assert "✅ RECOVERY CONFIRMED" in msg
    assert "🚕 New Journey" in msg
    assert "Uber Premier" in msg
    assert "Airport → Hotel" in msg
    assert "PNR:" not in msg
    assert "None" not in msg
    assert "null" not in msg


# 13. Regression: Fresh disruption -> generate options -> store context -> immediate reply "1" -> executes successfully
def test_13_disruption_generate_options_store_context_immediate_reply_succeeds(db_session, monkeypatch):
    user, trip, item = _make_traveler_and_trip(db_session)
    disruption = models.DisruptionEvent(
        trip_id=trip.id,
        event_type="FLIGHT_CANCELLED",
        entity_id=item.id,
        severity="HIGH",
        status="ACTIVE",
        timestamp=datetime.utcnow()
    )
    db_session.add(disruption)
    db_session.commit()

    client = FakeWhatsAppClient()
    service = WhatsAppService(client)
    plans = _make_sample_plans(trip.id)
    disruption_dict = {"id": disruption.id, "event_id": disruption.id, "event_type": "FLIGHT_CANCELLED"}

    # Disruption alert with options sent to user
    res_notif = service.send_disruption_notification(
        db=db_session,
        trip_id=trip.id,
        disruption=disruption_dict,
        plans=plans,
    )
    assert res_notif.success is True

    executed = []
    def fake_execute(**kwargs):
        executed.append(kwargs)
        return {
            "status": "COMPLETED",
            "message": "booked",
            "confirmed_bookings": [{
                "status": "BOOKED",
                "replacement_title": "IndiGo 6E456",
                "provider": "IndiGo",
                "type": "FLIGHT",
                "origin": "Mumbai",
                "destination": "Delhi",
                "departure_time": "2026-09-22T20:15:00",
                "arrival_time": "2026-09-22T22:20:00",
                "pnr": "IND123",
            }],
        }

    monkeypatch.setattr("services.whatsapp.handler.execute_plan", fake_execute)

    # Traveler immediately replies "1"
    handler = WhatsAppWebhookHandler(client)
    reply_res = handler.handle(db_session, user.whatsapp_phone, "1")

    # MUST NOT be EXPIRED_RECOVERY_PLAN
    assert reply_res["action"] == "SELECT_OPTION"
    assert reply_res["status"] == "SENT"
    assert len(executed) == 1
    assert executed[0]["plan"]["id"] == plans[0]["id"]
    assert "✅ RECOVERY CONFIRMED" in client.sent[-1][1]

    # Verify context is marked SELECTED
    ctx = get_active_recovery_context(db_session, user.whatsapp_phone, trip.id)
    assert ctx is None  # no longer ACTIVE
    latest = get_latest_recovery_context(db_session, user.whatsapp_phone, trip.id)
    assert latest.status == "SELECTED"
    assert latest.selected_option == "1"


# 14. Regression: Genuinely changed journey causes stale-plan protection to work
def test_14_genuinely_changed_journey_causes_stale_plan_protection(db_session, monkeypatch):
    user, trip, item = _make_traveler_and_trip(db_session)
    disruption1 = models.DisruptionEvent(
        trip_id=trip.id,
        event_type="FLIGHT_CANCELLED",
        entity_id=item.id,
        severity="HIGH",
        status="ACTIVE",
        timestamp=datetime.utcnow()
    )
    db_session.add(disruption1)
    db_session.commit()

    client = FakeWhatsAppClient()
    service = WhatsAppService(client)
    plans = _make_sample_plans(trip.id)
    disruption_dict = {"id": disruption1.id, "event_id": disruption1.id, "event_type": "FLIGHT_CANCELLED"}

    service.send_disruption_notification(
        db=db_session,
        trip_id=trip.id,
        disruption=disruption_dict,
        plans=plans,
    )

    # Journey genuinely changes: a second disruption occurs before user replies
    item2 = models.ItineraryItem(
        trip_id=trip.id,
        type="HOTEL",
        provider="Taj",
        location="Delhi",
        cost=8000.0,
    )
    db_session.add(item2)
    db_session.commit()

    disruption2 = models.DisruptionEvent(
        trip_id=trip.id,
        event_type="HOTEL_BOOKING_CANCELLED",
        entity_id=item2.id,
        severity="HIGH",
        status="ACTIVE",
        timestamp=datetime.utcnow()
    )
    db_session.add(disruption2)
    db_session.commit()

    executed = []
    def fake_execute(**kwargs):
        executed.append(kwargs)
        return {"status": "COMPLETED"}

    monkeypatch.setattr("services.whatsapp.handler.execute_plan", fake_execute)

    # Traveler replies "1" to the stale options
    handler = WhatsAppWebhookHandler(client)
    reply_res = handler.handle(db_session, user.whatsapp_phone, "1")

    # MUST be caught by stale-plan protection
    assert reply_res["action"] == "EXPIRED_RECOVERY_PLAN"
    assert len(executed) == 0
    assert "This recovery plan has expired because your journey changed" in client.sent[-1][1]


# 15. Regression: Multi-trip traveler correctly routes WhatsApp reply to the trip with active recovery
def test_15_multi_trip_traveler_routes_to_active_recovery_trip(db_session, monkeypatch):
    user = models.User(name="Multi Trip Traveler", email="multi@example.com", whatsapp_phone="+918888888888")
    db_session.add(user)
    db_session.commit()

    # Trip 10 and Trip 20
    trip10 = models.Trip(id=10, title="Trip 10", user_id=user.id)
    trip20 = models.Trip(id=20, title="Trip 20", user_id=user.id)
    db_session.add_all([trip10, trip20])
    db_session.commit()

    item10 = models.ItineraryItem(trip_id=trip10.id, type="FLIGHT", provider="IndiGo", cost=3000.0)
    db_session.add(item10)
    db_session.commit()

    disruption10 = models.DisruptionEvent(
        trip_id=trip10.id,
        event_type="FLIGHT_CANCELLED",
        entity_id=item10.id,
        status="ACTIVE",
        timestamp=datetime.utcnow()
    )
    db_session.add(disruption10)
    db_session.commit()

    client = FakeWhatsAppClient()
    service = WhatsAppService(client)
    plans10 = _make_sample_plans(trip10.id)

    service.send_disruption_notification(
        db=db_session,
        trip_id=trip10.id,
        disruption={"id": disruption10.id, "event_id": disruption10.id, "event_type": "FLIGHT_CANCELLED"},
        plans=plans10,
    )

    executed_trips = []
    def fake_execute(**kwargs):
        executed_trips.append(kwargs["trip_id"])
        return {
            "status": "COMPLETED",
            "message": "booked",
            "confirmed_bookings": [{
                "status": "BOOKED",
                "replacement_title": "IndiGo 6E456",
                "provider": "IndiGo",
                "type": "FLIGHT",
                "origin": "Mumbai",
                "destination": "Delhi",
                "departure_time": "2026-09-22T20:15:00",
                "arrival_time": "2026-09-22T22:20:00",
                "pnr": "IND123",
            }],
        }

    monkeypatch.setattr("services.whatsapp.handler.execute_plan", fake_execute)

    handler = WhatsAppWebhookHandler(client)
    reply_res = handler.handle(db_session, user.whatsapp_phone, "1")

    assert reply_res["action"] == "SELECT_OPTION"
    assert reply_res["status"] == "SENT"
    assert executed_trips == [10]  # Targeted Trip 10 despite Trip 20 having higher ID

