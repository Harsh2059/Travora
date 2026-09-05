from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
import models

class VersionComparisonEngine:
    """
    Compares two itinerary versions of a trip and calculates structured diffs:
    - ADDED, REMOVED, MODIFIED, PRESERVED items
    - Financial diff (cost, refund, fees, net)
    - Operational diff (additional delay)
    - Critical commitments preserved
    """

    @classmethod
    def compare_versions(
        cls,
        db: Session,
        trip_id: int,
        version_a: int,
        version_b: int
    ) -> Dict[str, Any]:
        trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
        if not trip:
            raise ValueError(f"Trip {trip_id} not found")

        # Normalize ordering: version_a should be <= version_b
        v_start = min(version_a, version_b)
        v_end = max(version_a, version_b)

        # Query all recovery histories between these versions
        histories = db.query(models.RecoveryHistory).filter(
            models.RecoveryHistory.trip_id == trip_id,
            models.RecoveryHistory.previous_version >= v_start,
            models.RecoveryHistory.new_version <= v_end
        ).order_by(models.RecoveryHistory.timestamp.asc()).all()

        total_net_cost = sum(h.net_cost for h in histories)
        total_delay = sum(h.additional_delay_minutes for h in histories)

        added_items = []
        removed_items = []
        modified_items = []
        preserved_items = []

        # Aggregate item changes from histories
        for h in histories:
            details = h.plan_details or {}
            changes = h.changes or {}
            
            # Extract items if stored in changes
            if "added_items" in changes:
                added_items.extend(changes["added_items"])
            if "removed_items" in changes:
                removed_items.extend(changes["removed_items"])
            if "modified_items" in changes:
                modified_items.extend(changes["modified_items"])

        # Fetch current active items vs cancelled items
        all_items = db.query(models.ItineraryItem).filter(
            models.ItineraryItem.trip_id == trip_id
        ).all()

        current_active = [it for it in all_items if it.status != "CANCELLED"]
        cancelled = [it for it in all_items if it.status == "CANCELLED"]

        # Check if critical commitment (e.g. conference) is preserved in active
        critical_preserved = any(it.priority == "CRITICAL" for it in current_active)

        return {
            "trip_id": trip_id,
            "version_a": version_a,
            "version_b": version_b,
            "is_identical": version_a == version_b,
            "financial_diff": {
                "net_cost_change": total_net_cost,
                "currency": "INR"
            },
            "operational_diff": {
                "delay_difference_minutes": total_delay,
                "delay_str": f"+{total_delay // 60}h {total_delay % 60}m" if total_delay >= 60 else f"+{total_delay}m"
            },
            "commitments": {
                "critical_commitment_preserved": critical_preserved,
                "active_components_count": len(current_active),
                "cancelled_components_count": len(cancelled)
            },
            "item_breakdown": {
                "added_count": len(added_items),
                "removed_count": len(removed_items),
                "modified_count": len(modified_items),
                "added_items": added_items,
                "removed_items": removed_items,
                "modified_items": modified_items
            },
            "transition_history": [
                {
                    "recovery_id": h.recovery_id,
                    "from_version": h.previous_version,
                    "to_version": h.new_version,
                    "plan_title": h.plan_title,
                    "event_type": h.event_type,
                    "net_cost": h.net_cost,
                    "additional_delay_minutes": h.additional_delay_minutes,
                    "timestamp": h.timestamp.isoformat() if h.timestamp else None
                }
                for h in histories
            ]
        }
