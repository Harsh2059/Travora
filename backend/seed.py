from sqlalchemy.orm import Session
import models, schemas, crud


def seed_demo_data(db: Session):
    """
    Ensure the demo user exists. Does NOT overwrite user journeys.

    - If the user has no trips yet, create one optional SAMPLE trip
      (via DemoResetService) so first-time setup isn't empty.
    - If the user already has trips, leave them alone — they choose
      which journey to work on in the UI.
    """
    from services.demo.reset_service import DemoResetService

    user = DemoResetService.ensure_demo_user(db, user_email="demo@travel.com")

    trip_count = db.query(models.Trip).filter(models.Trip.user_id == user.id).count()
    if trip_count == 0:
        DemoResetService.reset_demo_trip(db, user_email="demo@travel.com")

    return user


if __name__ == "__main__":
    from database import SessionLocal, engine
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = seed_demo_data(db)
        print(f"Demo user id={user.id} email={user.email}")
        trips = db.query(models.Trip).filter(models.Trip.user_id == user.id).all()
        print(f"{len(trips)} trip(s) available — pick any in Admin / Home:")
        for t in trips:
            n = db.query(models.ItineraryItem).filter(
                models.ItineraryItem.trip_id == t.id
            ).count()
            print(f"  #{t.id} {t.title!r} ({n} items)")
    finally:
        db.close()
