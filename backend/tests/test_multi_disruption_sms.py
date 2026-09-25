"""
test_multi_disruption_sms.py

Tests for multi-disruption SMS notification behavior.

CORRECT BEHAVIOR:
  Disruption A → SmsJob A
  Disruption B → SmsJob B
  Retry A      → NO DUPLICATE (idempotency)

Covers:
  1. One disruption → one SMS
  2. Two disruptions on same trip → two SMS
  3. Three disruptions on same trip → three SMS
  4. Retry same disruption → no duplicate
  5. Different disruptions → different idempotency keys
  6. Different disruptions → dynamically different messages
  7. Multiple pending jobs → all claimable
  8. SMS failure does not break disruption creation
  9. Recovery SMS still works (separate namespace: REC_ vs DISR_)
"""

import uuid
import pytest
from datetime import datetime, timedelta

from database import SessionLocal, Base, engine
import models
from services.notifications.service import NotificationService
from services.notifications.contracts import NotificationChannel


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def db():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="module")
def test_user(db):
    email = "multi_disruption_sms_test@travora.com"
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        user = models.User(
            name="Multi Disruption SMS Test User",
            email=email,
            whatsapp_phone="+917710989533",
        )
        db.add(user)
        db.commit()
    return user


@pytest.fixture()
def trip_with_items(db, test_user):
    """Create a fresh trip with two itinerary items; clean up after test."""
    trip = models.Trip(title="Multi Disruption Test Trip", user_id=test_user.id)
    db.add(trip)
    db.commit()

    item1 = models.ItineraryItem(
        trip_id=trip.id, type="FLIGHT", provider="TestAir",
        origin="BOM", destination="DEL",
        start_time=datetime(2026, 12, 1, 10, 0),
        end_time=datetime(2026, 12, 1, 12, 0), cost=5000,
    )
    item2 = models.ItineraryItem(
        trip_id=trip.id, type="HOTEL", provider="TestHotel",
        location="Delhi",
        start_time=datetime(2026, 12, 1, 14, 0),
        end_time=datetime(2026, 12, 3, 12, 0), cost=8000,
    )
    item3 = models.ItineraryItem(
        trip_id=trip.id, type="TRAIN", provider="Indian Railways",
        origin="Delhi", destination="Jaipur",
        start_time=datetime(2026, 12, 3, 15, 0),
        end_time=datetime(2026, 12, 3, 19, 0), cost=1200,
    )
    db.add_all([item1, item2, item3])
    db.commit()

    yield {"trip": trip, "item1": item1, "item2": item2, "item3": item3}

    # Cleanup
    db.query(models.SmsJob).filter(models.SmsJob.trip_id == trip.id).delete()
    db.query(models.DisruptionEvent).filter(models.DisruptionEvent.trip_id == trip.id).delete()
    db.query(models.ItineraryItem).filter(models.ItineraryItem.trip_id == trip.id).delete()
    db.delete(trip)
    db.commit()


def _make_disruption(db, trip_id, event_type, entity_id):
    """Helper: create and commit a DisruptionEvent."""
    d = models.DisruptionEvent(trip_id=trip_id, event_type=event_type, entity_id=entity_id)
    db.add(d)
    db.commit()
    return d


def _make_payload(disr, item=None):
    """Build the disruption_for_notification dict like main.py does."""
    item_dict = {}
    if item:
        item_dict = {
            "type": item.type,
            "provider": item.provider,
            "origin": getattr(item, "origin", None),
            "destination": getattr(item, "destination", None),
            "location": getattr(item, "location", None),
        }
    return {
        "id": disr.id,
        "event_id": disr.id,
        "trip_id": disr.trip_id,
        "entity_id": disr.entity_id,
        "event_type": disr.event_type,
        "item": item_dict,
    }


def _sms_jobs_for_trip(db, trip_id):
    return db.query(models.SmsJob).filter(models.SmsJob.trip_id == trip_id).all()


# ─── Tests ───────────────────────────────────────────────────────────────────

