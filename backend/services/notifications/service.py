from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from .contracts import NotificationChannel, NotificationResult
from services.whatsapp.service import WhatsAppService
import models
from models import SmsJob
import uuid
from datetime import datetime


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
        elif channel == NotificationChannel.SMS:
            try:
                trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
                if not trip or not trip.user or not trip.user.whatsapp_phone:
                    return NotificationResult(
                        success=False,
                        channel=channel,
                        recipient="",
                        status="FAILED",
                        error="No traveler phone number available."
                    )
                
                # Check for idempotency
                idemp_key = f"REC_{plan.get('id')}"
                existing_job = db.query(SmsJob).filter(SmsJob.idempotency_key == idemp_key).first()
                if existing_job:
                    return NotificationResult(
                        success=True,
                        channel=channel,
                        recipient=existing_job.recipient,
                        status="ALREADY_QUEUED"
                    )

                items = plan.get("changes", [])
                new_items = [it for it in items if it.get("action") in ["REPLACE", "MODIFY"]]
                flight_info = ""
                if new_items:
                    ni = new_items[0].get("item", {})
                    provider = ni.get("provider", "Unknown")
                    start = ni.get("start_time", "Unknown")
                    flight_info = f" New flight: {provider}. Departure: {start}."
                
                message = f"Recovery Confirmed.{flight_info} Open Travora for details."
                
                job = SmsJob(
                    id=str(uuid.uuid4()),
                    recipient=trip.user.whatsapp_phone,
                    message=message,
                    status="PENDING",
                    trip_id=trip_id,
                    notification_type="RECOVERY_ALERT",
                    idempotency_key=idemp_key
                )
                db.add(job)
                db.commit()
                
                return NotificationResult(
                    success=True,
                    channel=channel,
                    recipient=job.recipient,
                    status="QUEUED"
                )
            except Exception as e:
                db.rollback()
                return NotificationResult(
                    success=False,
                    channel=channel,
                    recipient="",
                    status="FAILED",
                    error=str(e)
                )

        return NotificationResult(
            success=False,
            channel=channel,
            recipient="",
            status="FAILED",
            error=f"Notification channel {channel.value} is not configured.",
        )

    def send_disruption_notification(
        self,
        db: Session,
        channel: NotificationChannel,
        trip_id: int,
        disruption: Dict[str, Any],
    ) -> NotificationResult:
        if channel == NotificationChannel.WHATSAPP:
            return self.whatsapp_service.send_disruption_notification(
                db=db,
                trip_id=trip_id,
                disruption=disruption,
            )
        elif channel == NotificationChannel.SMS:
            try:
                trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
                if not trip or not trip.user or not trip.user.whatsapp_phone:
                    return NotificationResult(
                        success=False,
                        channel=channel,
                        recipient="",
                        status="FAILED",
                        error="No traveler phone number available."
                    )
                
                disr_id = disruption.get("id")
                idemp_key = f"DISR_{disr_id}" if disr_id else None
                if idemp_key:
                    existing_job = db.query(SmsJob).filter(SmsJob.idempotency_key == idemp_key).first()
                    if existing_job:
                        return NotificationResult(
                            success=True,
                            channel=channel,
                            recipient=existing_job.recipient,
                            status="ALREADY_QUEUED"
                        )
                
                item = disruption.get("item", {})
                provider = item.get("provider", "your travel service")
                message = f"Travel Alert: Your {provider} booking has been disrupted. Open Travora to view your recovery plan."
                
                job = SmsJob(
                    id=str(uuid.uuid4()),
                    recipient=trip.user.whatsapp_phone,
                    message=message,
                    status="PENDING",
                    trip_id=trip_id,
                    notification_type="DISRUPTION_ALERT",
                    idempotency_key=idemp_key
                )
                db.add(job)
                db.commit()
                
                return NotificationResult(
                    success=True,
                    channel=channel,
                    recipient=job.recipient,
                    status="QUEUED"
                )
            except Exception as e:
                db.rollback()
                return NotificationResult(
                    success=False,
                    channel=channel,
                    recipient="",
                    status="FAILED",
                    error=str(e)
                )

        return NotificationResult(
            success=False,
            channel=channel,
            recipient="",
            status="FAILED",
            error=f"Notification channel {channel.value} is not configured.",
        )
