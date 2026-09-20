"""
execution_engine.py

Part 5: Booking & Execution Engine
Handles revalidation, explicit user confirmation, provider booking execution,
and itinerary DB updates.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
import models
from .providers.mock_flight import MockFlightProvider
from .providers.mock_hotel import MockHotelProvider
from .providers.mock_train import MockTrainProvider
from .providers.mock_cab import MockCabProvider


def _get_provider_for_change(change: Dict[str, Any]):
    """Resolve provider instance based on item type or title."""
    item_type = str(change.get("type") or (change.get("new_details") or {}).get("type") or "").upper()
    title = str(change.get("new_title") or change.get("original_title") or change.get("title") or "").upper()
    provider_name = str(change.get("provider") or (change.get("new_details") or {}).get("provider") or "").upper()

    if "FLIGHT" in item_type or "FLIGHT" in title or "AIRLINE" in provider_name:
        return MockFlightProvider()
    if "AIR" in provider_name or "INDIGO" in provider_name or "VISTARA" in provider_name or "AKASA" in provider_name:
        return MockFlightProvider()
    if "HOTEL" in item_type or "STAY" in item_type or "RESORT" in title or "HOTEL" in title:
        return MockHotelProvider()
    if "TRAIN" in item_type or "METRO" in item_type or "RAIL" in title or "METRO" in title:
        return MockTrainProvider()
    if "CAB" in item_type or "TAXI" in item_type or "TRANSFER" in item_type or "UBER" in title or "CAB" in title:
        return MockCabProvider()

    # Default fallback to MockFlightProvider if unspecified
    return MockFlightProvider()


def _enrich_change_for_booking(change: Dict[str, Any]) -> Dict[str, Any]:
    """Merge candidate new_details fields onto the change dict for booking providers."""
    enriched = dict(change or {})
    details = enriched.get("new_details") or {}
    if isinstance(details, dict):
        if not enriched.get("provider"):
            enriched["provider"] = details.get("provider") or details.get("airline")
        if not enriched.get("type"):
            enriched["type"] = details.get("type")
        if not enriched.get("origin"):
            enriched["origin"] = details.get("origin")
        if not enriched.get("destination"):
            enriched["destination"] = details.get("destination")
        if not enriched.get("start_time"):
            enriched["start_time"] = details.get("start_time") or details.get("startTime")
        if not enriched.get("end_time"):
            enriched["end_time"] = details.get("end_time") or details.get("endTime")
        if enriched.get("estimated_cost") is None and details.get("cost") is not None:
            enriched["estimated_cost"] = details.get("cost")
    return enriched


def _item_is_replacement(item: models.ItineraryItem) -> bool:
    meta = item.item_metadata or {}
    return bool(meta.get("recovery_execution_id") or meta.get("is_replacement"))


def _find_canonical_recovery_execution(
    db: Session,
    trip_id: int,
    execution_id: Optional[str] = None
) -> Optional[models.RecoveryExecution]:
    """
    Prefer the earliest completed execution whose replaced items are true originals
    (not prior recovery replacements). Falls back to latest completed execution.
    """
    if execution_id:
        return db.query(models.RecoveryExecution).filter(
            models.RecoveryExecution.execution_id == execution_id,
            models.RecoveryExecution.trip_id == trip_id
        ).first()

    completed = (
        db.query(models.RecoveryExecution)
        .filter(
            models.RecoveryExecution.trip_id == trip_id,
            models.RecoveryExecution.status.in_(["COMPLETED", "PARTIALLY_COMPLETED"])
        )
        .order_by(models.RecoveryExecution.created_at.asc())
        .all()
    )
    if not completed:
        return None

    for exec_rec in completed:
        booked = [i for i in (exec_rec.items or []) if i.status == "BOOKED"]
        if not booked:
            continue
        points_to_replacement = False
        for bi in booked:
            if not bi.journey_item_id:
                continue
            it = db.query(models.ItineraryItem).filter(
                models.ItineraryItem.id == bi.journey_item_id
            ).first()
            if it and _item_is_replacement(it):
                points_to_replacement = True
                break
        if not points_to_replacement:
            return exec_rec

    return completed[-1]


def _safe_parse_datetime(dt_val: Any, fallback: Optional[datetime] = None) -> datetime:
    if isinstance(dt_val, datetime):
        return dt_val
    if isinstance(dt_val, str) and dt_val:
        try:
            return datetime.fromisoformat(dt_val.replace("Z", "+00:00"))
        except Exception:
            pass
    return fallback or datetime.utcnow()


def get_active_disruption_fingerprint(db: Session, trip_id: int) -> str:
    """Computes the authoritative sorted fingerprint of active disruptions for a trip."""
    disruptions = db.query(models.DisruptionEvent).filter(
        models.DisruptionEvent.trip_id == trip_id,
        models.DisruptionEvent.status == "ACTIVE"
    ).all()
    active_ids = sorted([d.id for d in disruptions])
    return "_".join(str(i) for i in active_ids)


def _upsert_recovery_execution(
    db: Session,
    exec_id: str,
    trip_id: int,
    plan_id: str,
    active_fp: str,
    status: str,
    total_price: float = 0.0,
    metadata: Optional[Dict[str, Any]] = None
) -> models.RecoveryExecution:
    """Safely upsert RecoveryExecution record, handling concurrent or duplicate key collisions."""
    existing_exec = db.query(models.RecoveryExecution).filter(
        models.RecoveryExecution.execution_id == exec_id
    ).first()

    if not existing_exec:
        try:
            existing_exec = models.RecoveryExecution(
                execution_id=exec_id,
                trip_id=trip_id,
                recovery_plan_id=str(plan_id),
                disruption_fingerprint=active_fp,
                status=status,
                total_price=total_price,
                currency="INR",
                execution_metadata=metadata or {}
            )
            db.add(existing_exec)
            db.commit()
            db.refresh(existing_exec)
            return existing_exec
        except Exception:
            db.rollback()
            existing_exec = db.query(models.RecoveryExecution).filter(
                models.RecoveryExecution.execution_id == exec_id
            ).first()

    if existing_exec:
        existing_exec.status = status
        existing_exec.total_price = total_price
        if metadata:
            exec_meta = dict(existing_exec.execution_metadata or {})
            exec_meta.update(metadata)
            existing_exec.execution_metadata = exec_meta
        existing_exec.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing_exec)
        return existing_exec

    existing_exec = models.RecoveryExecution(
        execution_id=exec_id,
        trip_id=trip_id,
        recovery_plan_id=str(plan_id),
        disruption_fingerprint=active_fp,
        status=status,
        total_price=total_price,
        currency="INR",
        execution_metadata=metadata or {}
    )
    return existing_exec


def revalidate_plan(
    db: Session,
    trip_id: int,
    plan: Dict[str, Any],
    disruption_fingerprint: str
) -> Dict[str, Any]:
    """
    Revalidates real-time candidate availability & pricing for a selected Part 4 plan.
    Enforces stale plan protection: if the active disruption fingerprint differs from the
    plan's fingerprint, revalidation is rejected with status STALE_PLAN.
    """
    # 1. Verify trip exists
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        return {
            "status": "FAILED",
            "message": "Trip not found"
        }

    # 2. Check active disruption fingerprint
    active_fp = get_active_disruption_fingerprint(db, trip_id)
    if disruption_fingerprint and active_fp != disruption_fingerprint:
        return {
            "status": "STALE_PLAN",
            "message": "Your recovery plan is no longer current because your journey changed.",
            "trip_id": trip_id,
            "disruption_fingerprint": active_fp
        }

    changes = plan.get("changes") or []
    replacement_changes = [c for c in changes if c.get("action") in ["REPLACE", "MODIFY"]]
    kept_changes = [c for c in changes if c.get("action") == "KEEP"]

    revalidated_items = []
    total_replacement_cost = 0.0
    total_modification_fees = 0.0
    total_cancellation_penalties = 0.0
    total_estimated_refunds = 0.0
    all_available = True

    for change in replacement_changes:
        change = _enrich_change_for_booking(change)
        provider = _get_provider_for_change(change)
        reval = provider.revalidate(change)

        repl_price = float(reval.get("current_price") or change.get("estimated_cost") or change.get("cost") or 0.0)
        mod_fee = float(change.get("modification_fee") or 0.0)
        canc_pen = float(change.get("cancellation_penalty") or 0.0)
        est_refund = float(change.get("estimated_refund") or 0.0)

        item_addl_cost = repl_price + mod_fee + canc_pen - est_refund

        total_replacement_cost += repl_price
        total_modification_fees += mod_fee
        total_cancellation_penalties += canc_pen
        total_estimated_refunds += est_refund

        if not reval.get("available", True):
            all_available = False

        revalidated_items.append({
            "node_id": str(change.get("node_id")),
            "original_title": change.get("original_title", "Disrupted Booking"),
            "replacement_title": change.get("new_title") or change.get("explanation") or "Proposed Replacement",
            "provider": reval.get("provider", "MockProvider"),
            "type": change.get("type", "BOOKING"),
            "available": reval.get("available", True),
            "replacement_price": repl_price,
            "current_price": repl_price,
            "modification_fee": mod_fee,
            "cancellation_penalty": canc_pen,
            "estimated_refund": est_refund,
            "item_additional_cost": item_addl_cost,
            "currency": reval.get("currency", "INR"),
            "checked_at": reval.get("checked_at", datetime.utcnow().isoformat() + "Z"),
            "booking_conditions": reval.get("booking_conditions", "Instant confirmation")
        })

    current_estimated_additional_cost = total_replacement_cost + total_modification_fees + total_cancellation_penalties - total_estimated_refunds

    if not all_available:
        return {
            "status": "UNAVAILABLE",
            "message": "A proposed recovery replacement is no longer available at the current check. No booking has been made.",
            "revalidated_items": revalidated_items
        }

    part4_est = float(plan.get("estimated_additional_cost") or 0.0)
    price_diff = current_estimated_additional_cost - part4_est

    exec_id = f"exec_t{trip_id}_{plan.get('id', 'plan')}_{active_fp or '0'}"

    # Upsert execution record safely in DB
    existing_exec = _upsert_recovery_execution(
        db=db,
        exec_id=exec_id,
        trip_id=trip_id,
        plan_id=str(plan.get("id")),
        active_fp=active_fp,
        status="READY_FOR_CONFIRMATION",
        total_price=current_estimated_additional_cost,
        metadata={"plan": plan}
    )

    return {
        "status": "READY_FOR_CONFIRMATION",
        "execution_id": exec_id,
        "trip_id": trip_id,
        "disruption_fingerprint": active_fp,
        "part4_estimated_additional_cost": part4_est,
        "current_estimated_additional_cost": current_estimated_additional_cost,
        "estimated_earlier_cost": part4_est,
        "earlier_estimated_additional_cost": part4_est,
        "current_additional_cost": current_estimated_additional_cost,
        "current_total_price": current_estimated_additional_cost,
        "price_difference": price_diff,
        "currency": "INR",
        "revalidated_items": revalidated_items,
        "unchanged_items": [{"node_id": str(c.get("node_id")), "title": c.get("original_title")} for c in kept_changes],
        "cost": {
            "replacement_cost": total_replacement_cost,
            "modification_fees": total_modification_fees,
            "cancellation_penalties": total_cancellation_penalties,
            "estimated_refunds": total_estimated_refunds,
            "current_estimated_additional_cost": current_estimated_additional_cost,
            "part4_estimated_additional_cost": part4_est,
            "price_difference": price_diff,
            "currency": "INR"
        },
        "checked_at": datetime.utcnow().isoformat() + "Z"
    }


def execute_plan(
    db: Session,
    trip_id: int,
    plan: Dict[str, Any],
    disruption_fingerprint: str,
    execution_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes booking replacements through mock providers.
    Enforces idempotency: if execution_id is already COMPLETED or PARTIALLY_COMPLETED, returns
    the persisted booking result without recreating bookings or generating duplicate PNRs.
    Updates original itinerary items -> REPLACED and creates new replacement items -> CONFIRMED.
    """
    exec_id = execution_id or f"exec_t{trip_id}_{plan.get('id', 'plan')}_{disruption_fingerprint or '0'}"

    # 1. Idempotency Check: return existing result if already executed
    existing_exec = db.query(models.RecoveryExecution).filter(
        models.RecoveryExecution.execution_id == exec_id
    ).first()

    if existing_exec and existing_exec.status in ["COMPLETED", "PARTIALLY_COMPLETED"]:
        # Return persisted execution result directly
        confirmed = []
        failed = []
        for item in sorted(existing_exec.items, key=lambda x: x.id):
            confirm_obj = {
                "status": item.status,
                "node_id": item.replacement_node_id or str(item.journey_item_id),
                "original_title": item.booking_metadata.get("original_title", "Booking"),
                "replacement_title": item.booking_metadata.get("replacement_title", "Replacement"),
                "provider": item.provider,
                "type": item.replacement_type,
                "booking_reference": item.booking_reference or "N/A",
                "pnr": item.booking_reference or "N/A",
                "ticket_number": item.ticket_number,
                "confirmation_number": item.booking_reference,
                "flight_number": item.booking_metadata.get("flight_number"),
                "seat": item.booking_metadata.get("seat"),
                "cabin_class": item.booking_metadata.get("cabin_class"),
                "room_type": item.booking_metadata.get("room_type"),
                "vehicle_category": item.booking_metadata.get("vehicle_category"),
                "final_price": item.final_price,
                "currency": item.currency,
                "booked_at": item.created_at.isoformat() + "Z",
                "error_message": item.error_message
            }
            if item.status == "BOOKED":
                confirmed.append(confirm_obj)
            else:
                failed.append(confirm_obj)

        return {
            "execution_id": exec_id,
            "trip_id": trip_id,
            "disruption_fingerprint": existing_exec.disruption_fingerprint,
            "status": existing_exec.status,
            "journey_status": "RECOVERED" if existing_exec.status == "COMPLETED" else "PARTIALLY_RECOVERED",
            "confirmed_bookings": confirmed,
            "failed_bookings": failed,
            "unchanged_items": existing_exec.execution_metadata.get("unchanged_items", []),
            "total_final_price": existing_exec.total_price,
            "currency": existing_exec.currency,
            "executed_at": existing_exec.updated_at.isoformat() + "Z",
            "message": "Recovery execution completed (idempotent result)."
        }

    # 2. Check active disruption fingerprint
    active_fp = get_active_disruption_fingerprint(db, trip_id)
    if disruption_fingerprint and active_fp != disruption_fingerprint:
        return {
            "status": "STALE_PLAN",
            "message": "Your recovery plan is no longer current because your journey changed.",
            "trip_id": trip_id,
            "disruption_fingerprint": active_fp
        }

    # 3. Create or update execution record -> BOOKING_IN_PROGRESS
    existing_exec = _upsert_recovery_execution(
        db=db,
        exec_id=exec_id,
        trip_id=trip_id,
        plan_id=str(plan.get("id")),
        active_fp=active_fp,
        status="BOOKING_IN_PROGRESS"
    )
    existing_exec.items.clear()
    db.commit()

    changes = plan.get("changes") or []
    replacement_changes = [c for c in changes if c.get("action") in ["REPLACE", "MODIFY"]]
    kept_changes = [c for c in changes if c.get("action") == "KEEP"]

    # 3b. Create Pre-Recovery Snapshot BEFORE mutating any ItineraryItem or DisruptionEvent
    exec_meta = dict(existing_exec.execution_metadata or {})
    if "original_journey_snapshot" not in exec_meta:
        snapshot_items = []
        snapshot_disruptions = []

        # Snapshot ALL current itinerary items for trip_id before any mutations
        all_trip_items = db.query(models.ItineraryItem).filter(
            models.ItineraryItem.trip_id == trip_id
        ).all()
        for it_item in all_trip_items:
            snapshot_items.append({
                "id": it_item.id,
                "status": it_item.status,
                "booking_id": it_item.booking_id,
                "provider": it_item.provider,
                "type": it_item.type,
                "origin": it_item.origin,
                "destination": it_item.destination,
                "location": it_item.location,
                "start_time": it_item.start_time.isoformat() if it_item.start_time else None,
                "end_time": it_item.end_time.isoformat() if it_item.end_time else None,
                "item_metadata": dict(it_item.item_metadata or {})
            })

        for change in replacement_changes:
            node_id_val = str(change.get("node_id"))
            source_d_ids = change.get("source_disruption_ids") or change.get("disruption_ids") or []
            if isinstance(source_d_ids, int):
                source_d_ids = [source_d_ids]

            disruptions_to_snapshot = []
            if source_d_ids:
                disruptions_to_snapshot = db.query(models.DisruptionEvent).filter(
                    models.DisruptionEvent.trip_id == trip_id,
                    models.DisruptionEvent.id.in_(source_d_ids)
                ).all()
            elif node_id_val.isdigit():
                disruptions_to_snapshot = db.query(models.DisruptionEvent).filter(
                    models.DisruptionEvent.trip_id == trip_id,
                    models.DisruptionEvent.entity_id == int(node_id_val)
                ).all()

            for de in disruptions_to_snapshot:
                if not any(d["id"] == de.id for d in snapshot_disruptions):
                    snapshot_disruptions.append({
                        "id": de.id,
                        "status": de.status,
                        "event_metadata": dict(de.event_metadata or {})
                    })

        exec_meta["original_journey_snapshot"] = {
            "items": snapshot_items,
            "disruptions": snapshot_disruptions
        }
        existing_exec.execution_metadata = exec_meta
        db.commit()

    confirmed_bookings = []
    failed_bookings = []
    total_final_price = 0.0

    # 4. Execute replacement bookings through providers
    for change in replacement_changes:
        change = _enrich_change_for_booking(change)
        provider = _get_provider_for_change(change)
        book_res = provider.book(change)

        node_id_val = str(change.get("node_id"))
        orig_details = change.get("original_details") or {}
        orig_title = change.get("original_title") or "Disrupted Booking"
        orig_provider = (
            orig_details.get("provider")
            or change.get("original_provider")
            or (orig_title.split(" (")[0].strip() if orig_title else None)
        )
        repl_title = change.get("new_title") or change.get("explanation") or "Replacement Booking"

        if book_res.get("success"):
            b_data = book_res.get("booking", {})
            pnr_ref = b_data.get("booking_reference") or b_data.get("pnr") or b_data.get("confirmation_number") or f"REF-{node_id_val}"
            ticket_num = b_data.get("ticket_number")
            item_cost = float(b_data.get("final_price") or change.get("estimated_cost") or 0.0)
            total_final_price += item_cost

            # Resolve original itinerary row BEFORE recording booking metadata
            target_item = None
            if node_id_val.isdigit():
                target_item = db.query(models.ItineraryItem).filter(
                    models.ItineraryItem.id == int(node_id_val)
                ).first()
            if target_item and target_item.provider:
                orig_provider = target_item.provider

            # Record DB ExecutionItem
            exec_item = models.RecoveryExecutionItem(
                execution_id=exec_id,
                journey_item_id=int(node_id_val) if node_id_val.isdigit() else None,
                replacement_node_id=node_id_val,
                replacement_type=change.get("type", "FLIGHT"),
                provider=b_data.get("provider") or change.get("provider") or "MockProvider",
                status="BOOKED",
                booking_reference=pnr_ref,
                ticket_number=ticket_num,
                final_price=item_cost,
                currency=b_data.get("currency", "INR"),
                booking_metadata={
                    "original_title": orig_title,
                    "original_provider": orig_provider,
                    "replacement_title": repl_title,
                    "flight_number": b_data.get("flight_number"),
                    "train_number": b_data.get("train_number"),
                    "seat": b_data.get("seat") or b_data.get("seat_or_berth"),
                    "cabin_class": b_data.get("cabin_class") or b_data.get("class"),
                    "room_type": b_data.get("room_type"),
                    "vehicle_category": b_data.get("vehicle_category"),
                    "departure_time": b_data.get("departure_time"),
                    "arrival_time": b_data.get("arrival_time"),
                    "check_in": b_data.get("check_in"),
                    "check_out": b_data.get("check_out"),
                    "origin": b_data.get("origin") or change.get("origin"),
                    "destination": b_data.get("destination") or change.get("destination"),
                }
            )
            db.add(exec_item)

            confirm_obj = {
                "status": "BOOKED",
                "node_id": node_id_val,
                "original_title": orig_title,
                "original_provider": orig_provider,
                "replacement_title": repl_title,
                "provider": b_data.get("provider") or change.get("provider") or "MockProvider",
                "type": change.get("type", "FLIGHT"),
                "booking_reference": pnr_ref,
                "pnr": pnr_ref,
                "ticket_number": ticket_num,
                "confirmation_number": pnr_ref,
                "flight_number": b_data.get("flight_number"),
                "train_number": b_data.get("train_number"),
                "seat": b_data.get("seat") or b_data.get("seat_or_berth"),
                "cabin_class": b_data.get("cabin_class"),
                "room_type": b_data.get("room_type"),
                "vehicle_category": b_data.get("vehicle_category"),
                "origin": b_data.get("origin") or change.get("origin"),
                "destination": b_data.get("destination") or change.get("destination"),
                "final_price": item_cost,
                "currency": b_data.get("currency", "INR"),
                "booked_at": datetime.utcnow().isoformat() + "Z"
            }
            confirmed_bookings.append(confirm_obj)

            # Update DB ItineraryItem — mark original as REPLACED (never mutate provider)
            if target_item:
                target_item.status = "REPLACED"
                meta = dict(target_item.item_metadata or {})
                meta["replaced_by_pnr"] = pnr_ref
                meta["replaced_at"] = datetime.utcnow().isoformat() + "Z"
                target_item.item_metadata = meta

            # Create new replacement ItineraryItem in DB with recovery_execution_id tagged
            new_item_meta = dict(b_data or {})
            new_item_meta["recovery_execution_id"] = exec_id
            new_item_meta["is_replacement"] = True
            new_item_meta["replaced_item_id"] = int(node_id_val) if node_id_val.isdigit() else None
            new_item_meta["original_provider"] = orig_provider
            new_item_meta["original_title"] = orig_title

            new_item = models.ItineraryItem(
                trip_id=trip_id,
                type=change.get("type") or (target_item.type if target_item else "FLIGHT"),
                provider=b_data.get("provider") or change.get("provider") or "MockProvider",
                origin=b_data.get("origin") or change.get("origin") or (target_item.origin if target_item else None),
                destination=b_data.get("destination") or change.get("destination") or (target_item.destination if target_item else None),
                location=b_data.get("location") or (target_item.location if target_item else None),
                start_time=_safe_parse_datetime(
                    b_data.get("departure_time") or b_data.get("check_in") or b_data.get("pickup_time") or change.get("start_time"),
                    fallback=target_item.start_time if target_item else datetime.utcnow()
                ),
                end_time=_safe_parse_datetime(
                    b_data.get("arrival_time") or b_data.get("check_out") or b_data.get("drop_time") or change.get("end_time"),
                    fallback=target_item.end_time if target_item else datetime.utcnow()
                ),
                cost=item_cost,
                currency="INR",
                priority=target_item.priority if target_item else "MUST_PRESERVE",
                flexibility="FIXED",
                status="CONFIRMED",
                booking_id=pnr_ref,
                item_metadata=new_item_meta
            )
            db.add(new_item)

            # Mark corresponding active disruption(s) as RESOLVED
            source_d_ids = change.get("source_disruption_ids") or change.get("disruption_ids") or []
            if isinstance(source_d_ids, int):
                source_d_ids = [source_d_ids]

            disruptions_to_resolve = []
            if source_d_ids:
                disruptions_to_resolve = db.query(models.DisruptionEvent).filter(
                    models.DisruptionEvent.trip_id == trip_id,
                    models.DisruptionEvent.id.in_(source_d_ids),
                    models.DisruptionEvent.status == "ACTIVE"
                ).all()

            if not disruptions_to_resolve and node_id_val.isdigit():
                disruptions_to_resolve = db.query(models.DisruptionEvent).filter(
                    models.DisruptionEvent.trip_id == trip_id,
                    models.DisruptionEvent.entity_id == int(node_id_val),
                    models.DisruptionEvent.status == "ACTIVE"
                ).all()

            for de in disruptions_to_resolve:
                de.status = "RESOLVED"
                meta = dict(de.event_metadata or {})
                meta["resolved_at"] = datetime.utcnow().isoformat() + "Z"
                meta["resolved_by_execution_id"] = exec_id
                de.event_metadata = meta

        else:
            # Booking failed for this replacement
            err_msg = book_res.get("error_message") or "Provider booking failed"
            exec_item = models.RecoveryExecutionItem(
                execution_id=exec_id,
                journey_item_id=int(node_id_val) if node_id_val.isdigit() else None,
                replacement_node_id=node_id_val,
                replacement_type=change.get("type", "FLIGHT"),
                provider=change.get("provider", "MockProvider"),
                status="FAILED",
                error_message=err_msg,
                booking_metadata={"original_title": orig_title, "replacement_title": repl_title}
            )
            db.add(exec_item)

            failed_bookings.append({
                "status": "FAILED",
                "node_id": node_id_val,
                "original_title": orig_title,
                "replacement_title": repl_title,
                "provider": change.get("provider", "MockProvider"),
                "type": change.get("type", "FLIGHT"),
                "error_message": err_msg
            })

    # 5. Determine overall execution status & remaining active disruptions
    unchanged_items = [{"node_id": str(c.get("node_id")), "title": c.get("original_title")} for c in kept_changes]

    db.flush()
    remaining_active = db.query(models.DisruptionEvent).filter(
        models.DisruptionEvent.trip_id == trip_id,
        models.DisruptionEvent.status == "ACTIVE"
    ).all()

    if len(failed_bookings) == 0 and len(confirmed_bookings) > 0 and len(remaining_active) == 0:
        final_status = "COMPLETED"
        journey_status = "RECOVERED"
    elif len(confirmed_bookings) > 0 and len(failed_bookings) > 0:
        final_status = "PARTIALLY_COMPLETED"
        journey_status = "PARTIALLY_RECOVERED" if len(remaining_active) > 0 else "RECOVERED"
    elif len(confirmed_bookings) > 0 and len(remaining_active) > 0:
        final_status = "PARTIALLY_COMPLETED"
        journey_status = "DISRUPTED"
    else:
        final_status = "FAILED"
        journey_status = "DISRUPTED"

    existing_exec.status = final_status
    existing_exec.total_price = total_final_price
    exec_meta = dict(existing_exec.execution_metadata or {})
    exec_meta["plan"] = plan
    exec_meta["unchanged_items"] = unchanged_items
    existing_exec.execution_metadata = exec_meta
    existing_exec.updated_at = datetime.utcnow()

    db.commit()

    return {
        "execution_id": exec_id,
        "trip_id": trip_id,
        "disruption_fingerprint": active_fp,
        "status": final_status,
        "journey_status": journey_status,
        "confirmed_bookings": confirmed_bookings,
        "failed_bookings": failed_bookings,
        "unchanged_items": unchanged_items,
        "total_final_price": total_final_price,
        "currency": "INR",
        "executed_at": existing_exec.updated_at.isoformat() + "Z",
        "message": "Recovery execution completed successfully." if final_status == "COMPLETED" else "Recovery execution partially completed."
    }


