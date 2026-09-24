from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional


class NotificationChannel(str, Enum):
    WHATSAPP = "WHATSAPP"
    SMS = "SMS"


@dataclass(frozen=True)
class NotificationRequest:
    recipient: str
    message_type: str
    text: str
    trip_id: Optional[int] = None
    disruption_id: Optional[int] = None
    recovery_plan_id: Optional[str] = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class NotificationResult:
    success: bool
    channel: NotificationChannel
    recipient: str
    status: str
    provider_message_id: Optional[str] = None
    error: Optional[str] = None
