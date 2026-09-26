from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
import uuid
from datetime import datetime

from .contracts import NotificationChannel, NotificationResult
from .sms_generator import DynamicSmsGenerator
from services.whatsapp.service import WhatsAppService
import models
from models import SmsJob


class NotificationService:
    """Shared channel dispatcher for WhatsApp and SMS notifications."""

    def __init__(self, whatsapp_service: Optional[WhatsAppService] = None):
        self.whatsapp_service = whatsapp_service or WhatsAppService()

    def send_recovery_notification(
        self,
        db: Session,
        channel: NotificationChannel,
        trip_id: int,
        plan: Dict[str, Any],
        disruption_id: Optional[int] = None,
        plans: Optional[List[Dict[str, Any]]] = None,
        is_proposal: bool = True,
    ) -> NotificationResult:
        if channel == NotificationChannel.WHATSAPP:
            trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
            if not trip or not trip.user or not trip.user.whatsapp_enabled:
                return NotificationResult(success=False, channel=channel, recipient="", status="SKIPPED", error="WhatsApp notifications disabled")
            return self.whatsapp_service.send_recovery_notification(
                db=db,
                trip_id=trip_id,
                plan=plan,
                disruption_id=disruption_id,
                plans=plans,
            )
        elif channel == NotificationChannel.SMS:
            try:
                trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
                if not trip or not trip.user or not trip.user.sms_enabled:
                    return NotificationResult(success=False, channel=channel, recipient="", status="SKIPPED", error="SMS notifications disabled")
                
                user_phone = trip.user.whatsapp_phone or trip.user.phone_number
                recipient = DynamicSmsGenerator.get_recipient_phone(user_phone)

                if not recipient:
                    return NotificationResult(
                        success=False,
                        channel=channel,
                        recipient="",
                        status="FAILED",
                        error="No recipient phone number available."
                    )
                
                plan_id = plan.get("id") or plan.get("execution_id") or uuid.uuid4().hex
                idemp_key = f"REC_{plan_id}"
                existing_job = db.query(SmsJob).filter(SmsJob.idempotency_key == idemp_key).first()
                if existing_job:
                    return NotificationResult(
                        success=True,
                        channel=channel,
                        recipient=existing_job.recipient,
                        status="ALREADY_QUEUED"
                    )

                all_plans = plans or [plan]
                
                if is_proposal:
                    if len(all_plans) > 1:
                        from services.whatsapp.formatter import format_whatsapp_recovery_options
                        from services.whatsapp.context import store_recovery_context
                        message = format_whatsapp_recovery_options(trip_id, None, all_plans)
                    else:
                        from services.whatsapp.formatter import format_recovery_notification
                        from services.whatsapp.context import store_recovery_context
                        message = format_recovery_notification(trip_id, plan)
                    
                    disr_id = disruption_id or plan.get("disruption_id")
                    store_recovery_context(
                        db=db,
                        sender=recipient,
                        trip_id=trip_id,
                        disruption_id=disr_id,
                        disruption_fingerprint=str(disr_id or plan.get("disruption_fingerprint") or ""),
                        plans=all_plans,
                    )
                else:
                    message = DynamicSmsGenerator.generate_recovery_sms(plan)
                
                job = SmsJob(
                    id=str(uuid.uuid4()),
                    recipient=recipient,
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
        plans: Optional[List[Dict[str, Any]]] = None,
    ) -> NotificationResult:
        print(f"[NOTIFICATION] notification service entered channel={channel.value}", flush=True)
        if channel == NotificationChannel.WHATSAPP:
            trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
            if not trip or not trip.user or not trip.user.whatsapp_enabled:
                return NotificationResult(success=False, channel=channel, recipient="", status="SKIPPED", error="WhatsApp notifications disabled")
            return self.whatsapp_service.send_disruption_notification(
                db=db,
                trip_id=trip_id,
                disruption=disruption,
                plans=plans,
            )
        elif channel == NotificationChannel.SMS:
            print("[SMS] dispatch attempted", flush=True)
            try:
                trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
                if not trip or not trip.user or not trip.user.sms_enabled:
                    return NotificationResult(success=False, channel=channel, recipient="", status="SKIPPED", error="SMS notifications disabled")
                    
                user_phone = trip.user.whatsapp_phone or trip.user.phone_number
                recipient = DynamicSmsGenerator.get_recipient_phone(user_phone)

                if not recipient:
                    return NotificationResult(
                        success=False,
                        channel=channel,
                        recipient="",
                        status="FAILED",
                        error="No recipient phone number available."
                    )
                
                disr_id = disruption.get("id") or disruption.get("event_id")
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
                
                if plans and len(plans) > 0:
                    from services.whatsapp.formatter import format_whatsapp_recovery_options
                    from services.whatsapp.context import store_recovery_context
                    message = format_whatsapp_recovery_options(trip_id, disruption, plans)
                    store_recovery_context(
                        db=db,
                        sender=recipient,
                        trip_id=trip_id,
                        disruption_id=disr_id,
                        disruption_fingerprint=str(disr_id or ""),
                        plans=plans,
                    )
                else:
                    message = DynamicSmsGenerator.generate_disruption_sms(disruption)
                
                job = SmsJob(
                    id=str(uuid.uuid4()),
                    recipient=recipient,
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
