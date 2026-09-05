from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import models, schemas, crud

def seed_demo_data(db: Session):
    # Check if user already exists
    user = db.query(models.User).filter(models.User.email == "demo@travel.com").first()
    if user:
        return user # Already seeded
        
    # 1. Create Demo Traveler
    user_in = schemas.UserCreate(name="Demo Traveler", email="demo@travel.com")
    user = crud.create_user(db, user_in)
    
    # 2. Create Trip
    trip_in = schemas.TripCreate(title="Mumbai to London Business Trip")
    trip = crud.create_user_trip(db, trip_in, user.id)
    
    # Define times
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

    # 3. Create Itinerary Items
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

    
    for item in items:
        crud.create_trip_item(db, item, trip.id)
        
    return user