class TestOneDisruptionOneSms:
    def test_one_disruption_creates_one_sms_job(self, db, trip_with_items):
        trip = trip_with_items["trip"]
        item1 = trip_with_items["item1"]
        svc = NotificationService()

        d1 = _make_disruption(db, trip.id, "FLIGHT_CANCELLED", item1.id)
        payload = _make_payload(d1, item1)

        result = svc.send_disruption_notification(db, NotificationChannel.SMS, trip.id, payload)

        assert result.success is True
        assert result.status == "QUEUED"

        jobs = _sms_jobs_for_trip(db, trip.id)
        assert len(jobs) == 1
        assert jobs[0].idempotency_key == f"DISR_{d1.id}"
        assert jobs[0].notification_type == "DISRUPTION_ALERT"
        assert jobs[0].status == "PENDING"
        assert jobs[0].message  # non-empty


class TestTwoDisruptionsTwoSms:
    def test_two_disruptions_create_two_sms_jobs(self, db, trip_with_items):
        trip = trip_with_items["trip"]
        item1 = trip_with_items["item1"]
        item2 = trip_with_items["item2"]
        svc = NotificationService()

        # First disruption: flight cancelled
        d1 = _make_disruption(db, trip.id, "FLIGHT_CANCELLED", item1.id)
        r1 = svc.send_disruption_notification(db, NotificationChannel.SMS, trip.id, _make_payload(d1, item1))
        assert r1.status == "QUEUED"

        # Second disruption: hotel cancelled
        d2 = _make_disruption(db, trip.id, "HOTEL_CANCELLED", item2.id)
        r2 = svc.send_disruption_notification(db, NotificationChannel.SMS, trip.id, _make_payload(d2, item2))
        assert r2.status == "QUEUED"

        jobs = _sms_jobs_for_trip(db, trip.id)
        assert len(jobs) == 2, f"Expected 2 SMS jobs, got {len(jobs)}"

        keys = {j.idempotency_key for j in jobs}
        assert f"DISR_{d1.id}" in keys
        assert f"DISR_{d2.id}" in keys


class TestThreeDisruptionsThreeSms:
    def test_three_disruptions_create_three_sms_jobs(self, db, trip_with_items):
        trip = trip_with_items["trip"]
        item1 = trip_with_items["item1"]
        item2 = trip_with_items["item2"]
        item3 = trip_with_items["item3"]
        svc = NotificationService()

        d1 = _make_disruption(db, trip.id, "FLIGHT_CANCELLED", item1.id)
        d2 = _make_disruption(db, trip.id, "HOTEL_CANCELLED", item2.id)
        d3 = _make_disruption(db, trip.id, "TRAIN_DELAY", item3.id)

        for disr, item in [(d1, item1), (d2, item2), (d3, item3)]:
            r = svc.send_disruption_notification(db, NotificationChannel.SMS, trip.id, _make_payload(disr, item))
            assert r.status == "QUEUED", f"Expected QUEUED for DISR_{disr.id}, got {r.status}"

        jobs = _sms_jobs_for_trip(db, trip.id)
        assert len(jobs) == 3, f"Expected 3 SMS jobs, got {len(jobs)}"


class TestRetryNoDuplicate:
    def test_retry_same_disruption_no_duplicate_sms(self, db, trip_with_items):
        trip = trip_with_items["trip"]
        item1 = trip_with_items["item1"]
        svc = NotificationService()

        d1 = _make_disruption(db, trip.id, "FLIGHT_DELAYED", item1.id)
        payload = _make_payload(d1, item1)

        r1 = svc.send_disruption_notification(db, NotificationChannel.SMS, trip.id, payload)
        assert r1.status == "QUEUED"

        # Retry same disruption
        r2 = svc.send_disruption_notification(db, NotificationChannel.SMS, trip.id, payload)
        assert r2.status == "ALREADY_QUEUED"
        assert r2.success is True

        # Retry a third time — still no new job
        r3 = svc.send_disruption_notification(db, NotificationChannel.SMS, trip.id, payload)
        assert r3.status == "ALREADY_QUEUED"

        jobs = _sms_jobs_for_trip(db, trip.id)
        disr_jobs = [j for j in jobs if j.idempotency_key == f"DISR_{d1.id}"]
        assert len(disr_jobs) == 1, "Retry must NOT create a duplicate SmsJob"


