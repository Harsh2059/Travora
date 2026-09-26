from sqlalchemy.orm import Session
from typing import Any
import uuid
import models, schemas

def get_user(db: Session, user_id: Any):
    uid_str = str(user_id)
    return db.query(models.User).filter((models.User.id == uid_str) | (models.User.id == user_id)).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email.strip().lower()).first()

def create_user(db: Session, user: schemas.UserCreate):
    existing = get_user_by_email(db, user.email)
    if existing:
        return existing

    user_id = getattr(user, "id", None) or str(uuid.uuid4())
    db_user = models.User(
        id=user_id,
        email=user.email.strip().lower(),
        name=user.name.strip(),
        phone_number=getattr(user, "phone_number", None),
        whatsapp_phone=getattr(user, "whatsapp_phone", None),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_trips(db: Session, user_id: Any):
    uid_str = str(user_id)
    return db.query(models.Trip).filter((models.Trip.user_id == uid_str) | (models.Trip.user_id == user_id)).all()

def create_user_trip(db: Session, trip: schemas.TripCreate, user_id: Any):
    db_trip = models.Trip(**trip.model_dump(), user_id=str(user_id))
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
