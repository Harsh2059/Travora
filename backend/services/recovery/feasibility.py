"""
Route, schedule, and downstream-journey feasibility for recovery candidates.

Filter order (never rank first):
  raw simulated inventory
  → origin / destination
  → date
  → time feasibility
  → known_unavailable
  → downstream journey feasibility
  → minimal-impact
  → ranking
  → top N user-facing options
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from .airports import resolve_disrupted_route, same_airport

MAX_VISIBLE_RECOVERY_OPTIONS = 3

# Minutes after arrival required before a downstream booking can still be kept.
DOWNSTREAM_BUFFERS_MIN = {
    "CAB": 20,
    "TAXI": 20,
    "TRANSFER": 25,
    "METRO": 15,
    "TRAIN": 25,
    "HOTEL": 20,
    "ACTIVITY": 30,
    "EVENT": 45,
    "FLIGHT": 90,
}

TYPE_LABELS = {
    "FLIGHT": "Flight",
    "CAB": "Cab",
    "TAXI": "Cab",
    "TRANSFER": "Cab",
    "METRO": "Metro",
    "TRAIN": "Train",
    "HOTEL": "Hotel",
    "ACTIVITY": "Activity",
    "EVENT": "Activity",
}


def parse_dt(raw: Any) -> Optional[datetime]:
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw.replace(tzinfo=None) if raw.tzinfo else raw
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None


def node_start(node: Dict[str, Any]) -> Optional[datetime]:
    return parse_dt(node.get("start_time") or node.get("startTime") or node.get("departure_time"))


def node_end(node: Dict[str, Any]) -> Optional[datetime]:
    return parse_dt(node.get("end_time") or node.get("endTime") or node.get("arrival_time"))


def candidate_arrival(candidate: Dict[str, Any]) -> Optional[datetime]:
    return parse_dt(
        candidate.get("arrival_time")
        or candidate.get("end_time")
        or candidate.get("endTime")
    )


def candidate_departure(candidate: Dict[str, Any]) -> Optional[datetime]:
    return parse_dt(
        candidate.get("departure_time")
        or candidate.get("start_time")
        or candidate.get("startTime")
    )


def type_label(node: Dict[str, Any]) -> str:
    t = str(node.get("type") or "").upper()
    return TYPE_LABELS.get(t, (node.get("title") or t or "Booking").title())


def candidate_matches_required_route(
    candidate: Dict[str, Any],
    origin_code: Optional[str],
    dest_code: Optional[str],
) -> bool:
    if not origin_code or not dest_code:
        return False
    cand_origin = (
        candidate.get("origin_airport")
        or candidate.get("origin")
    )
    cand_dest = (
        candidate.get("destination_airport")
        or candidate.get("destination")
    )
    return same_airport(cand_origin, origin_code) and same_airport(cand_dest, dest_code)


def required_fields_present(candidate: Dict[str, Any]) -> bool:
    required = (
        "provider",
        "flight_number",
        "origin_airport",
        "destination_airport",
        "departure_time",
        "arrival_time",
        "travel_date",
        "duration",
        "price",
        "resource_id",
        "availability",
    )
    return all(candidate.get(k) not in (None, "") for k in required)


def _flexibility(node: Dict[str, Any]) -> str:
    return str(node.get("flexibility") or node.get("timeStatus") or "FLEXIBLE").upper()


def assess_downstream_feasibility(
    candidate: Dict[str, Any],
    disrupted_node: Dict[str, Any],
    journey_nodes: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[bool, List[str], List[str], Optional[str]]:
    """
    A candidate is invalid if keeping any later booking would be impossible.

    Returns (ok, would_change_labels, would_keep_labels, reject_reason).
    """
    nodes = [n for n in (journey_nodes or []) if isinstance(n, dict)]
    disrupted_id = str(disrupted_node.get("id") or "")
    arr = candidate_arrival(candidate)
    orig_end = node_end(disrupted_node) or node_start(disrupted_node)

    would_change = [type_label(disrupted_node)]
    would_keep: List[str] = []

    for node in nodes:
        if str(node.get("id") or "") == disrupted_id:
            continue
        label = type_label(node)
        n_start = node_start(node)
        n_end = node_end(node)
        n_type = str(node.get("type") or "").upper()

        # Upstream of the disrupted flight — not gated by the replacement arrival.
        if orig_end and n_end and n_end <= orig_end:
            would_keep.append(label)
            continue
        if orig_end and n_start and n_start < orig_end and n_type not in ("HOTEL", "ACTIVITY", "EVENT"):
            would_keep.append(label)
            continue

        if arr is None or n_start is None:
            would_keep.append(label)
            continue

        buffer = DOWNSTREAM_BUFFERS_MIN.get(n_type, 20)
        ready_at = arr + timedelta(minutes=buffer)

        flex = _flexibility(node)

        if n_type in ("HOTEL",):
            # Overnight stay: late check-in is allowed unless the hotel is FIXED
            # and the traveler would arrive after checkout.
            if n_end and arr >= n_end:
                return False, would_change, would_keep, (
                    f"Arrives {arr.isoformat()} after hotel checkout {n_end.isoformat()}"
                )
            if flex in ("FIXED", "STRICT") and ready_at > n_start:
                return False, would_change, would_keep, (
                    f"Arrives too late for fixed hotel check-in at {n_start.isoformat()}"
                )
            would_keep.append(label)
            continue

        if n_type in ("ACTIVITY", "EVENT") or flex in ("FIXED", "STRICT"):
            if ready_at > n_start:
                return False, would_change, would_keep, (
                    f"Arrives {arr.isoformat()} too late for {label} at {n_start.isoformat()}"
                )
            would_keep.append(label)
            continue

        # Cab / metro / transfer timed off the original landing: must still be
        # reachable if we KEEP the original booking time.
        if n_type in ("CAB", "TAXI", "TRANSFER", "METRO", "TRAIN", "FLIGHT"):
            n_status = str(node.get("status") or "").upper()
            if n_status in ("BROKEN", "NEEDS_CHANGE", "CANCELLED", "REPLACED"):
                if label not in would_change:
                    would_change.append(label)
                continue

            if ready_at > n_start:
                return False, would_change, would_keep, (
                    f"Arrives {arr.isoformat()} too late to keep {label} at {n_start.isoformat()}"
                )

        would_keep.append(label)

    return True, would_change, would_keep, None


def filter_flight_candidates(
    candidates: List[Dict[str, Any]],
    disrupted_node: Dict[str, Any],
    journey_nodes: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    origin, dest = resolve_disrupted_route(disrupted_node, journey_nodes)
    kept: List[Dict[str, Any]] = []
    for cand in candidates:
        if str(cand.get("type") or "FLIGHT").upper() != "FLIGHT":
            kept.append(cand)
            continue
        if not required_fields_present(cand):
            continue
        if not candidate_matches_required_route(cand, origin, dest):
            continue
        if cand.get("available") is False:
            continue
        if cand.get("is_direct") is False:
            # Prototype does not model connections.
            continue
        ok, would_change, would_keep, _reason = assess_downstream_feasibility(
            cand, disrupted_node, journey_nodes
        )
        if not ok:
            continue
        enriched = dict(cand)
        enriched["would_change"] = would_change
        enriched["would_keep"] = would_keep
        kept.append(enriched)
    return kept


def rank_flight_candidates(candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    def sort_key(c: Dict[str, Any]):
        arr = candidate_arrival(c) or datetime.max
        cost = c.get("cost") if c.get("cost") is not None else c.get("price") or 0
        duration = c.get("duration_minutes") or c.get("duration") or 0
        transfers = 0 if c.get("is_direct", True) else 1
        return (transfers, arr, float(cost), int(duration))

    ranked = sorted(candidates, key=sort_key)
    seen = set()
    distinct: List[Dict[str, Any]] = []
    for c in ranked:
        key = (
            c.get("flight_number"),
            c.get("origin_airport"),
            c.get("destination_airport"),
            c.get("departure_time"),
        )
        if key in seen:
            continue
        seen.add(key)
        distinct.append(c)
    return distinct
