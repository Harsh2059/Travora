from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import models, schemas, crud


class DemoResetService:
    """
    Optional sample-trip helper — does NOT force a single journey on the user.

    - Ensures the demo user exists
    - Resets (or creates) one optional SAMPLE trip to a known baseline
    - Never deletes the user's other trips — they choose which journey to use
      in Trip Builder / Admin Console / Home
    """

    SAMPLE_TRIP_TITLE = "Sample: Mumbai to London"

    @classmethod
    def ensure_demo_user(cls, db: Session, user_email: str = "demo@travel.com") -> models.User:
        user = db.query(models.User).filter(models.User.email == user_email).first()
        if user:
            return user
        user_in = schemas.UserCreate(name="Demo Traveler", email=user_email)
        return crud.create_user(db, user_in)

    @classmethod
    def clear_trip_simulations(cls, db: Session, trip_id: int) -> models.Trip:
        """
        Clear disruptions / recovery executions for a trip without replacing
        the user's itinerary. Prefer this when working on an existing journey.
        """
        trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
        if not trip:
            raise ValueError(f"Trip {trip_id} not found")

        exec_ids = [
            e.execution_id
            for e in db.query(models.RecoveryExecution)
            .filter(models.RecoveryExecution.trip_id == trip_id)
            .all()
        ]
        if exec_ids:
            db.query(models.RecoveryExecutionItem).filter(
                models.RecoveryExecutionItem.execution_id.in_(exec_ids)
            ).delete(synchronize_session=False)

        db.query(models.RecoveryExecution).filter(
            models.RecoveryExecution.trip_id == trip_id
        ).delete()
        db.query(models.RecoveryHistory).filter(
            models.RecoveryHistory.trip_id == trip_id
        ).delete()
        db.query(models.DisruptionEvent).filter(
            models.DisruptionEvent.trip_id == trip_id
        ).delete()

        # Drop recovery replacement rows; reactivate any REPLACED originals
        items = db.query(models.ItineraryItem).filter(
            models.ItineraryItem.trip_id == trip_id
        ).all()
        for item in items:
            meta = dict(item.item_metadata or {})
            if meta.get("recovery_execution_id") or meta.get("is_replacement"):
                db.delete(item)
            elif item.status in ("REPLACED", "RESTORED_DEMO"):
                item.status = "CONFIRMED"
                meta.pop("replaced_by_pnr", None)
                meta.pop("replaced_at", None)
                item.item_metadata = meta

        db.commit()
        db.refresh(trip)
        return trip

    @classmethod
    def reset_demo_trip(cls, db: Session, user_email: str = "demo@travel.com") -> models.Trip:
        """
        Recreate the optional SAMPLE trip only (London business itinerary).
        Other user trips are left untouched so the traveler can keep choosing
        whichever journey they want.
        """
        user = cls.ensure_demo_user(db, user_email=user_email)

        trip = (
            db.query(models.Trip)
            .filter(
                models.Trip.user_id == user.id,
                models.Trip.title == cls.SAMPLE_TRIP_TITLE,
            )
            .first()
        )
        if not trip:
            trip = models.Trip(title=cls.SAMPLE_TRIP_TITLE, version=1, user_id=user.id)
            db.add(trip)
            db.commit()
            db.refresh(trip)

        trip.title = cls.SAMPLE_TRIP_TITLE
        trip.version = 1

        # Clear sample-trip simulation + items only (do not touch other trips)
        exec_ids = [
            e.execution_id
            for e in db.query(models.RecoveryExecution)
            .filter(models.RecoveryExecution.trip_id == trip.id)
            .all()
        ]
        if exec_ids:
            db.query(models.RecoveryExecutionItem).filter(
                models.RecoveryExecutionItem.execution_id.in_(exec_ids)
            ).delete(synchronize_session=False)
        db.query(models.RecoveryExecution).filter(
            models.RecoveryExecution.trip_id == trip.id
        ).delete()
        db.query(models.RecoveryHistory).filter(
            models.RecoveryHistory.trip_id == trip.id
        ).delete()
        db.query(models.DisruptionEvent).filter(
            models.DisruptionEvent.trip_id == trip.id
        ).delete()
        db.query(models.ItineraryDependency).filter(
            models.ItineraryDependency.trip_id == trip.id
        ).delete()
        db.query(models.ItineraryItem).filter(
            models.ItineraryItem.trip_id == trip.id
        ).delete()
        db.commit()

        now = datetime.now()
        flight_a_start = now + timedelta(days=1, hours=10)
        flight_a_end = flight_a_start + timedelta(hours=2)
        flight_b_start = flight_a_end + timedelta(hours=2)
        flight_b_end = flight_b_start + timedelta(hours=9)
        hotel_start = flight_b_end + timedelta(hours=2)
        hotel_end = hotel_start + timedelta(days=3)
        conf_start = hotel_start + timedelta(hours=8)
        conf_end = conf_start + timedelta(hours=8)
        return_flight_start = hotel_end + timedelta(hours=4)
        return_flight_end = return_flight_start + timedelta(hours=10)

        items = [
            schemas.ItineraryItemCreate(
                type="FLIGHT", provider="Air India", origin="Mumbai (BOM)", destination="Delhi (DEL)",
                start_time=flight_a_start, end_time=flight_a_end, cost=5000, priority="HIGH",
                flexibility="FLEXIBLE", booking_id="AI101",
                refundable=False, changeable=True, change_fee=1500, cancellation_fee=5000,
                non_refundable_amount=5000,
            ),
            schemas.ItineraryItemCreate(
                type="FLIGHT", provider="British Airways", origin="Delhi (DEL)", destination="London (LHR)",
                start_time=flight_b_start, end_time=flight_b_end, cost=45000, priority="HIGH",
                flexibility="FLEXIBLE", booking_id="BA202",
                refundable=True, refund_percentage=75, changeable=True, change_fee=3500,
                cancellation_fee=5000,
            ),
            schemas.ItineraryItemCreate(
                type="TRANSFER", provider="Heathrow Express", origin="London (LHR)",
                destination="London City",
                start_time=flight_b_end + timedelta(minutes=45),
                end_time=flight_b_end + timedelta(minutes=90),
                cost=2500, priority="MEDIUM", flexibility="VERY_FLEXIBLE",
                refundable=True, refund_percentage=100, changeable=True, change_fee=0,
            ),
            schemas.ItineraryItemCreate(
                type="HOTEL", provider="Marriott London", location="London",
                start_time=hotel_start, end_time=hotel_end, cost=30000, priority="MEDIUM",
                flexibility="FLEXIBLE", booking_id="HTL55",
                refundable=True, refund_percentage=80, changeable=True, change_fee=500,
                cancellation_fee=2000,
            ),
            schemas.ItineraryItemCreate(
                type="EVENT", provider="Tech Conference 2026", location="ExCeL London",
                start_time=conf_start, end_time=conf_end, cost=0, priority="CRITICAL",
                flexibility="FIXED", booking_id="TICKET1",
                refundable=False, changeable=False,
            ),
            schemas.ItineraryItemCreate(
                type="FLIGHT", provider="Virgin Atlantic", origin="London (LHR)",
                destination="Mumbai (BOM)",
                start_time=return_flight_start, end_time=return_flight_end, cost=40000,
                priority="HIGH", flexibility="FLEXIBLE", booking_id="VA303",
                refundable=True, refund_percentage=80, changeable=True, change_fee=3000,
            ),
        ]

        for it in items:
            crud.create_trip_item(db, it, trip.id)

        db.commit()
        db.refresh(trip)
        return trip
