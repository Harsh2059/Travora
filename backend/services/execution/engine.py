from typing import Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
import uuid
import logging

import models
from services.recovery.models import RecoveryPlanModel
from services.graph.builder import build_dependency_graph
from services.graph.queries import GraphQueries
from services.state.transition_engine import StateTransitionEngine, InvalidStateTransitionError
from services.recovery.state_machine import RecoveryStateMachine, RecoveryStatus
from services.execution.booking_service import MockBookingService

logger = logging.getLogger("travel_recovery.execution")

class ExecutionError(Exception):
    pass

class ItineraryVersionConflictError(ExecutionError):
    pass

class DuplicateExecutionError(ExecutionError):
    pass

class ExecutionEngine:
    @staticmethod
    def execute_recovery_plan(
        db: Session,
        trip_id: int,
        plan: RecoveryPlanModel,
        event_type: str = "DISRUPTION"
    ) -> Dict[str, Any]:
        """
        Transactional, safe, and idempotent recovery plan execution:
        1. Reloads current trip and verifies version match (stale plan protection)
        2. Idempotently returns existing execution if plan was already executed
        3. Validates feasibility and critical invariants
        4. Simulates real mock booking confirmations & refund transactions
        5. Validates legal itinerary state transitions
        6. Atomically commits changes or rolls back on failure
        7. Logs complete audit trail in RecoveryHistory
        8. Reconstructs graph digital twin
        """
        trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
        if not trip:
            raise ExecutionError(f"Trip {trip_id} not found")

        current_version = trip.version or 1

        # 1. Idempotency Check (returns existing record if this recovery was already executed)
        if plan.recovery_id:
            existing_history = db.query(models.RecoveryHistory).filter(
                models.RecoveryHistory.trip_id == trip_id,
                models.RecoveryHistory.recovery_id == plan.recovery_id
            ).first()
            if existing_history:
                logger.info(f"Idempotent execution detected for recovery_id={plan.recovery_id}. Returning existing record.")
                active_items = db.query(models.ItineraryItem).filter(
                    models.ItineraryItem.trip_id == trip_id,
                    models.ItineraryItem.status != "CANCELLED"
                ).order_by(models.ItineraryItem.start_time.asc()).all()
                new_graph = build_dependency_graph(active_items)
                return {
                    "success": True,
                    "idempotent": True,
                    "recovery_id": existing_history.recovery_id,
                    "trip_id": trip_id,
                    "previous_version": existing_history.previous_version,
                    "new_version": existing_history.new_version,
                    "selected_plan": existing_history.plan_title,
                    "net_cost": existing_history.net_cost,
                    "status": existing_history.status,
                    "message": f"Idempotent execution: Recovery {plan.recovery_id} already successfully applied.",
                    "updated_graph": GraphQueries(new_graph).to_dict(),
                    "active_item_count": len(active_items)
                }

        # 2. Stale Plan Protection: Verify version matches
        if plan.source_itinerary_version and plan.source_itinerary_version != current_version:
            raise ItineraryVersionConflictError(
                f"Recovery plan is no longer valid because the itinerary has changed. "
                f"Plan was generated for Version {plan.source_itinerary_version}, but current itinerary is Version {current_version}. "
                f"Fresh recovery analysis required."
            )

        # 3. Feasibility Check
        if not plan.feasibility:
            raise ExecutionError(f"Cannot execute infeasible plan: {'; '.join(plan.infeasibility_reasons)}")

        recovery_id = plan.recovery_id or f"REC-{uuid.uuid4().hex[:8].upper()}"
        plan.recovery_id = recovery_id
        plan.trip_id = trip_id

        # Initialize Recovery State Machine
        recovery_sm = RecoveryStateMachine(recovery_id, RecoveryStatus.ACCEPTED)
        recovery_sm.transition_to(RecoveryStatus.EXECUTING)

        prev_version = current_version
        new_version = prev_version + 1

        booking_confirmations = []
        cancellation_confirmations = []

        try:
            # 4. Handle removed items: simulate cancellation, refund & apply valid state transition
            removed_ids = [it.get("id") for it in plan.removed_items if it.get("id")]
            if removed_ids:
                items_to_remove = db.query(models.ItineraryItem).filter(
                    models.ItineraryItem.trip_id == trip_id,
                    models.ItineraryItem.id.in_(removed_ids)
                ).all()

                for item in items_to_remove:
                    # Validate state transition
                    target_status = "CANCELLED"
                    StateTransitionEngine.validate_and_transition(item.status, target_status, item.id)
                    item.status = target_status

                    # Mock cancellation execution
                    refund_amt = item.cost * (item.refund_percentage / 100.0) if item.refundable else 0.0
                    canc_conf = MockBookingService.execute_cancellation(
                        item.__dict__,
                        refund_amount=refund_amt,
                        fee_applied=item.cancellation_fee or 0.0
                    )
                    cancellation_confirmations.append(canc_conf.model_dump())
                    
                    # Update metadata with cancellation proof
                    meta = dict(item.item_metadata or {})
                    meta["cancellation_confirmation"] = canc_conf.model_dump(mode="json")
                    meta["recovery_id"] = recovery_id
                    item.item_metadata = meta

            # 5. Handle modified items: validate state transition & update properties
            for mod in plan.modified_items:
                mod_id = mod.get("id")
                if not mod_id:
                    continue
                item = db.query(models.ItineraryItem).filter(
                    models.ItineraryItem.trip_id == trip_id,
                    models.ItineraryItem.id == mod_id
                ).first()
                if item:
                    target_status = mod.get("status", "MODIFIED")
                    # If target is CONFIRMED_DELAYED, map to DELAYED for state machine
                    normalized_status = "DELAYED" if "DELAY" in target_status else "MODIFIED"
                    StateTransitionEngine.validate_and_transition(item.status, normalized_status, item.id)
                    item.status = target_status

                    st = mod.get("start_time")
                    et = mod.get("end_time")
                    if isinstance(st, str):
                        st = datetime.fromisoformat(st)
                    if isinstance(et, str):
                        et = datetime.fromisoformat(et)
                    item.start_time = st
                    item.end_time = et
                    if "cost" in mod:
                        item.cost = mod["cost"]

                    meta = dict(item.item_metadata or {})
                    meta["last_recovery_id"] = recovery_id
                    meta["rescheduled_at"] = datetime.now(timezone.utc).isoformat()
                    item.item_metadata = meta

            # 6. Handle added items: execute mock booking confirmation and insert record
            added_records = []
            for add in plan.added_items:
                st = add.get("start_time")
                et = add.get("end_time")
                if isinstance(st, str):
                    st = datetime.fromisoformat(st)
                if isinstance(et, str):
                    et = datetime.fromisoformat(et)

                booking_conf = MockBookingService.execute_booking(add)
                booking_confirmations.append(booking_conf.model_dump())

                item_meta = dict(add.get("item_metadata") or {})
                item_meta["recovery_id"] = recovery_id
                item_meta["strategy"] = plan.strategy_type
                item_meta["booking_confirmation"] = booking_conf.model_dump(mode="json")

                new_item = models.ItineraryItem(
                    trip_id=trip_id,
                    type=add.get("type", "FLIGHT"),
                    provider=add.get("provider", "Replacement Provider"),
                    origin=add.get("origin"),
                    destination=add.get("destination"),
                    location=add.get("location"),
                    start_time=st,
                    end_time=et,
                    cost=float(add.get("cost", 0.0)),
                    currency=add.get("currency", "INR"),
                    priority=add.get("priority", "HIGH"),
                    flexibility=add.get("flexibility", "FLEXIBLE"),
                    status="CONFIRMED",
                    booking_id=booking_conf.confirmation_code,
                    refundable=add.get("refundable", True),
                    refund_percentage=add.get("refund_percentage", 80.0),
                    cancellation_fee=add.get("cancellation_fee", 500.0),
                    changeable=add.get("changeable", True),
                    change_fee=add.get("change_fee", 500.0),
                    item_metadata=item_meta
                )
                db.add(new_item)
                added_records.append(new_item)

            # 7. Increment Trip version
            trip.version = new_version

            # 8. Log complete RecoveryHistory audit trail
            history_record = models.RecoveryHistory(
                trip_id=trip_id,
                recovery_id=recovery_id,
                previous_version=prev_version,
                new_version=new_version,
                event_type=event_type,
                selected_plan_id=plan.plan_id,
                plan_title=plan.title,
                net_cost=plan.net_cost,
                additional_delay_minutes=plan.additional_delay_minutes,
                changes={
                    "removed_count": len(plan.removed_items),
                    "modified_count": len(plan.modified_items),
                    "added_count": len(plan.added_items),
                    "strategy": plan.strategy_type,
                    "removed_items": [{"id": it.get("id"), "provider": it.get("provider")} for it in plan.removed_items],
                    "modified_items": [{"id": it.get("id"), "status": it.get("status")} for it in plan.modified_items],
                    "added_items": [{"provider": it.get("provider"), "cost": it.get("cost")} for it in plan.added_items]
                },
                plan_details={
                    "plan_id": plan.plan_id,
                    "title": plan.title,
                    "strategy_type": plan.strategy_type,
                    "net_cost": plan.net_cost,
                    "additional_cost": plan.additional_cost,
                    "refund_received": plan.refund_received,
                    "change_fees": plan.change_fees,
                    "cancellation_fees": plan.cancellation_fees,
                    "additional_delay_minutes": plan.additional_delay_minutes,
                    "confidence": plan.confidence,
                    "quality_metrics": plan.quality_metrics,
                    "traveler_summary": plan.traveler_summary or plan.explanation_summary,
                    "booking_confirmations": [b["confirmation_code"] for b in booking_confirmations],
                    "cancellation_confirmations": [c["confirmation_code"] for c in cancellation_confirmations]
                },
                status="COMPLETED",
                timestamp=datetime.now(timezone.utc)
            )
            db.add(history_record)

            # Atomically commit all changes
            db.commit()
            db.refresh(trip)

            recovery_sm.transition_to(RecoveryStatus.COMPLETED)

        except Exception as e:
            db.rollback()
            recovery_sm.transition_to(RecoveryStatus.FAILED)
            recovery_sm.transition_to(RecoveryStatus.ROLLED_BACK)
            logger.error(f"Execution failed for recovery_id={recovery_id}: {str(e)}", exc_info=True)
            if isinstance(e, ExecutionError):
                raise
            raise ExecutionError(f"Execution failed and transaction was rolled back: {str(e)}") from e

        # Fetch active items and construct new graph
        active_items = db.query(models.ItineraryItem).filter(
            models.ItineraryItem.trip_id == trip_id,
            models.ItineraryItem.status != "CANCELLED"
        ).order_by(models.ItineraryItem.start_time.asc()).all()

        new_graph = build_dependency_graph(active_items)
        graph_dict = GraphQueries(new_graph).to_dict()

        return {
            "success": True,
            "recovery_id": recovery_id,
            "trip_id": trip_id,
            "previous_version": prev_version,
            "new_version": new_version,
            "selected_plan": plan.title,
            "net_cost": plan.net_cost,
            "booking_confirmations": booking_confirmations,
            "cancellation_confirmations": cancellation_confirmations,
            "message": f"Itinerary successfully updated to Version {new_version}. Digital twin graph reconstructed.",
            "updated_graph": graph_dict,
            "active_item_count": len(active_items)
        }