def get_execution_by_id(db: Session, execution_id: Optional[str] = None, trip_id: Optional[int] = None) -> Dict[str, Any]:
    """Fetch stored Part 5 execution result by execution_id or canonical/latest for trip_id."""
    latest = None
    if execution_id:
        existing_exec = db.query(models.RecoveryExecution).filter(
            models.RecoveryExecution.execution_id == execution_id
        ).first()
    elif trip_id is not None:
        existing_exec = _find_canonical_recovery_execution(db, trip_id)
        latest = (
            db.query(models.RecoveryExecution)
            .filter(
                models.RecoveryExecution.trip_id == trip_id,
                models.RecoveryExecution.status.in_(["COMPLETED", "PARTIALLY_COMPLETED"])
            )
            .order_by(models.RecoveryExecution.created_at.desc())
            .first()
        )
        if not existing_exec:
            existing_exec = latest
    else:
        existing_exec = None

    if not existing_exec:
        return {"status": "NOT_FOUND", "message": "Execution record not found."}

    demo_flag_source = latest or existing_exec

    confirmed = []
    failed = []
    for item in existing_exec.items:
        meta = item.booking_metadata or {}
        orig_provider = meta.get("original_provider")
        if not orig_provider and item.journey_item_id:
            src = db.query(models.ItineraryItem).filter(
                models.ItineraryItem.id == item.journey_item_id
            ).first()
            if src:
                orig_provider = src.provider
        if not orig_provider and meta.get("original_title"):
            orig_provider = str(meta.get("original_title")).split(" (")[0].strip()

        obj = {
            "status": item.status,
            "node_id": item.replacement_node_id or str(item.journey_item_id),
            "original_title": meta.get("original_title", "Booking"),
            "original_provider": orig_provider,
            "replacement_title": meta.get("replacement_title", "Replacement"),
            "provider": item.provider,
            "type": item.replacement_type,
            "booking_reference": item.booking_reference or "N/A",
            "pnr": item.booking_reference or "N/A",
            "ticket_number": item.ticket_number,
            "confirmation_number": item.booking_reference,
            "flight_number": meta.get("flight_number"),
            "seat": meta.get("seat"),
            "cabin_class": meta.get("cabin_class"),
            "room_type": meta.get("room_type"),
            "vehicle_category": meta.get("vehicle_category"),
            "origin": meta.get("origin"),
            "destination": meta.get("destination"),
            "final_price": item.final_price,
            "currency": item.currency,
            "booked_at": item.created_at.isoformat() + "Z",
            "error_message": item.error_message
        }
        if item.status == "BOOKED":
            confirmed.append(obj)
        else:
            failed.append(obj)

    return {
        "execution_id": existing_exec.execution_id,
        "trip_id": existing_exec.trip_id,
        "disruption_fingerprint": existing_exec.disruption_fingerprint,
        "status": existing_exec.status,
        "demo_restored": bool(demo_flag_source.demo_restored),
        "restored_at": demo_flag_source.restored_at.isoformat() + "Z" if demo_flag_source.restored_at else None,
        "journey_status": "RECOVERED" if existing_exec.status == "COMPLETED" else "PARTIALLY_RECOVERED",
        "confirmed_bookings": confirmed,
        "failed_bookings": failed,
        "unchanged_items": (existing_exec.execution_metadata or {}).get("unchanged_items", []),
        "total_final_price": existing_exec.total_price,
        "currency": existing_exec.currency,
        "executed_at": existing_exec.updated_at.isoformat() + "Z"
    }


