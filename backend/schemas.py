from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime

class ItineraryItemBase(BaseModel):
    type: str
    provider: str
    origin: Optional[str] = None
    destination: Optional[str] = None
    location: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    cost: float
    currency: str = "INR"
    priority: str = "MEDIUM"
    flexibility: str = "FLEXIBLE"
    status: str = "CONFIRMED"
    booking_id: Optional[str] = None
    
    refundable: bool = False
    refund_percentage: float = 0.0
    cancellation_fee: float = 0.0
    changeable: bool = False
    change_fee: float = 0.0
    cancellation_deadline: Optional[datetime] = None
    change_deadline: Optional[datetime] = None
    non_refundable_amount: float = 0.0
    
    item_metadata: Dict[str, Any] = Field(default_factory=dict)

class ItineraryItemCreate(ItineraryItemBase):
    pass

class ItineraryItem(ItineraryItemBase):
    id: int
    trip_id: int
    
    model_config = ConfigDict(from_attributes=True)

class ItineraryDependencyBase(BaseModel):
    source_id: int
    target_id: int
    dependency_type: str
    item_metadata: Dict[str, Any] = Field(default_factory=dict)

class ItineraryDependencyCreate(ItineraryDependencyBase):
    pass

class ItineraryDependency(ItineraryDependencyBase):
    id: int
    trip_id: int
    
    model_config = ConfigDict(from_attributes=True)

class DisruptionEventBase(BaseModel):
    trip_id: int
    event_type: str
    entity_id: Optional[int] = None
    severity: str = "HIGH"
    status: str = "ACTIVE"
    old_state: Dict[str, Any] = Field(default_factory=dict)
    new_state: Dict[str, Any] = Field(default_factory=dict)
    event_metadata: Dict[str, Any] = Field(default_factory=dict)

class DisruptionEventCreate(DisruptionEventBase):
    pass

class DisruptionEvent(DisruptionEventBase):
    id: int
    timestamp: datetime
    
    model_config = ConfigDict(from_attributes=True)


class TripBase(BaseModel):
    title: str
    version: int = 1

class TripCreate(TripBase):
    pass



class Trip(TripBase):
    id: int
    user_id: str
    items: List[ItineraryItem] = []
    
    model_config = ConfigDict(from_attributes=True)

class RecoveryHistoryBase(BaseModel):
    trip_id: int
    recovery_id: str
    previous_version: int
    new_version: int
    event_type: str
    selected_plan_id: str
    plan_title: str
    net_cost: float = 0.0
    additional_delay_minutes: int = 0
    changes: Dict[str, Any] = Field(default_factory=dict)

class RecoveryHistoryCreate(RecoveryHistoryBase):
    pass

class RecoveryHistory(RecoveryHistoryBase):
    id: int
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)

class UserBase(BaseModel):
    name: str
    email: str
    phone_number: Optional[str] = None
    whatsapp_phone: Optional[str] = None
    sms_enabled: Optional[bool] = True
    whatsapp_enabled: Optional[bool] = True

    @field_validator('sms_enabled', 'whatsapp_enabled', mode='before')
    @classmethod
    def coerce_none_to_true(cls, v):
        """Legacy DB rows have NULL for these columns — treat as enabled (True)."""
        return True if v is None else v

class UserCreate(UserBase):
    pass

class UserRegister(BaseModel):
    name: str
    email: str
    password: str
    phone_number: Optional[str] = None
    whatsapp_phone: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    whatsapp_phone: Optional[str] = None
    sms_enabled: Optional[bool] = None
    whatsapp_enabled: Optional[bool] = None

class UserResponse(UserBase):
    id: str
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class User(UserBase):
    id: str
    trips: List[Trip] = []
    model_config = ConfigDict(from_attributes=True)


class SmsJobBase(BaseModel):
    recipient: str
    message: str
    status: str = "PENDING"
    trip_id: Optional[int] = None
    notification_type: Optional[str] = None
    idempotency_key: Optional[str] = None
    error_message: Optional[str] = None
    gateway_device_id: Optional[str] = None
    claimed_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None

class SmsJobResponse(SmsJobBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SmsStatusUpdate(BaseModel):
    status: str
    error_message: Optional[str] = None
    gateway_device_id: Optional[str] = None

class TicketBase(BaseModel):
    ticket_id: str
    trip_id: int
    recovery_plan_id: str
    execution_id: str
    passenger_name: str
    user_id: str
    transport_mode: str
    provider: str
    transport_identifier: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    terminal: Optional[str] = None
    platform: Optional[str] = None
    departure_time: Optional[datetime] = None
    arrival_time: Optional[datetime] = None
    pnr: Optional[str] = None
    booking_reference: Optional[str] = None
    seat: Optional[str] = None
    coach: Optional[str] = None
    berth: Optional[str] = None
    baggage_info: Optional[str] = None
    meal_info: Optional[str] = None
    fare: Optional[float] = None
    currency: str = "INR"
    booking_status: str = "CONFIRMED"
    ticket_metadata: Dict[str, Any] = Field(default_factory=dict)

class TicketResponse(TicketBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
