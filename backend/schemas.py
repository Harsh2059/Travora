from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class ItineraryItemBase(BaseModel):
    type: str
    provider: str
    origin: Optional[str] = None
    destination: Optional[str] = None
    location: Optional[str] = None
    start_time: datetime
    end_time: datetime
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
    user_id: int
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

class UserCreate(UserBase):
    pass

class User(UserBase):
    id: int
    trips: List[Trip] = []
    
    model_config = ConfigDict(from_attributes=True)
