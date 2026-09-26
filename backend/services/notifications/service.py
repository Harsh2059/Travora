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
            if trip and trip.user and trip.user.whatsapp_enabled is False:
                return NotificationResult(success=False, channel=channel, recipient="", status="SKIPPED", error="WhatsApp notifications disabled")
            try:
                print("[NOTIFICATION] about to call WhatsApp service", flush=True)
                res = self.whatsapp_service.send_recovery_notification(
                    db=db,
                    trip_id=trip_id,
                    plan=plan,
                    disruption_id=disruption_id,
                    plans=plans,
                )
                print("[NOTIFICATION] WhatsApp service returned", flush=True)
                return res
            except Exception as e:
                print(f"[NOTIFICATION] WhatsApp service exception: {e}", flush=True)
                raise
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
            if trip and trip.user and trip.user.whatsapp_enabled is False:
                return NotificationResult(success=False, channel=channel, recipient="", status="SKIPPED", error="WhatsApp notifications disabled")
            try:
                print("[NOTIFICATION] about to call WhatsApp service", flush=True)
                res = self.whatsapp_service.send_disruption_notification(
                    db=db,
                    trip_id=trip_id,
                    disruption=disruption,
                    plans=plans,
                )
                print("[NOTIFICATION] WhatsApp service returned", flush=True)
                return res
            except Exception as e:
                print(f"[NOTIFICATION] WhatsApp service exception: {e}", flush=True)
                raise
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

    # ──────────────────────────────────────────────────────────────────────────
    # NEW: Welcome notification  (signup event)
    # ──────────────────────────────────────────────────────────────────────────
    def send_welcome_notification(
        self,
        db: Session,
        channel: NotificationChannel,
        user,
    ) -> NotificationResult:
        """Dispatch welcome notification on the given channel.

        Idempotent per user_id × channel.
        Must NOT block or raise \u2014 call inside a try/except in the route handler.
        """
        if channel == NotificationChannel.WHATSAPP:
            if not user.whatsapp_enabled:
                print(f"[NOTIFICATION] welcome WhatsApp SKIPPED \u2014 user {user.id} has whatsapp_enabled=False", flush=True)
                return NotificationResult(
                    success=False, channel=channel, recipient="", status="SKIPPED",
                    error="WhatsApp notifications disabled for this user"
                )
            print(f"[NOTIFICATION] sending welcome WhatsApp for user {user.id}", flush=True)
            return self.whatsapp_service.send_welcome_notification(db=db, user=user)

        elif channel == NotificationChannel.SMS:
            try:
                if not user.sms_enabled:
                    print(f"[NOTIFICATION] welcome SMS SKIPPED \u2014 user {user.id} has sms_enabled=False", flush=True)
                    return NotificationResult(
                        success=False, channel=channel, recipient="", status="SKIPPED",
                        error="SMS notifications disabled for this user"
                    )

                user_phone = user.whatsapp_phone or user.phone_number
                recipient = DynamicSmsGenerator.get_recipient_phone(user_phone)
                if not recipient:
                    return NotificationResult(
                        success=False, channel=channel, recipient="", status="FAILED",
                        error="No recipient phone number available."
                    )

                idemp_key = f"WELCOME_{user.id}"
                existing_job = db.query(SmsJob).filter(SmsJob.idempotency_key == idemp_key).first()
                if existing_job:
                    print(f"[SMS] welcome already queued for user {user.id} \u2014 skipping", flush=True)
                    return NotificationResult(
                        success=True, channel=channel, recipient=existing_job.recipient,
                        status="ALREADY_QUEUED"
                    )

                message = DynamicSmsGenerator.generate_welcome_sms(user.name)
                masked = (recipient[:3] + "..." + recipient[-4:]) if len(recipient) >= 7 else "<masked>"
                print(f"[SMS] queueing welcome for user {user.id} to {masked}", flush=True)
                job = SmsJob(
                    id=str(uuid.uuid4()),
                    recipient=recipient,
                    message=message,
                    status="PENDING",
                    notification_type="WELCOME",
                    idempotency_key=idemp_key,
                )
                db.add(job)
                db.commit()
                return NotificationResult(
                    success=True, channel=channel, recipient=recipient, status="QUEUED"
                )
            except Exception as e:
                db.rollback()
                return NotificationResult(
                    success=False, channel=channel, recipient="", status="FAILED", error=str(e)
                )

        return NotificationResult(
            success=False, channel=channel, recipient="", status="FAILED",
            error=f"Notification channel {channel.value} is not configured."
        )

    # ──────────────────────────────────────────────────────────────────────────
    # NEW: Journey-created notification  (trip creation event)
    # ──────────────────────────────────────────────────────────────────────────
    def send_journey_created_notification(
        self,
        db: Session,
        channel: NotificationChannel,
        trip,
    ) -> NotificationResult:
        """Dispatch journey-confirmed notification on the given channel.

        Idempotent per trip_id \u00d7 channel.
        Must NOT block or raise \u2014 call inside a try/except in the route handler.
        """
        if channel == NotificationChannel.WHATSAPP:
            if not trip.user or not trip.user.whatsapp_enabled:
                print(f"[NOTIFICATION] journey WhatsApp SKIPPED \u2014 trip {trip.id} owner disabled", flush=True)
                return NotificationResult(
                    success=False, channel=channel, recipient="", status="SKIPPED",
                    error="WhatsApp notifications disabled"
                )
            print(f"[NOTIFICATION] sending journey_created WhatsApp for trip {trip.id}", flush=True)
            return self.whatsapp_service.send_journey_created_notification(db=db, trip=trip)

        elif channel == NotificationChannel.SMS:
            try:
                if not trip.user or not trip.user.sms_enabled:
                    print(f"[NOTIFICATION] journey SMS SKIPPED \u2014 trip {trip.id} owner disabled", flush=True)
                    return NotificationResult(
                        success=False, channel=channel, recipient="", status="SKIPPED",
                        error="SMS notifications disabled"
                    )

                user_phone = trip.user.whatsapp_phone or trip.user.phone_number
                recipient = DynamicSmsGenerator.get_recipient_phone(user_phone)
                if not recipient:
                    return NotificationResult(
                        success=False, channel=channel, recipient="", status="FAILED",
                        error="No recipient phone number available."
                    )

                idemp_key = f"JOURNEY_{trip.id}"
                existing_job = db.query(SmsJob).filter(SmsJob.idempotency_key == idemp_key).first()
                if existing_job:
                    print(f"[SMS] journey_created already queued for trip {trip.id} \u2014 skipping", flush=True)
                    return NotificationResult(
                        success=True, channel=channel, recipient=existing_job.recipient,
                        status="ALREADY_QUEUED"
                    )

                # Extract trip details for SMS (actual data, no hardcoding)
                items = sorted(
                    [i for i in (trip.items or []) if i.start_time is not None],
                    key=lambda x: x.start_time,
                )
                origin = items[0].origin if items and items[0].origin else None
                destination = items[-1].destination if items and items[-1].destination else None
                travel_date = items[0].start_time.strftime("%d %b %Y") if items else None
                booking_ref = f"TRV{str(trip.id).zfill(6)}"

                message = DynamicSmsGenerator.generate_journey_created_sms(
                    trip_name=trip.title,
                    origin=origin,
                    destination=destination,
                    travel_date=travel_date,
                    booking_ref=booking_ref,
                )
                masked = (recipient[:3] + "..." + recipient[-4:]) if len(recipient) >= 7 else "<masked>"
                print(f"[SMS] queueing journey_created for trip {trip.id} to {masked}", flush=True)
                job = SmsJob(
                    id=str(uuid.uuid4()),
                    recipient=recipient,
                    message=message,
                    status="PENDING",
                    trip_id=trip.id,
                    notification_type="JOURNEY_CREATED",
                    idempotency_key=idemp_key,
                )
                db.add(job)
                db.commit()
                return NotificationResult(
                    success=True, channel=channel, recipient=recipient, status="QUEUED"
                )
            except Exception as e:
                db.rollback()
                return NotificationResult(
                    success=False, channel=channel, recipient="", status="FAILED", error=str(e)
                )

        return NotificationResult(
            success=False, channel=channel, recipient="", status="FAILED",
            error=f"Notification channel {channel.value} is not configured."
        )
