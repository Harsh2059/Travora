from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
import models, schemas, crud
from services.graph.builder import build_dependency_graph
from services.graph.queries import GraphQueries

class DemoResetService:
    """
    Safely and reproducibly resets the demo environment to Trip v1 state:
    - Cleans up all disruption events
    - Cleans up all recovery history logs
    - Purges dynamically booked items
    - Restores the original 6 itinerary items with clean schedules and CONFIRMED states
    - Resets Trip version to 1
    """

    @classmethod
    def reset_demo_trip(cls, db: Session, user_email: str = "demo@travel.com") -> models.Trip:
        user = db.query(models.User).filter(models.User.email == user_email).first()
        if not user:
            # Seed fresh
            import seed
            user = seed.seed_demo_data(db)

        trip = db.query(models.Trip).filter(models.Trip.user_id == user.id).first()
        if not trip:
            trip = models.Trip(title="Mumbai to London Business Trip", version=1, user_id=user.id)
            db.add(trip)
            db.commit()
            db.refresh(trip)

        # 1. Delete all recovery histories for this trip
        db.query(models.RecoveryHistory).filter(models.RecoveryHistory.trip_id == trip.id).delete()

        # 2. Delete all disruption events for this trip
        db.query(models.DisruptionEvent).filter(models.DisruptionEvent.trip_id == trip.id).delete()

        # 3. Delete dependencies for this trip
        db.query(models.ItineraryDependency).filter(models.ItineraryDependency.trip_id == trip.id).delete()

        # 4. Delete all existing itinerary items for this trip
        db.query(models.ItineraryItem).filter(models.ItineraryItem.trip_id == trip.id).delete()

        # 5. Reset Trip version to 1
        trip.version = 1
        db.commit()

        # 6. Re-insert pristine initial 6 items
        now = datetime.now()
        flight_a_start = now + timedelta(days=1, hours=10) # 10:00 AM tomorrow
        flight_a_end = flight_a_start + timedelta(hours=2) # 12:00 PM
        
        flight_b_start = flight_a_end + timedelta(hours=2) # 2:00 PM
        flight_b_end = flight_b_start + timedelta(hours=9) # 11:00 PM
        
        hotel_start = flight_b_end + timedelta(hours=2) # 1:00 AM next day
        hotel_end = hotel_start + timedelta(days=3)
        
        conf_start = hotel_start + timedelta(hours=8) # 9:00 AM next day
        conf_end = conf_start + timedelta(hours=8) # 5:00 PM
        
        return_flight_start = hotel_end + timedelta(hours=4)
        return_flight_end = return_flight_start + timedelta(hours=10)

        items = [
            schemas.ItineraryItemCreate(
                type="FLIGHT", provider="Air India", origin="Mumbai (BOM)", destination="Delhi (DEL)",
                start_time=flight_a_start, end_time=flight_a_end, cost=5000, priority="HIGH", flexibility="FLEXIBLE", booking_id="AI101",
                refundable=False, changeable=True, change_fee=1500, cancellation_fee=5000, non_refundable_amount=5000
            ),
            schemas.ItineraryItemCreate(
                type="FLIGHT", provider="British Airways", origin="Delhi (DEL)", destination="London (LHR)",
                start_time=flight_b_start, end_time=flight_b_end, cost=45000, priority="HIGH", flexibility="FLEXIBLE", booking_id="BA202",
                refundable=True, refund_percentage=75, changeable=True, change_fee=3500, cancellation_fee=5000
            ),
            schemas.ItineraryItemCreate(
                type="TRANSFER", provider="Heathrow Express", origin="London (LHR)", destination="London City",
                start_time=flight_b_end + timedelta(minutes=45), end_time=flight_b_end + timedelta(minutes=90), cost=2500, priority="MEDIUM", flexibility="VERY_FLEXIBLE",
                refundable=True, refund_percentage=100, changeable=True, change_fee=0
            ),
            schemas.ItineraryItemCreate(
                type="HOTEL", provider="Marriott London", location="London",
                start_time=hotel_start, end_time=hotel_end, cost=30000, priority="MEDIUM", flexibility="FLEXIBLE", booking_id="HTL55",
                refundable=True, refund_percentage=80, changeable=True, change_fee=500, cancellation_fee=2000
            ),
            schemas.ItineraryItemCreate(
                type="EVENT", provider="Tech Conference 2026", location="ExCeL London",
                start_time=conf_start, end_time=conf_end, cost=0, priority="CRITICAL", flexibility="FIXED", booking_id="TICKET1",
                refundable=False, changeable=False
            ),
            schemas.ItineraryItemCreate(
                type="FLIGHT", provider="Virgin Atlantic", origin="London (LHR)", destination="Mumbai (BOM)",
                start_time=return_flight_start, end_time=return_flight_end, cost=40000, priority="HIGH", flexibility="FLEXIBLE", booking_id="VA303",
                refundable=True, refund_percentage=80, changeable=True, change_fee=3000
            )
        ]

        for it in items:
            crud.create_trip_item(db, it, trip.id)

        db.commit()
        db.refresh(trip)
        return trip
