from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from .types import EventType, Severity

class EventValidationError(Exception):
    pass

class EventManager:
    @staticmethod
    def validate_event_data(data: Dict[str, Any]) -> None:
        event_type = data.get("event_type")
        if not event_type or event_type not in [e.value for e in EventType]:
            raise EventValidationError(f"Invalid or missing event_type: {event_type}")

        severity = data.get("severity", Severity.HIGH.value)
        if severity not in [s.value for s in Severity]:
            raise EventValidationError(f"Invalid severity: {severity}")

    @staticmethod
    def create_delay_event(
        trip_id: int,
        item_id: int,
        delay_minutes: int,
        current_item: Dict[str, Any],
        reason: str = "Technical / Air Traffic Control Delay"
    ) -> Dict[str, Any]:
        """Creates a standardized DELAY event for an itinerary item."""
        curr_start = current_item["start_time"]
        if isinstance(curr_start, str):
            curr_start = datetime.fromisoformat(curr_start)
        curr_end = current_item["end_time"]
        if isinstance(curr_end, str):
            curr_end = datetime.fromisoformat(curr_end)

        new_start = curr_start + timedelta(minutes=delay_minutes)
        new_end = curr_end + timedelta(minutes=delay_minutes)

        severity = Severity.CRITICAL.value if delay_minutes >= 240 else (
            Severity.HIGH.value if delay_minutes >= 120 else Severity.MEDIUM.value
        )

        return {
            "trip_id": trip_id,
            "event_type": EventType.DELAY.value,
            "entity_id": item_id,
            "severity": severity,
            "old_state": {
                "start_time": curr_start.isoformat(),
                "end_time": curr_end.isoformat(),
                "status": current_item.get("status", "CONFIRMED")
            },
            "new_state": {
                "start_time": new_start.isoformat(),
                "end_time": new_end.isoformat(),
                "status": "DELAYED",
                "delay_minutes": delay_minutes
            },
            "event_metadata": {
                "delay_minutes": delay_minutes,
                "reason": reason
            }
        }

    @staticmethod
    def create_cancellation_event(
        trip_id: int,
        item_id: int,
        current_item: Dict[str, Any],
        reason: str = "Carrier Cancellation"
    ) -> Dict[str, Any]:
        """Creates a standardized CANCELLATION event."""
        return {
            "trip_id": trip_id,
            "event_type": EventType.CANCELLATION.value,
            "entity_id": item_id,
            "severity": Severity.CRITICAL.value,
            "old_state": {
                "status": current_item.get("status", "CONFIRMED")
            },
            "new_state": {
                "status": "CANCELLED"
            },
            "event_metadata": {
                "reason": reason
            }
        }

    @staticmethod
    def create_user_requested_change_event(
        trip_id: int,
        item_id: Optional[int],
        requested_changes: Dict[str, Any],
        reason: str = "Traveler requested itinerary change"
    ) -> Dict[str, Any]:
        """Creates a standardized USER_REQUESTED_CHANGE event, handled by the same recovery pipeline."""
        return {
            "trip_id": trip_id,
            "event_type": EventType.USER_REQUESTED_CHANGE.value,
            "entity_id": item_id,
            "severity": Severity.MEDIUM.value,
            "old_state": {},
            "new_state": requested_changes,
            "event_metadata": {
                "reason": reason,
                "requested_changes": requested_changes
            }
        }
