import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

import models
from services.notifications.contracts import NotificationChannel, NotificationRequest, NotificationResult
from .client import MetaWhatsAppClient
from .formatter import format_recovery_notification

logger = logging.getLogger("travel_recovery.whatsapp")


class WhatsAppService:
    def __init__(self, client: Optional[MetaWhatsAppClient] = None):
        self.client = client or MetaWhatsAppClient()

    def send(self, request: NotificationRequest) -> NotificationResult:
        try:
            response = self.client.send_text(request.recipient, request.text)
            messages = response.get("messages") or []
            provider_id = messages[0].get("id") if messages else None
            return NotificationResult(
                success=True,
                channel=NotificationChannel.WHATSAPP,
                recipient=request.recipient,
                status="SENT",
                provider_message_id=provider_id,
            )
        except Exception as exc:
            logger.warning("WhatsApp notification failed: %s", type(exc).__name__)
            return NotificationResult(
                success=False,
                channel=NotificationChannel.WHATSAPP,
                recipient=request.recipient,
                status="FAILED",
                error=str(exc),
            )

    def send_recovery_notification(
        self,
        db: Session,
        trip_id: int,
        plan: Dict[str, Any],
        disruption_id: Optional[int] = None,
    ) -> NotificationResult:
        trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
        if not trip or not trip.user or not trip.user.whatsapp_phone:
            recipient = trip.user.whatsapp_phone if trip and trip.user else ""
            result = NotificationResult(
                success=False,
                channel=NotificationChannel.WHATSAPP,
                recipient=recipient,
                status="FAILED",
                error="Traveler has no WhatsApp phone number configured.",
            )
        else:
            request = NotificationRequest(
                recipient=trip.user.whatsapp_phone,
                message_type="RECOVERY_PLAN",
                text=format_recovery_notification(trip_id, plan),
                trip_id=trip_id,
                disruption_id=disruption_id,
                recovery_plan_id=str(plan.get("id") or plan.get("plan_id") or ""),
                timestamp=datetime.now(timezone.utc),
            )
            result = self.send(request)
        db.add(models.NotificationRecord(
            channel=result.channel.value,
            recipient=result.recipient,
            message_type="RECOVERY_PLAN",
            trip_id=trip_id,
            disruption_id=disruption_id,
            recovery_plan_id=str(plan.get("id") or plan.get("plan_id") or ""),
            status=result.status,
            provider_message_id=result.provider_message_id,
            error_message=result.error,
        ))
        db.commit()
        return result
