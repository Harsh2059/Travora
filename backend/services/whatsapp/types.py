from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class WhatsAppMessage(BaseModel):
    recipient: str
    message_type: str = "text"
    text: str
    trip_id: Optional[int] = None
    disruption_id: Optional[int] = None
    recovery_plan_id: Optional[str] = None
    timestamp: datetime
    delivery_status: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class WhatsAppIncomingMessage(BaseModel):
    message_id: Optional[str] = None
    sender: str
    text: str
    timestamp: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
