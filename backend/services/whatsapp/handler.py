import logging
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Optional

from sqlalchemy.orm import Session

import models
from services.recovery.execution_engine import execute_plan, get_active_disruption_fingerprint
from .client import MetaWhatsAppClient, WhatsAppClientError
from .formatter import format_help, format_recovery_notification
from .parser import WhatsAppAction, parse_message

logger = logging.getLogger("travel_recovery.whatsapp")


class WhatsAppWebhookHandler:
    def __init__(
        self,
        client: MetaWhatsAppClient,
        plan_resolver: Callable[[int], Optional[Dict[str, Any]]],
    ):
        self.client = client
        self.plan_resolver = plan_resolver

    def handle(self, db: Session, sender: str, text: str, message_id: Optional[str] = None) -> Dict[str, Any]:
        user = db.query(models.User).filter(models.User.whatsapp_phone == sender).first()
        if not user:
            return self._reply(sender, "We could not find a traveler linked to this WhatsApp number.", "MISSING_TRAVELER")
        trip = db.query(models.Trip).filter(models.Trip.user_id == user.id).order_by(models.Trip.id.desc()).first()
        if not trip:
            return self._reply(sender, "We could not find an active trip for your account.", "MISSING_TRIP")

        action = parse_message(text)
        plan = self.plan_resolver(trip.id)
        if action == WhatsAppAction.HELP:
            return self._reply(sender, format_help(), action.value)
        if action == WhatsAppAction.UNKNOWN:
            return self._reply(sender, "I did not understand that. Reply HELP for available recovery actions.", action.value)
        if not plan and action in (WhatsAppAction.VIEW_RECOVERY, WhatsAppAction.ACCEPT_RECOVERY, WhatsAppAction.REJECT_RECOVERY):
            return self._reply(sender, "There is no current recovery plan for your trip.", "MISSING_RECOVERY_PLAN")
        if action == WhatsAppAction.VIEW_RECOVERY:
            return self._reply(sender, format_recovery_notification(trip.id, plan), action.value)
        if action == WhatsAppAction.REJECT_RECOVERY:
            return self._reply(sender, "Your recovery plan was declined. No trip changes were made.", action.value)

        fingerprint = plan.get("disruption_fingerprint") or get_active_disruption_fingerprint(db, trip.id)
        current_fingerprint = get_active_disruption_fingerprint(db, trip.id)
        if fingerprint and current_fingerprint != fingerprint:
            return self._reply(sender, "This recovery plan has expired because your journey changed. Please request new details.", "EXPIRED_RECOVERY_PLAN")
        result = execute_plan(
            db=db,
            trip_id=trip.id,
            plan=plan,
            disruption_fingerprint=fingerprint,
            execution_id=f"whatsapp_{trip.id}_{plan.get('id') or plan.get('plan_id')}_{fingerprint or '0'}",
        )
        if result.get("status") in ("COMPLETED", "PARTIALLY_COMPLETED"):
            message = "Your recovery has been accepted and your trip was updated."
        elif result.get("status") == "STALE_PLAN":
            message = result.get("message", "This recovery plan has expired.")
        else:
            message = result.get("message", "We could not apply that recovery plan.")
        return self._reply(sender, message, action.value, result=result)

    def _reply(self, recipient: str, text: str, action: str, result: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        try:
            provider_result = self.client.send_text(recipient, text)
            return {"action": action, "status": "SENT", "provider": provider_result, "result": result}
        except Exception as exc:
            logger.warning("WhatsApp reply failed: %s", type(exc).__name__)
            return {"action": action, "status": "NOT_SENT", "error": str(exc), "result": result}
