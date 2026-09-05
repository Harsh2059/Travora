from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime, JSON
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    trips = relationship("Trip", back_populates="user")

class Trip(Base):
    __tablename__ = "trips"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    version = Column(Integer, default=1)
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="trips")
    items = relationship("ItineraryItem", back_populates="trip")


class ItineraryItem(Base):
    __tablename__ = "itinerary_items"
    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"))
    type = Column(String) # FLIGHT, TRAIN, TRANSFER, HOTEL, ACTIVITY, EVENT
    provider = Column(String)
    origin = Column(String, nullable=True)
    destination = Column(String, nullable=True)
    location = Column(String, nullable=True)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    cost = Column(Float)
    currency = Column(String, default="INR")
    priority = Column(String, default="MEDIUM") # CRITICAL, HIGH, MEDIUM, LOW
    flexibility = Column(String, default="FLEXIBLE") # FIXED, FLEXIBLE, VERY_FLEXIBLE
    status = Column(String, default="CONFIRMED")
    booking_id = Column(String, nullable=True)
    
    # Policy Fields
    refundable = Column(Boolean, default=False)
    refund_percentage = Column(Float, default=0.0)
    cancellation_fee = Column(Float, default=0.0)
    changeable = Column(Boolean, default=False)
    change_fee = Column(Float, default=0.0)
    cancellation_deadline = Column(DateTime, nullable=True)
    change_deadline = Column(DateTime, nullable=True)
    non_refundable_amount = Column(Float, default=0.0)
    
    item_metadata = Column(JSON, default=dict)

    trip = relationship("Trip", back_populates="items")


class ItineraryDependency(Base):
    __tablename__ = "itinerary_dependencies"
    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"))
    source_id = Column(Integer, ForeignKey("itinerary_items.id"))
    target_id = Column(Integer, ForeignKey("itinerary_items.id"))
    dependency_type = Column(String) # TEMPORAL, CONNECTION, LOCATION, TRANSFER, ACCOMMODATION, ACTIVITY, EVENT, CUSTOM
    item_metadata = Column(JSON, default=dict)

    trip = relationship("Trip")
    source = relationship("ItineraryItem", foreign_keys=[source_id], backref="downstream_dependencies")
    target = relationship("ItineraryItem", foreign_keys=[target_id], backref="upstream_dependencies")


class DisruptionEvent(Base):
    __tablename__ = "disruption_events"
    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"))
    event_type = Column(String, index=True) # DELAY, CANCELLATION, AIRPORT_CLOSURE, USER_REQUESTED_CHANGE, etc.
    entity_id = Column(Integer, nullable=True) # affected itinerary item id
    timestamp = Column(DateTime, default=datetime.utcnow)
    severity = Column(String, default="HIGH") # LOW, MEDIUM, HIGH, CRITICAL
    old_state = Column(JSON, default=dict)
    new_state = Column(JSON, default=dict)
    event_metadata = Column(JSON, default=dict)

    trip = relationship("Trip")


class RecoveryHistory(Base):
    __tablename__ = "recovery_histories"
    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"))
    recovery_id = Column(String, index=True)
    previous_version = Column(Integer)
    new_version = Column(Integer)
    event_type = Column(String)
    selected_plan_id = Column(String)
    plan_title = Column(String)
    net_cost = Column(Float, default=0.0)
    additional_delay_minutes = Column(Integer, default=0)
    changes = Column(JSON, default=dict)
    timestamp = Column(DateTime, default=datetime.utcnow)

    trip = relationship("Trip")


