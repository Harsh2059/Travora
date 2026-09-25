import logging
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from sqlalchemy.orm import Session

import models
from services.recovery.execution_engine import execute_plan, get_active_disruption_fingerprint
from .client import MetaWhatsAppClient, WhatsAppClientError
from .config import DEMO_WHATSAPP_NUMBER
from .context import (
    clean_phone_number,
    get_active_recovery_context,
    get_latest_recovery_context,
)
from .formatter import (
    format_help,
    format_recovery_confirmation,
    format_recovery_notification,
    format_whatsapp_recovery_options,
)
from .parser import WhatsAppAction, parse_message_with_option

logger = logging.getLogger("travel_recovery.whatsapp")


class WhatsAppWebhookHandler:
    def __init__(
        self,
        client: MetaWhatsAppClient,
        plan_resolver: Optional[Callable[[int], Optional[Dict[str, Any]]]] = None,
        plans_resolver: Optional[Callable[[int], List[Dict[str, Any]]]] = None,
    ):
        self.client = client
        self.plan_resolver = plan_resolver or (lambda tid: None)
        self.plans_resolver = plans_resolver

    def handle(self, db: Session, sender: str, text: str, message_id: Optional[str] = None) -> Dict[str, Any]:
        clean_sender = clean_phone_number(sender)
        user = db.query(models.User).filter(
            (models.User.whatsapp_phone == sender) |
            (models.User.whatsapp_phone == clean_sender) |
            (models.User.whatsapp_phone == f"+{clean_sender}")
        ).first()

        if not user:
            demo_clean = clean_phone_number(DEMO_WHATSAPP_NUMBER)
            if clean_sender == demo_clean:
                user = db.query(models.User).order_by(models.User.id.desc()).first()
            if not user:
                return self._reply(sender, "We could not find a traveler linked to this WhatsApp number.", "MISSING_TRAVELER")

        trip = db.query(models.Trip).filter(models.Trip.user_id == user.id).order_by(models.Trip.id.desc()).first()
        if not trip:
            return self._reply(sender, "We could not find an active trip for your account.", "MISSING_TRIP")

        action, option_str = parse_message_with_option(text)

        if action == WhatsAppAction.HELP:
            return self._reply(sender, format_help(), action.value)

        if action == WhatsAppAction.CANCEL_RECOVERY:
            context = get_active_recovery_context(db, sender=clean_sender, trip_id=trip.id)
            if context:
                context.mark_cancelled(db)
            return self._reply(
                sender,
                "❌ Recovery selection cancelled.\n\nYour journey has not been changed.",
                action.value,
            )

        if action == WhatsAppAction.SELECT_OPTION:
            option_num = option_str or "1"
            context = get_active_recovery_context(db, sender=clean_sender, trip_id=trip.id)

            if not context:
                latest_ctx = get_latest_recovery_context(db, sender=clean_sender, trip_id=trip.id)
                if latest_ctx and latest_ctx.status == "SELECTED" and str(latest_ctx.selected_option) == option_num:
                    return self._reply(
                        sender,
                        "ℹ️ This recovery option has already been selected.",
                        "ALREADY_SELECTED",
                    )
                return self._reply(
                    sender,
                    "ℹ️ There is no active recovery selection for your journey.",
                    "NO_ACTIVE_RECOVERY",
                )

            if context.status == "SELECTED" and str(context.selected_option) == option_num:
                return self._reply(
                    sender,
                    "ℹ️ This recovery option has already been selected.",
                    "ALREADY_SELECTED",
                )

            if option_num not in context.options:
                return self._reply(
                    sender,
                    "⚠️ Invalid option.\n\nPlease reply with one of the available recovery option numbers.",
                    "INVALID_OPTION",
                )

            plan_id = context.options[option_num]
            plan = context.get_plan(plan_id)
            if not plan:
                plan = self.plan_resolver(trip.id)
            if not plan:
                return self._reply(
                    sender,
                    "There is no current recovery plan for your trip.",
                    "MISSING_RECOVERY_PLAN",
                )

            context_fingerprint = context.disruption_fingerprint or plan.get("disruption_fingerprint") or get_active_disruption_fingerprint(db, trip.id)
            current_fingerprint = get_active_disruption_fingerprint(db, trip.id)
            if context_fingerprint and current_fingerprint and current_fingerprint != context_fingerprint:
                return self._reply(
                    sender,
                    "This recovery plan has expired because your journey changed. Please request new details.",
                    "EXPIRED_RECOVERY_PLAN",
                )

            exec_id = f"whatsapp_{trip.id}_{plan_id}_{context_fingerprint or '0'}"
            result = execute_plan(
                db=db,
                trip_id=trip.id,
                plan=plan,
                disruption_fingerprint=context_fingerprint or current_fingerprint,
                execution_id=exec_id,
            )

            if result.get("message") == "Recovery execution completed (idempotent result).":
                return self._reply(
                    sender,
                    "ℹ️ This recovery option has already been selected.",
                    "ALREADY_SELECTED",
                    result=result,
                )

            if result.get("status") in ("COMPLETED", "PARTIALLY_COMPLETED"):
                context.mark_selected(db, option_num=option_num, plan_id=plan_id, execution_id=exec_id)
                if hasattr(trip, "view_mode"):
                    trip.view_mode = "RECOVERED"
                    db.commit()

                try:
                    from services.notifications.contracts import NotificationChannel
                    from services.notifications.service import NotificationService
                    NotificationService().send_recovery_notification(
                        db=db,
                        channel=NotificationChannel.SMS,
                        trip_id=trip.id,
                        plan=plan,
                        disruption_id=context.disruption_id,
                    )
                except Exception:
                    pass

                confirmation_msg = format_recovery_confirmation(plan, result)
                return self._reply(sender, confirmation_msg, action.value, result=result)
            elif result.get("status") == "STALE_PLAN":
                return self._reply(
                    sender,
                    result.get("message", "This recovery plan has expired."),
                    "STALE_PLAN",
                    result=result,
                )
            else:
                return self._reply(
                    sender,
                    result.get("message", "We could not apply that recovery plan."),
                    "EXECUTION_FAILED",
                    result=result,
                )

        if action == WhatsAppAction.ACCEPT_RECOVERY:
            # Check if active context exists, select option 1
            context = get_active_recovery_context(db, sender=clean_sender, trip_id=trip.id)
            if context and "1" in context.options:
                return self.handle(db=db, sender=sender, text="1", message_id=message_id)

            plan = self.plan_resolver(trip.id)
            if not plan:
                return self._reply(sender, "There is no current recovery plan for your trip.", "MISSING_RECOVERY_PLAN")

            fingerprint = plan.get("disruption_fingerprint") or get_active_disruption_fingerprint(db, trip.id)
            current_fingerprint = get_active_disruption_fingerprint(db, trip.id)
            if fingerprint and current_fingerprint != fingerprint:
                return self._reply(
                    sender,
                    "This recovery plan has expired because your journey changed. Please request new details.",
                    "EXPIRED_RECOVERY_PLAN",
                )

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

        if action == WhatsAppAction.VIEW_RECOVERY:
            context = get_active_recovery_context(db, sender=clean_sender, trip_id=trip.id)
            if context and context.options:
                plans = [context.get_plan(pid) for pid in context.options.values() if context.get_plan(pid)]
                if plans:
                    return self._reply(
                        sender,
                        format_whatsapp_recovery_options(trip.id, None, plans),
                        action.value,
                    )

            plan = self.plan_resolver(trip.id)
            if not plan:
                return self._reply(sender, "There is no current recovery plan for your trip.", "MISSING_RECOVERY_PLAN")
            return self._reply(sender, format_recovery_notification(trip.id, plan), action.value)

        if action == WhatsAppAction.REJECT_RECOVERY:
            context = get_active_recovery_context(db, sender=clean_sender, trip_id=trip.id)
            if context:
                context.mark_cancelled(db)
            return self._reply(sender, "Your recovery plan was declined. No trip changes were made.", action.value)

        return self._reply(sender, "I did not understand that. Reply HELP for available recovery actions.", WhatsAppAction.UNKNOWN.value)

    def _reply(self, recipient: str, text: str, action: str, result: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        try:
            provider_result = self.client.send_text(recipient, text)
            return {"action": action, "status": "SENT", "provider": provider_result, "result": result}
        except Exception as exc:
            logger.warning("WhatsApp reply failed: %s", type(exc).__name__)
            return {"action": action, "status": "NOT_SENT", "error": str(exc), "result": result}
