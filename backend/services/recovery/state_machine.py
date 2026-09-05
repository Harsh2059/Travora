from enum import Enum
from typing import Set, Dict, Optional

class RecoveryStatus(str, Enum):
    CREATED = "CREATED"
    ANALYZING = "ANALYZING"
    GENERATING = "GENERATING"
    VALIDATING = "VALIDATING"
    RANKED = "RANKED"
    PRESENTED = "PRESENTED"
    ACCEPTED = "ACCEPTED"
    EXECUTING = "EXECUTING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ROLLED_BACK = "ROLLED_BACK"

class InvalidRecoveryStateTransitionError(Exception):
    def __init__(self, current_status: str, new_status: str, recovery_id: Optional[str] = None):
        msg = f"Invalid recovery state transition from '{current_status}' to '{new_status}'"
        if recovery_id:
            msg += f" for recovery ID '{recovery_id}'"
        super().__init__(msg)
        self.current_status = current_status
        self.new_status = new_status
        self.recovery_id = recovery_id

class RecoveryStateMachine:
    """
    Manages deterministic lifecycle states of recovery operations.
    """
    VALID_TRANSITIONS: Dict[RecoveryStatus, Set[RecoveryStatus]] = {
        RecoveryStatus.CREATED: {
            RecoveryStatus.CREATED,
            RecoveryStatus.ANALYZING,
            RecoveryStatus.FAILED
        },
        RecoveryStatus.ANALYZING: {
            RecoveryStatus.ANALYZING,
            RecoveryStatus.GENERATING,
            RecoveryStatus.FAILED
        },
        RecoveryStatus.GENERATING: {
            RecoveryStatus.GENERATING,
            RecoveryStatus.VALIDATING,
            RecoveryStatus.FAILED
        },
        RecoveryStatus.VALIDATING: {
            RecoveryStatus.VALIDATING,
            RecoveryStatus.RANKED,
            RecoveryStatus.FAILED
        },
        RecoveryStatus.RANKED: {
            RecoveryStatus.RANKED,
            RecoveryStatus.PRESENTED,
            RecoveryStatus.FAILED
        },
        RecoveryStatus.PRESENTED: {
            RecoveryStatus.PRESENTED,
            RecoveryStatus.ACCEPTED,
            RecoveryStatus.FAILED
        },
        RecoveryStatus.ACCEPTED: {
            RecoveryStatus.ACCEPTED,
            RecoveryStatus.EXECUTING,
            RecoveryStatus.FAILED
        },
        RecoveryStatus.EXECUTING: {
            RecoveryStatus.EXECUTING,
            RecoveryStatus.COMPLETED,
            RecoveryStatus.FAILED
        },
        RecoveryStatus.FAILED: {
            RecoveryStatus.FAILED,
            RecoveryStatus.ROLLED_BACK
        },
        RecoveryStatus.COMPLETED: {
            RecoveryStatus.COMPLETED
        },
        RecoveryStatus.ROLLED_BACK: {
            RecoveryStatus.ROLLED_BACK
        }
    }

    def __init__(self, recovery_id: str, initial_status: RecoveryStatus = RecoveryStatus.CREATED):
        self.recovery_id = recovery_id
        self.current_status = initial_status
        self.history = [initial_status]

    def transition_to(self, new_status: RecoveryStatus) -> RecoveryStatus:
        if new_status not in self.VALID_TRANSITIONS.get(self.current_status, set()):
            raise InvalidRecoveryStateTransitionError(
                self.current_status.value,
                new_status.value,
                self.recovery_id
            )
        self.current_status = new_status
        self.history.append(new_status)
        return self.current_status
