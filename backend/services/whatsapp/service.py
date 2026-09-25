import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

import models
from services.notifications.contracts import NotificationChannel, NotificationRequest, NotificationResult
from .client import MetaWhatsAppClient
from .config import DEMO_WHATSAPP_NUMBER
from .context import store_recovery_context
from .formatter import (
    format_disruption_alert,
    format_recovery_notification,
    format_whatsapp_recovery_options,
)

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
        plans: Optional[List[Dict[str, Any]]] = None,
    ) -> NotificationResult:
        trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
        if not trip or not trip.user:
            result = NotificationResult(
                success=False,
                channel=NotificationChannel.WHATSAPP,
                recipient="",
                status="FAILED",
                error="Traveler has no WhatsApp phone number configured.",
            )
        else:
            recipient = trip.user.whatsapp_phone
            if not recipient:
                # Hackathon/demo-only fallback; replace with a configured traveler number later.
                recipient = DEMO_WHATSAPP_NUMBER
                logger.info(
                    "Using demo WhatsApp number because traveler has no WhatsApp number configured."
                )

            all_plans = plans or [plan]
            if len(all_plans) > 1:
                text = format_whatsapp_recovery_options(trip_id, None, all_plans)
            else:
                text = format_recovery_notification(trip_id, plan)

            fingerprint = str(disruption_id or plan.get("disruption_fingerprint") or "")
            store_recovery_context(
                db=db,
                sender=recipient,
                trip_id=trip_id,
                disruption_id=disruption_id,
                disruption_fingerprint=fingerprint,
                plans=all_plans,
            )

            request = NotificationRequest(
                recipient=recipient,
                message_type="RECOVERY_PLAN",
                text=text,
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

    def send_disruption_notification(
        self,
        db: Session,
        trip_id: int,
        disruption: Dict[str, Any],
        plans: Optional[List[Dict[str, Any]]] = None,
    ) -> NotificationResult:
        disruption_id = disruption.get("id") or disruption.get("event_id")
        existing = db.query(models.NotificationRecord).filter(
            models.NotificationRecord.trip_id == trip_id,
            models.NotificationRecord.disruption_id == disruption_id,
            models.NotificationRecord.message_type == "DISRUPTION_ALERT",
        ).first()
        if existing:
            return NotificationResult(
                success=True,
                channel=NotificationChannel.WHATSAPP,
                recipient=existing.recipient,
                status="SKIPPED_DUPLICATE",
                provider_message_id=existing.provider_message_id,
            )

        trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
        recipient = trip.user.whatsapp_phone if (trip and trip.user and trip.user.whatsapp_phone) else DEMO_WHATSAPP_NUMBER

        # If plans are available, format recovery options dynamically and register context
        if plans and len(plans) > 0:
            text = format_whatsapp_recovery_options(
                trip_id=trip_id,
                disruption=disruption,
                plans=plans,
            )
            fingerprint = str(disruption_id or "")
            store_recovery_context(
                db=db,
                sender=recipient,
                trip_id=trip_id,
                disruption_id=disruption_id,
                disruption_fingerprint=fingerprint,
                plans=plans,
            )
        else:
            text = format_disruption_alert(disruption)

        request = NotificationRequest(
            recipient=recipient,
            message_type="DISRUPTION_ALERT",
            text=text,
            trip_id=trip_id,
            disruption_id=disruption_id,
            timestamp=datetime.now(timezone.utc),
        )
        result = self.send(request)
        db.add(models.NotificationRecord(
            channel=result.channel.value,
            recipient=result.recipient,
            message_type="DISRUPTION_ALERT",
            trip_id=trip_id,
            disruption_id=disruption_id,
            status=result.status,
            provider_message_id=result.provider_message_id,
            error_message=result.error,
        ))
        db.commit()
        return result
