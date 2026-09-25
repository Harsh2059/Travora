from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime, JSON
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    whatsapp_phone = Column(String, unique=True, nullable=True, index=True)
    trips = relationship("Trip", back_populates="user")


class NotificationRecord(Base):
    __tablename__ = "notification_records"
    id = Column(Integer, primary_key=True, index=True)
    channel = Column(String, index=True)
    recipient = Column(String)
    message_type = Column(String)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=True)
    disruption_id = Column(Integer, ForeignKey("disruption_events.id"), nullable=True)
    recovery_plan_id = Column(String, nullable=True)
    status = Column(String, index=True)
    provider_message_id = Column(String, nullable=True)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Trip(Base):
    __tablename__ = "trips"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    version = Column(Integer, default=1)
    view_mode = Column(String, default="ORIGINAL")  # ORIGINAL | RECOVERED
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
    status = Column(String, default="ACTIVE", index=True) # ACTIVE | RESOLVED
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
    plan_details = Column(JSON, default=dict)
    status = Column(String, default="COMPLETED")
    timestamp = Column(DateTime, default=datetime.utcnow)

    trip = relationship("Trip")


class RecoveryExecution(Base):
    __tablename__ = "recovery_executions"
    id = Column(Integer, primary_key=True, index=True)
    execution_id = Column(String, unique=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"))
    recovery_plan_id = Column(String, index=True)
    disruption_fingerprint = Column(String)
    status = Column(String, default="PENDING_REVALIDATION")
    total_price = Column(Float, default=0.0)
    currency = Column(String, default="INR")
    execution_metadata = Column(JSON, default=dict)
    demo_restored = Column(Boolean, default=False)
    restored_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    trip = relationship("Trip")
    items = relationship("RecoveryExecutionItem", back_populates="execution", cascade="all, delete-orphan")


class RecoveryExecutionItem(Base):
    __tablename__ = "recovery_execution_items"
    id = Column(Integer, primary_key=True, index=True)
    execution_id = Column(String, ForeignKey("recovery_executions.execution_id"))
    journey_item_id = Column(Integer, nullable=True)
    replacement_node_id = Column(String, nullable=True)
    replacement_type = Column(String)
    provider = Column(String)
    status = Column(String, default="PENDING")
    booking_reference = Column(String, nullable=True)
    ticket_number = Column(String, nullable=True)
    final_price = Column(Float, nullable=True)
    currency = Column(String, default="INR")
    booking_metadata = Column(JSON, default=dict)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    execution = relationship("RecoveryExecution", back_populates="items")


class SmsJob(Base):
    __tablename__ = "sms_jobs"
    id = Column(String, primary_key=True, index=True)
    recipient = Column(String, index=True)
    message = Column(String)
    status = Column(String, default="PENDING", index=True)
    trip_id = Column(Integer, nullable=True)
    notification_type = Column(String, nullable=True)
    idempotency_key = Column(String, unique=True, index=True, nullable=True)
    error_message = Column(String, nullable=True)
    gateway_device_id = Column(String, nullable=True)
    claimed_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(String, unique=True, index=True) # TRV-TKT-...
    trip_id = Column(Integer, ForeignKey("trips.id"))
    recovery_plan_id = Column(String, index=True)
    execution_id = Column(String, ForeignKey("recovery_executions.execution_id"))
    
    # Passenger info
    passenger_name = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # Transport info
    transport_mode = Column(String) # FLIGHT, TRAIN, CAB, BUS, HOTEL
    provider = Column(String)
    transport_identifier = Column(String, nullable=True) # flight num, train num
    origin = Column(String, nullable=True)
    destination = Column(String, nullable=True)
    terminal = Column(String, nullable=True)
    platform = Column(String, nullable=True)
    
    # Timing
    departure_time = Column(DateTime, nullable=True)
    arrival_time = Column(DateTime, nullable=True)
    
    # Booking specifics
    pnr = Column(String, nullable=True)
    booking_reference = Column(String, nullable=True)
    seat = Column(String, nullable=True)
    coach = Column(String, nullable=True)
    berth = Column(String, nullable=True)
    
    # Add-ons
    baggage_info = Column(String, nullable=True)
    meal_info = Column(String, nullable=True)
    
    # Pricing
    fare = Column(Float, nullable=True)
    currency = Column(String, default="INR")
    
    # State
    booking_status = Column(String, default="CONFIRMED")
    ticket_metadata = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    trip = relationship("Trip")
    user = relationship("User")
    execution = relationship("RecoveryExecution")
