from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from .contracts import NotificationChannel, NotificationResult
from services.whatsapp.service import WhatsAppService


class NotificationService:
    """Shared channel dispatcher; SMS can register beside WhatsApp later."""

    def __init__(self, whatsapp_service: Optional[WhatsAppService] = None):
        self.whatsapp_service = whatsapp_service or WhatsAppService()

    def send_recovery_notification(
        self,
        db: Session,
        channel: NotificationChannel,
        trip_id: int,
        plan: Dict[str, Any],
        disruption_id: Optional[int] = None,
    ) -> NotificationResult:
        if channel == NotificationChannel.WHATSAPP:
            return self.whatsapp_service.send_recovery_notification(
                db=db,
                trip_id=trip_id,
                plan=plan,
                disruption_id=disruption_id,
            )
        return NotificationResult(
            success=False,
            channel=channel,
            recipient="",
            status="FAILED",
            error=f"Notification channel {channel.value} is not configured.",
        )
