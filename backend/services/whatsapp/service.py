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
from services.recovery.execution_engine import get_active_disruption_fingerprint

logger = logging.getLogger("travel_recovery.whatsapp")


class WhatsAppService:
    def __init__(self, client: Optional[MetaWhatsAppClient] = None):
        self.client = client or MetaWhatsAppClient()

    def send(self, request: NotificationRequest) -> NotificationResult:
        try:
            print("[WHATSAPP] calling Meta client", flush=True)
            logger.info("[WHATSAPP] calling Meta client")
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
            recipient = trip.user.whatsapp_phone or trip.user.phone_number
            if not recipient:
                return NotificationResult(
                    success=False,
                    channel=NotificationChannel.WHATSAPP,
                    recipient="",
                    status="FAILED",
                    error="Traveler has no WhatsApp phone number configured.",
                )

            all_plans = plans or [plan]
            if len(all_plans) > 1:
                text = format_whatsapp_recovery_options(trip_id, None, all_plans)
            else:
                text = format_recovery_notification(trip_id, plan)

            fingerprint = (
                plan.get("disruption_fingerprint")
                or (all_plans[0].get("disruption_fingerprint") if all_plans else None)
                or (get_active_disruption_fingerprint(db, trip_id) if db is not None else None)
                or str(disruption_id or "")
            )
            for p in all_plans:
                if "disruption_fingerprint" not in p and fingerprint:
                    p["disruption_fingerprint"] = fingerprint
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

    def send_welcome_notification(
        self,
        db: Session,
        user,
    ) -> NotificationResult:
        """Send a welcome WhatsApp message to a newly registered user.

        Idempotent: skips if a SENT record already exists for this recipient + WELCOME.
        """
        recipient = user.whatsapp_phone or user.phone_number
        if not recipient:
            return NotificationResult(
                success=False,
                channel=NotificationChannel.WHATSAPP,
                recipient="",
                status="FAILED",
                error="User has no WhatsApp / phone number configured.",
            )

        # Idempotency: skip if already SENT to this number
        existing = db.query(models.NotificationRecord).filter(
            models.NotificationRecord.message_type == "WELCOME",
            models.NotificationRecord.recipient == recipient,
            models.NotificationRecord.status == "SENT",
        ).first()
        if existing:
            masked = (recipient[:3] + "..." + recipient[-4:]) if len(recipient) >= 7 else "<masked>"
            print(f"[WHATSAPP] welcome already sent to {masked} — skipping", flush=True)
            return NotificationResult(
                success=True,
                channel=NotificationChannel.WHATSAPP,
                recipient=recipient,
                status="ALREADY_SENT",
                provider_message_id=existing.provider_message_id,
            )

        name = (user.name or "Traveler").strip()
        text = (
            "\u2708\ufe0f Welcome to Travora, " + name + "!\n\n"
            "Your Travora account has been created successfully.\n\n"
            "You can now create trips, receive journey updates, and get real-time "
            "disruption recovery options.\n\n"
            "Travora\n"
            "Travel smarter. Recover faster."
        )

        masked_recipient = (recipient[:3] + "..." + recipient[-4:]) if len(recipient) >= 7 else "<masked>"
        print(f"[WHATSAPP] sending welcome to {masked_recipient}", flush=True)
        logger.info("[WHATSAPP] sending welcome to %s", masked_recipient)

        request = NotificationRequest(
            recipient=recipient,
            message_type="WELCOME",
            text=text,
            timestamp=datetime.now(timezone.utc),
        )
        result = self.send(request)
        db.add(models.NotificationRecord(
            channel=result.channel.value,
            recipient=result.recipient,
            message_type="WELCOME",
            status=result.status,
            provider_message_id=result.provider_message_id,
            error_message=result.error,
        ))
        db.commit()
        return result

    def send_journey_created_notification(
        self,
        db: Session,
        trip,
    ) -> NotificationResult:
        """Send a journey-confirmed WhatsApp message after all items are added.

        Idempotent: skips if a SENT record already exists for trip_id + JOURNEY_CREATED.
        """
        user = trip.user
        recipient = (user.whatsapp_phone or user.phone_number) if user else None
        if not recipient:
            return NotificationResult(
                success=False,
                channel=NotificationChannel.WHATSAPP,
                recipient="",
                status="FAILED",
                error="Traveler has no WhatsApp phone number configured.",
            )

        # Idempotency check
        existing = db.query(models.NotificationRecord).filter(
            models.NotificationRecord.message_type == "JOURNEY_CREATED",
            models.NotificationRecord.trip_id == trip.id,
            models.NotificationRecord.channel == "WHATSAPP",
            models.NotificationRecord.status == "SENT",
        ).first()
        if existing:
            print(f"[WHATSAPP] journey_created already sent for trip {trip.id} — skipping", flush=True)
            return NotificationResult(
                success=True,
                channel=NotificationChannel.WHATSAPP,
                recipient=recipient,
                status="ALREADY_SENT",
                provider_message_id=existing.provider_message_id,
            )

        name = (user.name or "Traveler").strip() if user else "Traveler"

        # Build journey summary from actual trip items (no hardcoding)
        items = sorted(
            [i for i in (trip.items or []) if i.start_time is not None],
            key=lambda x: x.start_time,
        )
        origin = items[0].origin if items and items[0].origin else None
        destination = items[-1].destination if items and items[-1].destination else None
        travel_date = items[0].start_time.strftime("%d %b %Y") if items else None
        booking_ref = f"TRV{str(trip.id).zfill(6)}"

        route = (f"{origin} \u2192 {destination}") if origin and destination else trip.title

        text_parts = [
            "\u2708\ufe0f Travora Journey Confirmed\n",
            f"Hi {name},\n",
            "Your journey has been added successfully.\n",
            route + "\n",
        ]
        if travel_date:
            text_parts.append(f"Travel date:\n{travel_date}\n")
        text_parts.append(f"Booking:\n{booking_ref}\n")
        text_parts.append(
            "You can open Travora to view your complete itinerary.\n"
            "We\u2019ll notify you if anything changes."
        )
        text = "\n".join(text_parts)

        masked_recipient = (recipient[:3] + "..." + recipient[-4:]) if len(recipient) >= 7 else "<masked>"
        print(f"[WHATSAPP] sending journey_created for trip {trip.id} to {masked_recipient}", flush=True)
        logger.info("[WHATSAPP] sending journey_created for trip %d to %s", trip.id, masked_recipient)

        request = NotificationRequest(
            recipient=recipient,
            message_type="JOURNEY_CREATED",
            text=text,
            trip_id=trip.id,
            timestamp=datetime.now(timezone.utc),
        )
        result = self.send(request)
        db.add(models.NotificationRecord(
            channel=result.channel.value,
            recipient=result.recipient,
            message_type="JOURNEY_CREATED",
            trip_id=trip.id,
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
        print("[WHATSAPP] dispatch entered", flush=True)
        logger.info("[WHATSAPP] dispatch entered")
        plans_cnt = len(plans) if plans else 0
        print(f"[WHATSAPP] plans count={plans_cnt}", flush=True)
        logger.info("[WHATSAPP] plans count=%d", plans_cnt)

        disruption_id = disruption.get("id") or disruption.get("event_id")
        existing = db.query(models.NotificationRecord).filter(
            models.NotificationRecord.trip_id == trip_id,
            models.NotificationRecord.disruption_id == disruption_id,
            models.NotificationRecord.message_type == "DISRUPTION_ALERT",
        ).first()
        if existing:
            print(f"[WHATSAPP] skipped duplicate for disruption {disruption_id}", flush=True)
            return NotificationResult(
                success=True,
                channel=NotificationChannel.WHATSAPP,
                recipient=existing.recipient,
                status="SKIPPED_DUPLICATE",
                provider_message_id=existing.provider_message_id,
            )

        trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
        user_phone = (trip.user.whatsapp_phone or trip.user.phone_number) if (trip and trip.user) else None
        
        if not user_phone:
            return NotificationResult(
                success=False,
                channel=NotificationChannel.WHATSAPP,
                recipient="",
                status="FAILED",
                error="Traveler has no WhatsApp phone number configured.",
            )
        recipient = user_phone

        masked_recipient = (recipient[:3] + "..." + recipient[-4:]) if (recipient and len(recipient) >= 7) else "<masked>"
        print(f"[WHATSAPP] recipient={masked_recipient}", flush=True)
        logger.info("[WHATSAPP] recipient=%s", masked_recipient)

        # If plans are available, format recovery options dynamically and register context
        if plans and len(plans) > 0:
            text = format_whatsapp_recovery_options(
                trip_id=trip_id,
                disruption=disruption,
                plans=plans,
            )
            fingerprint = (
                (plans[0].get("disruption_fingerprint") if plans else None)
                or (get_active_disruption_fingerprint(db, trip_id) if db is not None else None)
                or str(disruption_id or "")
            )
            for p in plans:
                if "disruption_fingerprint" not in p and fingerprint:
                    p["disruption_fingerprint"] = fingerprint
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