def restore_original_journey(
    db: Session,
    trip_id: int,
    execution_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Restores simulated active journey state to the true original bookings.
    Replacement rows (tagged with recovery_execution_id OR matching a recovered PNR)
    become RESTORED_DEMO. Original booking rows are never overwritten — only status flips.
    """
    canonical = _find_canonical_recovery_execution(db, trip_id, execution_id)
    latest = (
        db.query(models.RecoveryExecution)
        .filter(
            models.RecoveryExecution.trip_id == trip_id,
            models.RecoveryExecution.status.in_(["COMPLETED", "PARTIALLY_COMPLETED"])
        )
        .order_by(models.RecoveryExecution.created_at.desc())
        .first()
    )
    exec_record = latest or canonical
    target_exec_id = canonical.execution_id if canonical else (exec_record.execution_id if exec_record else None)
    already_restored = bool(exec_record.demo_restored) if exec_record else False

    # PNRs created by any completed recovery on this trip
    replacement_pnrs = set()
    original_ids = set()
    completed = db.query(models.RecoveryExecution).filter(
        models.RecoveryExecution.trip_id == trip_id,
        models.RecoveryExecution.status.in_(["COMPLETED", "PARTIALLY_COMPLETED"])
    ).all()
    for er in completed:
        for ei in (er.items or []):
            if ei.booking_reference:
                replacement_pnrs.add(ei.booking_reference)
            if ei.journey_item_id:
                original_ids.add(ei.journey_item_id)

    all_items = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.trip_id == trip_id
    ).all()

    for item in all_items:
        meta = dict(item.item_metadata or {})
        is_repl = (
            _item_is_replacement(item)
            or (item.booking_id and item.booking_id in replacement_pnrs)
            or (meta.get("pnr") and meta.get("pnr") in replacement_pnrs)
            or (meta.get("booking_reference") and meta.get("booking_reference") in replacement_pnrs)
        )
        if is_repl:
            item.status = "RESTORED_DEMO"
            # Backfill tags so future toggles don't miss legacy rows
            if not meta.get("recovery_execution_id") and not meta.get("is_replacement"):
                meta["is_replacement"] = True
                if canonical:
                    meta["recovery_execution_id"] = canonical.execution_id
                item.item_metadata = meta
        elif item.id in original_ids or item.status in ("REPLACED", "RESTORED_DEMO", "CONFIRMED"):
            if not is_repl:
                item.status = "CONFIRMED"

    # Reactivate disruptions associated with the canonical (or any) recovery
    disruptions = db.query(models.DisruptionEvent).filter(
        models.DisruptionEvent.trip_id == trip_id
    ).all()
    for de in disruptions:
        meta = dict(de.event_metadata or {})
        resolved_by = meta.get("resolved_by_execution_id")
        if de.status == "RESOLVED" and (
            not resolved_by
            or (canonical and resolved_by == canonical.execution_id)
            or (exec_record and resolved_by == exec_record.execution_id)
        ):
            de.status = "ACTIVE"

    now = datetime.utcnow()
    for er in completed:
        er.demo_restored = True
        er.restored_at = now

    db.commit()

    return {
        "status": "ALREADY_RESTORED" if already_restored else "RESTORED",
        "trip_id": trip_id,
        "execution_id": target_exec_id or f"restored_t{trip_id}",
        "message": "Original journey restored for demo."
    }


def activate_recovered_journey(
    db: Session,
    trip_id: int,
    execution_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Activates the recovered journey state (flip from Original → Recovered view).
    Uses the canonical execution so we restore the selected recovery, not a
    later re-recovery that incorrectly treated a replacement as the original.
    """
    exec_record = _find_canonical_recovery_execution(db, trip_id, execution_id)
    if not exec_record:
        return {
            "status": "NOT_FOUND",
            "trip_id": trip_id,
            "message": "No recovery execution record found to activate."
        }

    target_exec_id = exec_record.execution_id
    booked_items = [i for i in (exec_record.items or []) if i.status == "BOOKED"]
    original_ids = {i.journey_item_id for i in booked_items if i.journey_item_id}
    replacement_pnrs = {i.booking_reference for i in booked_items if i.booking_reference}

    all_trip_items = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.trip_id == trip_id
    ).all()

    for item in all_trip_items:
        meta = item.item_metadata or {}
        if item.id in original_ids:
            item.status = "REPLACED"
            if not meta.get("replaced_by_pnr") and replacement_pnrs:
                meta = dict(meta)
                meta["replaced_by_pnr"] = next(iter(replacement_pnrs))
                item.item_metadata = meta
        elif (
            item.booking_id in replacement_pnrs
            or meta.get("recovery_execution_id") == target_exec_id
        ):
            item.status = "CONFIRMED"
        elif _item_is_replacement(item):
            item.status = "RESTORED_DEMO"

    # Mark disruptions resolved for this recovery
    disruptions = db.query(models.DisruptionEvent).filter(
        models.DisruptionEvent.trip_id == trip_id
    ).all()
    for de in disruptions:
        de.status = "RESOLVED"
        meta = dict(de.event_metadata or {})
        meta["resolved_by_execution_id"] = target_exec_id
        meta["resolved_at"] = datetime.utcnow().isoformat() + "Z"
        de.event_metadata = meta

    completed = db.query(models.RecoveryExecution).filter(
        models.RecoveryExecution.trip_id == trip_id,
        models.RecoveryExecution.status.in_(["COMPLETED", "PARTIALLY_COMPLETED"])
    ).all()
    for er in completed:
        er.demo_restored = False

    db.commit()

    return {
        "status": "RECOVERED",
        "trip_id": trip_id,
        "execution_id": target_exec_id,
        "message": "Recovered journey activated."
    }
