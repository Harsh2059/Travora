import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

import models

logger = logging.getLogger("travel_recovery.whatsapp")


def clean_phone_number(phone: Optional[str]) -> str:
    """Normalize phone number by stripping leading '+' and non-digits."""
    if not phone:
        return ""
    digits = "".join(ch for ch in str(phone) if ch.isdigit())
    return digits


class RecoveryContextAdapter:
    """Unified wrapper around a database or in-memory recovery context."""

    def __init__(
        self,
        sender: str,
        trip_id: int,
        disruption_id: Optional[int],
        disruption_fingerprint: Optional[str],
        options: Dict[str, str],
        plans_data: Dict[str, Dict[str, Any]],
        status: str = "ACTIVE",
        selected_option: Optional[str] = None,
        selected_plan_id: Optional[str] = None,
        execution_id: Optional[str] = None,
        db_model: Optional[models.WhatsAppRecoveryContext] = None,
    ):
        self.sender = sender
        self.trip_id = trip_id
        self.disruption_id = disruption_id
        self.disruption_fingerprint = disruption_fingerprint
        self.options = options
        self.plans_data = plans_data
        self.status = status
        self.selected_option = selected_option
        self.selected_plan_id = selected_plan_id
        self.execution_id = execution_id
        self._db_model = db_model

    @property
    def id(self) -> Optional[int]:
        return getattr(self._db_model, "id", None)

    @property
    def created_at(self) -> Optional[datetime]:
        return getattr(self._db_model, "created_at", None)

    def get_plan(self, plan_id: str) -> Optional[Dict[str, Any]]:
        return self.plans_data.get(str(plan_id))

    def mark_selected(self, db: Optional[Session], option_num: str, plan_id: str, execution_id: str):
        self.status = "SELECTED"
        self.selected_option = str(option_num)
        self.selected_plan_id = str(plan_id)
        self.execution_id = execution_id
        if self._db_model and db:
            self._db_model.status = "SELECTED"
            self._db_model.selected_option = str(option_num)
            self._db_model.selected_plan_id = str(plan_id)
            self._db_model.execution_id = execution_id
            db.commit()

    def mark_cancelled(self, db: Optional[Session]):
        self.status = "CANCELLED"
        if self._db_model and db:
            self._db_model.status = "CANCELLED"
            db.commit()


# Thread-safe in-memory cache for ultra-fast lookup and environments without migrations
_IN_MEMORY_CONTEXTS: Dict[str, RecoveryContextAdapter] = {}


def _context_key(sender: str, trip_id: int, disruption_id: Optional[int] = None) -> str:
    clean = clean_phone_number(sender)
    d_part = str(disruption_id) if disruption_id is not None else "any"
    return f"{clean}:{trip_id}:{d_part}"


def store_recovery_context(
    db: Optional[Session],
    sender: str,
    trip_id: int,
    disruption_id: Optional[int],
    disruption_fingerprint: Optional[str],
    plans: List[Dict[str, Any]],
) -> RecoveryContextAdapter:
    """Store server-side mapping of temporary option numbers (1, 2, 3...) to actual plans."""
    options: Dict[str, str] = {}
    plans_data: Dict[str, Dict[str, Any]] = {}

    for idx, plan in enumerate(plans, start=1):
        opt_key = str(idx)
        plan_id = str(plan.get("id") or plan.get("plan_id") or f"plan_{trip_id}_{idx}")
        options[opt_key] = plan_id
        plans_data[plan_id] = plan

    clean_sender = clean_phone_number(sender)
    adapter = RecoveryContextAdapter(
        sender=clean_sender,
        trip_id=trip_id,
        disruption_id=disruption_id,
        disruption_fingerprint=disruption_fingerprint or "",
        options=options,
        plans_data=plans_data,
        status="ACTIVE",
    )

    # Persist in-memory
    mem_key = _context_key(sender, trip_id, disruption_id)
    _IN_MEMORY_CONTEXTS[mem_key] = adapter
    _IN_MEMORY_CONTEXTS[f"{clean_sender}:{trip_id}:latest"] = adapter

    # Persist in DB if session is available
    if db is not None:
        try:
            # Check for existing context for this exact sender, trip, disruption
            existing = db.query(models.WhatsAppRecoveryContext).filter(
                models.WhatsAppRecoveryContext.trip_id == trip_id,
                models.WhatsAppRecoveryContext.disruption_id == disruption_id,
            ).first()

            if existing:
                existing.sender = clean_sender
                existing.disruption_fingerprint = disruption_fingerprint or ""
                existing.options = options
                existing.plans_data = plans_data
                existing.status = "ACTIVE"
                existing.selected_option = None
                existing.selected_plan_id = None
                existing.execution_id = None
                db.commit()
                adapter._db_model = existing
            else:
                db_record = models.WhatsAppRecoveryContext(
                    sender=clean_sender,
                    trip_id=trip_id,
                    disruption_id=disruption_id,
                    disruption_fingerprint=disruption_fingerprint or "",
                    options=options,
                    plans_data=plans_data,
                    status="ACTIVE",
                )
                db.add(db_record)
                db.commit()
                adapter._db_model = db_record
        except Exception as exc:
            logger.warning("Could not persist WhatsApp recovery context to DB: %s", exc)
            try:
                db.rollback()
            except Exception:
                pass

    return adapter


