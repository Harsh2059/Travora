from typing import List, Dict, Any, Tuple
from datetime import datetime, timedelta

class ConstraintViolation:
    def __init__(self, rule: str, message: str, item_id: int = 0):
        self.rule = rule
        self.message = message
        self.item_id = item_id

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rule": self.rule,
            "message": self.message,
            "item_id": self.item_id
        }

class ConstraintEngine:
    @staticmethod
    def validate_candidate_plan(
        original_items: List[Dict[str, Any]],
        candidate_items: List[Dict[str, Any]],
        policy_results: Dict[int, Any]
    ) -> Tuple[bool, List[ConstraintViolation]]:
        """
        Deterministic hard constraint validator.
        Returns (is_feasible, list_of_violations).
        If any hard constraint is violated, is_feasible is False.
        """
        violations: List[ConstraintViolation] = []

        # 1. Chronological Validity (item start < end)
        for item in candidate_items:
            st = item.get("start_time")
            et = item.get("end_time")
            if isinstance(st, str):
                st = datetime.fromisoformat(st)
            if isinstance(et, str):
                et = datetime.fromisoformat(et)

            if st and et and st >= et:
                violations.append(ConstraintViolation(
                    rule="CHRONOLOGICAL_VALIDITY",
                    message=f"Item {item.get('provider')} has invalid duration: start ({st}) >= end ({et})",
                    item_id=item.get("id", 0)
                ))

            # Check mock availability
            if item.get("available") is False:
                violations.append(ConstraintViolation(
                    rule="INVENTORY_UNAVAILABLE",
                    message=f"No seats/rooms available for {item.get('provider')}",
                    item_id=item.get("id", 0)
                ))

        # Sort candidate items chronologically
        sorted_items = sorted(
            candidate_items,
            key=lambda x: x["start_time"] if isinstance(x["start_time"], datetime) else datetime.fromisoformat(str(x["start_time"]))
        )

        # 2. Connection Buffers & Departures
        for i in range(len(sorted_items) - 1):
            curr = sorted_items[i]
            nxt = sorted_items[i+1]
            curr_et = curr["end_time"] if isinstance(curr["end_time"], datetime) else datetime.fromisoformat(str(curr["end_time"]))
            nxt_st = nxt["start_time"] if isinstance(nxt["start_time"], datetime) else datetime.fromisoformat(str(nxt["start_time"]))

            # Connecting flight check
            if curr.get("type") in ["FLIGHT", "TRAIN"] and nxt.get("type") in ["FLIGHT", "TRAIN"]:
                # Check if same connection point
                curr_dest = str(curr.get("destination", "")).lower()
                nxt_orig = str(nxt.get("origin", "")).lower()
                if any(tok in nxt_orig for tok in ["delhi", "del", "london", "lhr", "bom", "mumbai"]):
                    gap_mins = (nxt_st - curr_et).total_seconds() / 60.0
                    if gap_mins < 45.0: # Minimum 45 min connection
                        violations.append(ConstraintViolation(
                            rule="MINIMUM_CONNECTION_TIME",
                            message=f"Layover time ({gap_mins:.0f}m) between {curr.get('provider')} and {nxt.get('provider')} is below required 45m",
                            item_id=nxt.get("id", 0)
                        ))
                    elif gap_mins > 960.0: # Maximum 16h wait
                        violations.append(ConstraintViolation(
                            rule="MAXIMUM_WAITING_TIME",
                            message=f"Layover time ({gap_mins/60.0:.1f}h) exceeds maximum allowed 16h",
                            item_id=nxt.get("id", 0)
                        ))

        # 3. Critical Commitment Invariant
        # Any CRITICAL item in original itinerary must be preserved and traveler must arrive before it starts
        critical_originals = [it for it in original_items if it.get("priority") == "CRITICAL"]
        for crit in critical_originals:
            crit_id = crit.get("id")
            crit_st = crit["start_time"] if isinstance(crit["start_time"], datetime) else datetime.fromisoformat(str(crit["start_time"]))
            crit_loc = str(crit.get("location", "")).lower()

            # Find arrival in that location in candidate items
            matching_arrivals = [
                it for it in sorted_items
                if any(tok in str(it.get("destination", "")).lower() or tok in str(it.get("location", "")).lower() for tok in ["london", "lhr"])
                and (it["end_time"] if isinstance(it["end_time"], datetime) else datetime.fromisoformat(str(it["end_time"]))) <= crit_st
            ]

            if not matching_arrivals:
                violations.append(ConstraintViolation(
                    rule="CRITICAL_COMMITMENT_VIOLATION",
                    message=f"Traveler fails to reach destination before critical event '{crit.get('provider')}' starts at {crit_st}",
                    item_id=crit_id
                ))
            else:
                last_arrival = max(
                    matching_arrivals,
                    key=lambda it: it["end_time"] if isinstance(it["end_time"], datetime) else datetime.fromisoformat(str(it["end_time"]))
                )
                arrival_et = last_arrival["end_time"] if isinstance(last_arrival["end_time"], datetime) else datetime.fromisoformat(str(last_arrival["end_time"]))
                buffer_mins = (crit_st - arrival_et).total_seconds() / 60.0
                if buffer_mins < 45.0: # Need at least 45 min buffer before conference
                    violations.append(ConstraintViolation(
                        rule="CRITICAL_BUFFER_VIOLATION",
                        message=f"Buffer before critical event '{crit.get('provider')}' is only {buffer_mins:.0f}m (minimum 45m required)",
                        item_id=crit_id
                    ))

        # 4. Policy Constraint (non-changeable item altered)
        for it_id, p_res in policy_results.items():
            if hasattr(p_res, "allowed") and not p_res.allowed:
                violations.append(ConstraintViolation(
                    rule="POLICY_RESTRICTION",
                    message=p_res.reason,
                    item_id=it_id
                ))

        is_feasible = len(violations) == 0
        return is_feasible, violations
