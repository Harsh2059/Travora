from typing import Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
import uuid

import models
from services.recovery.models import RecoveryPlanModel
from services.graph.builder import build_dependency_graph
from services.graph.queries import GraphQueries

class ExecutionError(Exception):
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
        Atomically executes an approved recovery plan against the database:
        - Updates modified items
        - Cancels/marks removed items
        - Inserts newly booked items
        - Increments trip version
        - Logs immutable RecoveryHistory
        - Re-evaluates graph digital twin
        """
        trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
        if not trip:
            raise ExecutionError(f"Trip {trip_id} not found")

        if not plan.feasibility:
            raise ExecutionError(f"Cannot execute infeasible plan: {'; '.join(plan.infeasibility_reasons)}")

        prev_version = trip.version or 1
        new_version = prev_version + 1
        recovery_id = f"REC-{uuid.uuid4().hex[:8].upper()}"

        # 1. Update removed items -> mark as CANCELLED
        removed_ids = [it.get("id") for it in plan.removed_items if it.get("id")]
        if removed_ids:
            db.query(models.ItineraryItem).filter(
                models.ItineraryItem.trip_id == trip_id,
                models.ItineraryItem.id.in_(removed_ids)
            ).update({"status": "CANCELLED"}, synchronize_session=False)

        # 2. Update modified items
        for mod in plan.modified_items:
            mod_id = mod.get("id")
            if not mod_id:
                continue
            item = db.query(models.ItineraryItem).filter(
                models.ItineraryItem.trip_id == trip_id,
                models.ItineraryItem.id == mod_id
            ).first()
            if item:
                st = mod.get("start_time")
                et = mod.get("end_time")
                if isinstance(st, str):
                    st = datetime.fromisoformat(st)
                if isinstance(et, str):
                    et = datetime.fromisoformat(et)
                item.start_time = st
                item.end_time = et
                item.status = mod.get("status", "MODIFIED")
                if "cost" in mod:
                    item.cost = mod["cost"]

        # 3. Insert newly added items
        added_records = []
        for add in plan.added_items:
            st = add.get("start_time")
            et = add.get("end_time")
            if isinstance(st, str):
                st = datetime.fromisoformat(st)
            if isinstance(et, str):
                et = datetime.fromisoformat(et)

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
                booking_id=add.get("booking_id", f"NEW-{uuid.uuid4().hex[:6].upper()}"),
                refundable=add.get("refundable", True),
                refund_percentage=add.get("refund_percentage", 80.0),
                cancellation_fee=add.get("cancellation_fee", 500.0),
                changeable=add.get("changeable", True),
                change_fee=add.get("change_fee", 500.0),
                item_metadata={"recovery_id": recovery_id, "strategy": plan.strategy_type}
            )
            db.add(new_item)
            added_records.append(new_item)

        # 4. Increment Trip version
        trip.version = new_version

        # 5. Log RecoveryHistory
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
                "strategy": plan.strategy_type
            },
            timestamp=datetime.utcnow()
        )
        db.add(history_record)

        db.commit()
        db.refresh(trip)

        # Fetch active items (excluding cancelled) for new graph
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
            "message": f"Itinerary successfully updated to Version {new_version}. Digital twin graph reconstructed.",
            "updated_graph": graph_dict,
            "active_item_count": len(active_items)
        }
