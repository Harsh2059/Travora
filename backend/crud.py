from sqlalchemy.orm import Session
import models, schemas

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserCreate):
    db_user = models.User(email=user.email, name=user.name)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_trips(db: Session, user_id: int):
    return db.query(models.Trip).filter(models.Trip.user_id == user_id).all()

def create_user_trip(db: Session, trip: schemas.TripCreate, user_id: int):
    db_trip = models.Trip(**trip.model_dump(), user_id=user_id)
    db.add(db_trip)
    db.commit()
    db.refresh(db_trip)
    return db_trip

def create_trip_item(db: Session, item: schemas.ItineraryItemCreate, trip_id: int):
    db_item = models.ItineraryItem(**item.model_dump(), trip_id=trip_id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item