class TestDifferentIdempotencyKeys:
    def test_different_disruptions_have_different_idempotency_keys(self, db, trip_with_items):
        trip = trip_with_items["trip"]
        item1 = trip_with_items["item1"]
        item2 = trip_with_items["item2"]
        svc = NotificationService()

        d1 = _make_disruption(db, trip.id, "FLIGHT_CANCELLED", item1.id)
        d2 = _make_disruption(db, trip.id, "HOTEL_CANCELLED", item2.id)

        svc.send_disruption_notification(db, NotificationChannel.SMS, trip.id, _make_payload(d1, item1))
        svc.send_disruption_notification(db, NotificationChannel.SMS, trip.id, _make_payload(d2, item2))

        jobs = _sms_jobs_for_trip(db, trip.id)
        keys = [j.idempotency_key for j in jobs]
        assert len(set(keys)) == len(keys), "Each disruption must have a unique idempotency key"
        assert f"DISR_{d1.id}" in keys
        assert f"DISR_{d2.id}" in keys
        # Keys must NOT be based on trip_id alone
        assert keys[0] != keys[1]


class TestDifferentMessagesForDifferentDisruptions:
    def test_different_disruptions_produce_different_messages(self, db, trip_with_items):
        trip = trip_with_items["trip"]
        item1 = trip_with_items["item1"]
        item2 = trip_with_items["item2"]
        svc = NotificationService()

        d1 = _make_disruption(db, trip.id, "FLIGHT_CANCELLED", item1.id)
        d2 = _make_disruption(db, trip.id, "HOTEL_CANCELLED", item2.id)

        svc.send_disruption_notification(db, NotificationChannel.SMS, trip.id, _make_payload(d1, item1))
        svc.send_disruption_notification(db, NotificationChannel.SMS, trip.id, _make_payload(d2, item2))

        jobs = _sms_jobs_for_trip(db, trip.id)
        msg_d1 = next(j.message for j in jobs if j.idempotency_key == f"DISR_{d1.id}")
        msg_d2 = next(j.message for j in jobs if j.idempotency_key == f"DISR_{d2.id}")

        # Messages must be different
        assert msg_d1 != msg_d2, "Each disruption must generate a unique dynamic message"

        # Flight message must mention FLIGHT item details
        assert item1.provider in msg_d1 or item1.type.capitalize() in msg_d1

        # Hotel message must mention HOTEL item details
        assert item2.provider in msg_d2 or item2.type.capitalize() in msg_d2


class TestMultiplePendingJobsAllClaimable:
    def test_multiple_pending_jobs_all_have_pending_status(self, db, trip_with_items):
        """All SMS jobs are created as PENDING, making them claimable by the gateway."""
        trip = trip_with_items["trip"]
        item1 = trip_with_items["item1"]
        item2 = trip_with_items["item2"]
        svc = NotificationService()

        d1 = _make_disruption(db, trip.id, "FLIGHT_CANCELLED", item1.id)
        d2 = _make_disruption(db, trip.id, "HOTEL_CANCELLED", item2.id)

        svc.send_disruption_notification(db, NotificationChannel.SMS, trip.id, _make_payload(d1, item1))
        svc.send_disruption_notification(db, NotificationChannel.SMS, trip.id, _make_payload(d2, item2))

        jobs = _sms_jobs_for_trip(db, trip.id)
        pending_jobs = [j for j in jobs if j.status == "PENDING"]
        # Both jobs must be PENDING (not SENT, FAILED, or SENDING)
        assert len(pending_jobs) == 2, (
            f"Expected 2 PENDING jobs (claimable by gateway), got: "
            f"{[(j.idempotency_key, j.status) for j in jobs]}"
        )


class TestSmsFailureDoesNotBreakDisruptionCreation:
    def test_missing_recipient_returns_failed_but_does_not_raise(self, db, trip_with_items):
        """If no recipient is configured, the SMS path returns FAILED without raising."""
        trip = trip_with_items["trip"]
        item1 = trip_with_items["item1"]

        # Create a trip with a user that has NO phone number
        no_phone_user = models.User(
            name="No Phone User",
            email=f"nophone_{uuid.uuid4().hex[:8]}@travora.com",
            whatsapp_phone=None,
        )
        db.add(no_phone_user)
        db.commit()

        no_phone_trip = models.Trip(title="No Phone Trip", user_id=no_phone_user.id)
        db.add(no_phone_trip)
        db.commit()

        svc = NotificationService()
        d = _make_disruption(db, no_phone_trip.id, "FLIGHT_CANCELLED", item1.id)

        import unittest.mock as mock
        # Patch DEMO_SMS_RECIPIENT to empty so no fallback phone
        with mock.patch.dict("os.environ", {"DEMO_SMS_RECIPIENT": ""}):
            result = svc.send_disruption_notification(
                db, NotificationChannel.SMS, no_phone_trip.id, _make_payload(d, item1)
            )

        assert result.success is False
        assert result.recipient == ""
        assert result.status == "FAILED"
        assert result.error == "No recipient phone number available."

        # Cleanup
        db.query(models.SmsJob).filter(models.SmsJob.trip_id == no_phone_trip.id).delete()
        db.query(models.DisruptionEvent).filter(models.DisruptionEvent.trip_id == no_phone_trip.id).delete()
        db.delete(no_phone_trip)
        db.delete(no_phone_user)
        db.commit()


