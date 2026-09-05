from enum import Enum
from typing import Set, Dict, Optional

class ItineraryItemState(str, Enum):
    SCHEDULED = "SCHEDULED"
    CONFIRMED = "CONFIRMED"
    AT_RISK = "AT_RISK"
    DELAYED = "DELAYED"
    MISSED = "MISSED"
    CANCELLED = "CANCELLED"
    MODIFIED = "MODIFIED"
    COMPLETED = "COMPLETED"
    REFUNDED = "REFUNDED"
    REPLACED = "REPLACED"

class InvalidStateTransitionError(Exception):
    def __init__(self, current_state: str, new_state: str, item_id: Optional[int] = None):
        msg = f"Invalid itinerary state transition from '{current_state}' to '{new_state}'"
        if item_id is not None:
            msg += f" for item ID {item_id}"
        super().__init__(msg)
        self.current_state = current_state
        self.new_state = new_state
        self.item_id = item_id

class StateTransitionEngine:
    """
    Enforces deterministic and valid state transitions for itinerary items.
    """
    VALID_TRANSITIONS: Dict[ItineraryItemState, Set[ItineraryItemState]] = {
        ItineraryItemState.SCHEDULED: {
            ItineraryItemState.SCHEDULED,
            ItineraryItemState.CONFIRMED,
            ItineraryItemState.CANCELLED
        },
        ItineraryItemState.CONFIRMED: {
            ItineraryItemState.CONFIRMED,
            ItineraryItemState.AT_RISK,
            ItineraryItemState.DELAYED,
            ItineraryItemState.CANCELLED,
            ItineraryItemState.MODIFIED,
            ItineraryItemState.REPLACED,
            ItineraryItemState.COMPLETED
        },
        ItineraryItemState.AT_RISK: {
            ItineraryItemState.AT_RISK,
            ItineraryItemState.CONFIRMED,
            ItineraryItemState.DELAYED,
            ItineraryItemState.MISSED,
            ItineraryItemState.CANCELLED,
            ItineraryItemState.MODIFIED,
            ItineraryItemState.REPLACED
        },
        ItineraryItemState.DELAYED: {
            ItineraryItemState.DELAYED,
            ItineraryItemState.CONFIRMED,
            ItineraryItemState.MISSED,
            ItineraryItemState.CANCELLED,
            ItineraryItemState.MODIFIED,
            ItineraryItemState.REPLACED,
            ItineraryItemState.COMPLETED
        },
        ItineraryItemState.MISSED: {
            ItineraryItemState.MISSED,
            ItineraryItemState.CANCELLED,
            ItineraryItemState.REPLACED,
            ItineraryItemState.REFUNDED
        },
        ItineraryItemState.CANCELLED: {
            ItineraryItemState.CANCELLED,
            ItineraryItemState.REFUNDED,
            ItineraryItemState.REPLACED
        },
        ItineraryItemState.MODIFIED: {
            ItineraryItemState.MODIFIED,
            ItineraryItemState.CONFIRMED,
            ItineraryItemState.AT_RISK,
            ItineraryItemState.DELAYED,
            ItineraryItemState.CANCELLED,
            ItineraryItemState.REPLACED,
            ItineraryItemState.COMPLETED
        },
        ItineraryItemState.REPLACED: {
            ItineraryItemState.REPLACED,
            ItineraryItemState.CANCELLED,
            ItineraryItemState.REFUNDED
        },
        ItineraryItemState.REFUNDED: {
            ItineraryItemState.REFUNDED
        },
        ItineraryItemState.COMPLETED: {
            ItineraryItemState.COMPLETED
        }
    }

    @classmethod
    def can_transition(cls, current_state: str, new_state: str) -> bool:
        try:
            curr = ItineraryItemState(current_state.upper())
            target = ItineraryItemState(new_state.upper())
        except ValueError:
            return False
        return target in cls.VALID_TRANSITIONS.get(curr, set())

    @classmethod
    def validate_and_transition(cls, current_state: str, new_state: str, item_id: Optional[int] = None) -> ItineraryItemState:
        try:
            curr = ItineraryItemState(current_state.upper())
            target = ItineraryItemState(new_state.upper())
        except ValueError as e:
            raise InvalidStateTransitionError(current_state, new_state, item_id) from e

        if target not in cls.VALID_TRANSITIONS.get(curr, set()):
            raise InvalidStateTransitionError(current_state, new_state, item_id)

        return target