def get_active_recovery_context(
    db: Optional[Session],
    sender: str,
    trip_id: int,
    disruption_id: Optional[int] = None,
    disruption_fingerprint: Optional[str] = None,
) -> Optional[RecoveryContextAdapter]:
    """Retrieve the current active recovery option context for a sender + trip + disruption."""
    clean_sender = clean_phone_number(sender)

    # First check database if available
    if db is not None:
        try:
            query = db.query(models.WhatsAppRecoveryContext).filter(
                models.WhatsAppRecoveryContext.trip_id == trip_id,
                models.WhatsAppRecoveryContext.status == "ACTIVE",
            )
            if disruption_id is not None:
                query = query.filter(models.WhatsAppRecoveryContext.disruption_id == disruption_id)
            elif disruption_fingerprint:
                query = query.filter(models.WhatsAppRecoveryContext.disruption_fingerprint == disruption_fingerprint)

            # Match sender with/without leading plus
            db_contexts = query.order_by(models.WhatsAppRecoveryContext.id.desc()).all()
            for ctx in db_contexts:
                if clean_phone_number(ctx.sender) == clean_sender or not clean_sender:
                    return RecoveryContextAdapter(
                        sender=ctx.sender,
                        trip_id=ctx.trip_id,
                        disruption_id=ctx.disruption_id,
                        disruption_fingerprint=ctx.disruption_fingerprint,
                        options=ctx.options or {},
                        plans_data=ctx.plans_data or {},
                        status=ctx.status,
                        selected_option=ctx.selected_option,
                        selected_plan_id=ctx.selected_plan_id,
                        execution_id=ctx.execution_id,
                        db_model=ctx,
                    )
            return None
        except Exception as exc:
            logger.warning("DB query for WhatsApp recovery context failed: %s", exc)

    # Check in-memory store (only when db is None or DB query failed)
    if disruption_id is not None:
        key = _context_key(sender, trip_id, disruption_id)
        ctx = _IN_MEMORY_CONTEXTS.get(key)
        if ctx and ctx.status == "ACTIVE":
            return ctx

    # Check latest in-memory
    latest_key = f"{clean_sender}:{trip_id}:latest"
    ctx = _IN_MEMORY_CONTEXTS.get(latest_key)
    if ctx and ctx.status == "ACTIVE":
        if disruption_id is None or ctx.disruption_id == disruption_id:
            return ctx

    # Search all in-memory for clean_sender and trip_id
    for key, c in _IN_MEMORY_CONTEXTS.items():
        if key.startswith(f"{clean_sender}:{trip_id}:") and c.status == "ACTIVE":
            if disruption_id is None or c.disruption_id == disruption_id:
                return c

    return None


def get_latest_recovery_context(
    db: Optional[Session],
    sender: str,
    trip_id: int,
) -> Optional[RecoveryContextAdapter]:
    """Retrieve the most recent recovery context regardless of status (e.g. for idempotency check)."""
    clean_sender = clean_phone_number(sender)

    if db is not None:
        try:
            ctx = (
                db.query(models.WhatsAppRecoveryContext)
                .filter(models.WhatsAppRecoveryContext.trip_id == trip_id)
                .order_by(models.WhatsAppRecoveryContext.id.desc())
                .first()
            )
            if ctx and (clean_phone_number(ctx.sender) == clean_sender or not clean_sender):
                return RecoveryContextAdapter(
                    sender=ctx.sender,
                    trip_id=ctx.trip_id,
                    disruption_id=ctx.disruption_id,
                    disruption_fingerprint=ctx.disruption_fingerprint,
                    options=ctx.options or {},
                    plans_data=ctx.plans_data or {},
                    status=ctx.status,
                    selected_option=ctx.selected_option,
                    selected_plan_id=ctx.selected_plan_id,
                    execution_id=ctx.execution_id,
                    db_model=ctx,
                )
            return None
        except Exception as exc:
            logger.warning("DB query for latest WhatsApp recovery context failed: %s", exc)

    latest_key = f"{clean_sender}:{trip_id}:latest"
    return _IN_MEMORY_CONTEXTS.get(latest_key)


def clear_in_memory_contexts():
    _IN_MEMORY_CONTEXTS.clear()