class TestRecoverySmsNamespaceIntact:
    def test_recovery_sms_uses_rec_prefix_not_disr(self, db, trip_with_items):
        """Recovery SMS idempotency key must use REC_ prefix, not DISR_, so namespaces don't collide."""
        trip = trip_with_items["trip"]
        item1 = trip_with_items["item1"]
        svc = NotificationService()

        # Disruption SMS → DISR_ prefix
        d1 = _make_disruption(db, trip.id, "FLIGHT_CANCELLED", item1.id)
        svc.send_disruption_notification(db, NotificationChannel.SMS, trip.id, _make_payload(d1, item1))

        # Recovery SMS → REC_ prefix
        fake_plan = {
            "id": f"PLAN_{uuid.uuid4().hex[:8]}",
            "changes": [{"action": "REPLACE", "new_title": "IndiGo SIM-6E-504", "estimated_cost": 4600}],
            "estimated_additional_cost": 4600,
        }
        r_result = svc.send_recovery_notification(
            db, NotificationChannel.SMS, trip.id, fake_plan
        )

        jobs = _sms_jobs_for_trip(db, trip.id)
        disr_jobs = [j for j in jobs if j.idempotency_key and j.idempotency_key.startswith("DISR_")]
        rec_jobs = [j for j in jobs if j.idempotency_key and j.idempotency_key.startswith("REC_")]

        assert len(disr_jobs) >= 1, "Disruption job must exist with DISR_ prefix"
        assert len(rec_jobs) >= 1, f"Recovery job must exist with REC_ prefix, got: {r_result.status}"
        # No collision between namespaces
        disr_keys = {j.idempotency_key for j in disr_jobs}
        rec_keys = {j.idempotency_key for j in rec_jobs}
        assert disr_keys.isdisjoint(rec_keys), "DISR_ and REC_ namespaces must not overlap"


class TestIdempotencyKeyIsDisruptionNotTrip:
    def test_idempotency_key_is_per_disruption_not_per_trip(self, db, trip_with_items):
        """The idempotency key must be DISR_{disruption_id}, NOT DISR_{trip_id}.
        If it were trip-based, the second disruption on the same trip would be blocked.
        """
        trip = trip_with_items["trip"]
        item1 = trip_with_items["item1"]
        item2 = trip_with_items["item2"]
        svc = NotificationService()

        d1 = _make_disruption(db, trip.id, "FLIGHT_CANCELLED", item1.id)
        d2 = _make_disruption(db, trip.id, "HOTEL_CANCELLED", item2.id)

        svc.send_disruption_notification(db, NotificationChannel.SMS, trip.id, _make_payload(d1, item1))
        svc.send_disruption_notification(db, NotificationChannel.SMS, trip.id, _make_payload(d2, item2))

        jobs = _sms_jobs_for_trip(db, trip.id)
        keys = {j.idempotency_key for j in jobs}

        # Keys must NOT be DISR_{trip_id} (which would collide for second disruption)
        trip_based_key = f"DISR_{trip.id}"
        if trip.id != d1.id and trip.id != d2.id:
            assert trip_based_key not in keys, (
                f"Idempotency key must not be based on trip_id alone! "
                f"Found trip-based key '{trip_based_key}' which would block second disruption."
            )

        # Keys must be per disruption
        assert f"DISR_{d1.id}" in keys
        assert f"DISR_{d2.id}" in keys
        assert d1.id != d2.id  # Different disruptions → different IDs
