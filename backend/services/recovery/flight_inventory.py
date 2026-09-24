"""
Simulated 2026 route-specific flight inventory.

This is NOT live airline availability. Rows are demo schedules seeded from
real nonstop route/airline relationships (which carriers actually serve a
city pair), with simulated flight numbers (SIM- prefix).

Never generate a candidate from a provider list alone.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, time
from typing import Any, Dict, List, Optional, Sequence

from .airports import (
    airport_label,
    resolve_airport_code,
    resolve_disrupted_route,
    same_airport,
)
from .providers.base import is_candidate_unavailable


def _row(
    provider: str,
    flight_number: str,
    origin: str,
    destination: str,
    dep: str,
    arr: str,
    price: int,
    *,
    booking_id: Optional[str] = None,
    resource_id: Optional[str] = None,
    available: bool = True,
    is_direct: bool = True,
    quality_tier: str = "RECOMMENDED",
    modification_fee: int = 200,
    cancellation_penalty: int = 0,
    estimated_refund: int = 3500,
) -> Dict[str, Any]:
    return {
        "provider": provider,
        "flight_number": flight_number,
        "origin": origin,
        "destination": destination,
        "dep": dep,
        "arr": arr,
        "price": price,
        "booking_id": booking_id or flight_number,
        "resource_id": resource_id or flight_number,
        "available": available,
        "is_direct": is_direct,
        "quality_tier": quality_tier,
        "modification_fee": modification_fee,
        "cancellation_penalty": cancellation_penalty,
        "estimated_refund": estimated_refund,
        "simulated": True,
        "availability_source": "simulated",
    }


# ---------------------------------------------------------------------------
# Route evidence (nonstop, demo 2026):
#   BOM→ATQ  Air India, IndiGo
#   BOM→IXC  Air India, IndiGo
#   BOM→DEL  Air India, Air India Express, IndiGo, Akasa Air, SpiceJet
#   DEL→JAI  Air India, IndiGo
# Do not add a carrier to a route just because it exists elsewhere.
# Connections (BOM→DEL→ATQ) are intentionally omitted — not modeled.
# ---------------------------------------------------------------------------
FLIGHT_INVENTORY: List[Dict[str, Any]] = [
    # BOM → ATQ (Amritsar) — Air India + IndiGo only
    _row("IndiGo", "SIM-6E-2141", "BOM", "ATQ", "06:20", "08:45", 6120, quality_tier="RECOMMENDED"),
    _row("Air India", "SIM-AI-471", "BOM", "ATQ", "08:05", "10:30", 7480, quality_tier="PREMIUM", modification_fee=0),
    _row("IndiGo", "SIM-6E-2147", "BOM", "ATQ", "11:35", "14:00", 5890, quality_tier="RECOMMENDED"),
    _row("Air India", "SIM-AI-475", "BOM", "ATQ", "15:10", "17:35", 7210, quality_tier="PREMIUM", modification_fee=0),
    _row("IndiGo", "SIM-6E-2159", "BOM", "ATQ", "18:40", "21:05", 5450, quality_tier="BUDGET"),
    # BOM → IXC (Chandigarh) — Air India + IndiGo only
    _row("IndiGo", "SIM-6E-2041", "BOM", "IXC", "06:40", "09:05", 5980),
    _row("Air India", "SIM-AI-887", "BOM", "IXC", "09:20", "11:45", 7340, quality_tier="PREMIUM", modification_fee=0),
    _row("IndiGo", "SIM-6E-2049", "BOM", "IXC", "13:15", "15:40", 5650),
    _row("Air India", "SIM-AI-889", "BOM", "IXC", "17:00", "19:25", 7100, quality_tier="PREMIUM", modification_fee=0),
    # BOM → DEL — carriers that actually operate this trunk
    _row("Air India Express", "SIM-IX-201", "BOM", "DEL", "07:15", "09:30", 4800, booking_id="AIX-RPL-201", resource_id="AIX-201"),
    _row("Akasa Air", "SIM-QP-402", "BOM", "DEL", "08:40", "10:55", 4200, booking_id="QP-RPL-402", resource_id="QP-402"),
    _row("SpiceJet", "SIM-SG-803", "BOM", "DEL", "10:20", "12:35", 3900, booking_id="SG-RPL-803", resource_id="SG-803", quality_tier="BUDGET"),
    _row("IndiGo", "SIM-6E-504", "BOM", "DEL", "12:10", "14:25", 4600, booking_id="6E-RPL-504", resource_id="6E-504"),
    _row("Air India", "SIM-AI-605", "BOM", "DEL", "14:45", "17:00", 5500, booking_id="AI-RPL-605", resource_id="AI-605", quality_tier="PREMIUM", modification_fee=0),
    _row("IndiGo", "SIM-6E-612", "BOM", "DEL", "16:30", "18:45", 4450, booking_id="6E-RPL-612", resource_id="6E-612"),
    # DEL -> LHR
    _row("British Airways", "SIM-BA-143", "DEL", "LHR", "10:00", "14:30", 45000, quality_tier="RECOMMENDED"),
    _row("Air India", "SIM-AI-111", "DEL", "LHR", "14:00", "18:30", 42000, quality_tier="PREMIUM"),
    # LHR -> BOM
    _row("Virgin Atlantic", "SIM-VS-354", "LHR", "BOM", "09:00", "23:00", 48000, quality_tier="PREMIUM"),
    _row("British Airways", "SIM-BA-199", "LHR", "BOM", "21:00", "11:00", 51000, quality_tier="RECOMMENDED"),
    # DEL → JAI (cross-modal train recovery still needs a real city pair)
    _row("IndiGo", "SIM-6E-2181", "DEL", "JAI", "08:00", "09:15", 4200),
    _row("Air India", "SIM-AI-611", "DEL", "JAI", "11:30", "12:50", 5100, quality_tier="PREMIUM", modification_fee=0),
    # BOM → JAI (Jaipur) — nonstop service by IndiGo, Air India, Air India Express, SpiceJet
    _row("IndiGo", "SIM-6E-821", "BOM", "JAI", "06:10", "08:00", 5200, quality_tier="RECOMMENDED"),
    _row("Air India", "SIM-AI-441", "BOM", "JAI", "08:45", "10:35", 6800, quality_tier="PREMIUM", modification_fee=0),
    _row("Air India Express", "SIM-IX-531", "BOM", "JAI", "11:20", "13:10", 4900, booking_id="AIX-RPL-531", resource_id="AIX-531"),
    _row("SpiceJet", "SIM-SG-601", "BOM", "JAI", "14:30", "16:20", 4300, booking_id="SG-RPL-601", resource_id="SG-601", quality_tier="BUDGET"),
    _row("IndiGo", "SIM-6E-829", "BOM", "JAI", "17:05", "18:55", 5100, quality_tier="RECOMMENDED"),
    # JAI → BOM (return leg)
    _row("IndiGo", "SIM-6E-830", "JAI", "BOM", "07:00", "08:50", 5200, quality_tier="RECOMMENDED"),
    _row("Air India", "SIM-AI-442", "JAI", "BOM", "10:30", "12:20", 6800, quality_tier="PREMIUM", modification_fee=0),
    # Long-haul sample-trip pairs
    _row("Air India", "SIM-AI-111", "BOM", "LHR", "02:15", "07:45", 42000, quality_tier="PREMIUM", modification_fee=1500),
    _row("British Airways", "SIM-BA-198", "DEL", "LHR", "13:20", "18:10", 45500, quality_tier="PREMIUM", modification_fee=3500),
    _row("Virgin Atlantic", "SIM-VS-355", "LHR", "BOM", "21:00", "11:30", 40000, quality_tier="PREMIUM", modification_fee=3000),
]


def _parse_hhmm(value: str) -> time:
    parts = value.split(":")
    return time(int(parts[0]), int(parts[1]))


def _combine(travel_date: date, hhmm: str, *, after: Optional[datetime] = None) -> datetime:
    dt = datetime.combine(travel_date, _parse_hhmm(hhmm))
    if after is not None and dt < after:
        # Overnight arrival (e.g. LHR evening → BOM next calendar morning)
        dt = dt + timedelta(days=1)
    return dt


def _travel_date_from_node(node: Dict[str, Any]) -> date:
    raw = node.get("start_time") or node.get("startTime") or node.get("startDate")
    if raw:
        try:
            if isinstance(raw, datetime):
                return raw.date()
            return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).date()
        except Exception:
            pass
    return date(2026, 9, 21)


def _normalize_flight_number(value: Optional[str]) -> str:
    return "".join(ch for ch in str(value or "").upper() if ch.isalnum())


def _is_same_resource(row: Dict[str, Any], node: Dict[str, Any]) -> bool:
    """Exclude the disrupted flight itself; do not blacklist the airline."""
    node_ids = [
        node.get("booking_id"),
        node.get("flight_number"),
        node.get("resource_id"),
        (node.get("item_metadata") or {}).get("flight_number") if isinstance(node.get("item_metadata"), dict) else None,
    ]
    row_ids = [row.get("booking_id"), row.get("flight_number"), row.get("resource_id")]
    node_norm = {_normalize_flight_number(x) for x in node_ids if x}
    row_norm = {_normalize_flight_number(x) for x in row_ids if x}
    node_norm.discard("")
    row_norm.discard("")
    return bool(node_norm & row_norm)


def materialize_row(
    row: Dict[str, Any],
    travel_date: date,
    node: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    dep_dt = _combine(travel_date, row["dep"])
    arr_dt = _combine(travel_date, row["arr"], after=dep_dt)
    duration = int((arr_dt - dep_dt).total_seconds() // 60)
    origin = row["origin"]
    dest = row["destination"]
    title_base = node.get("title") if node else "Flight"
    flight_no = row["flight_number"]
    provider = row["provider"]
    return {
        "candidate_id": f"cand_fl_{origin}_{dest}_{flight_no}",
        "type": "FLIGHT",
        "provider": provider,
        "flight_number": flight_no,
        "title": f"{provider} {flight_no}",
        "origin": airport_label(origin),
        "destination": airport_label(dest),
        "origin_airport": origin,
        "destination_airport": dest,
        "departure_time": dep_dt.isoformat(),
        "arrival_time": arr_dt.isoformat(),
        "start_time": dep_dt.isoformat(),
        "end_time": arr_dt.isoformat(),
        "travel_date": travel_date.isoformat(),
        "duration": duration,
        "duration_minutes": duration,
        "price": row["price"],
        "cost": row["price"],
        "currency": "INR",
        "resource_id": row.get("resource_id") or flight_no,
        "booking_id": row.get("booking_id") or flight_no,
        "availability": "SIMULATED" if row.get("available", True) else "UNAVAILABLE",
        "available": bool(row.get("available", True)),
        "simulated": True,
        "availability_source": "simulated",
        "is_direct": bool(row.get("is_direct", True)),
        "startDate": dep_dt.strftime("%Y-%m-%d"),
        "endDate": arr_dt.strftime("%Y-%m-%d"),
        "timeStatus": "FIXED",
        "isTimeFlexible": False,
        "modification_fee": row.get("modification_fee", 200),
        "cancellation_penalty": row.get("cancellation_penalty", 0),
        "estimated_refund": row.get("estimated_refund", 3500),
        "quality_tier": row.get("quality_tier", "RECOMMENDED"),
        "explanation": (
            f"Simulated nonstop {origin}→{dest} on {travel_date.isoformat()}: "
            f"{provider} {flight_no} dep {row['dep']} arr {row['arr']}. "
            f"Not live airline inventory."
        ),
        "original_title_ref": title_base,
    }


def search_route_inventory(
    origin: str,
    destination: str,
    travel_date: date,
    *,
    inventory: Optional[Sequence[Dict[str, Any]]] = None,
    time_window: Optional[tuple] = None,
    journey_nodes: Optional[List[Dict[str, Any]]] = None,
    disrupted_node: Optional[Dict[str, Any]] = None,
    known_unavailable: Optional[List[Any]] = None,
    require_direct: bool = True,
) -> List[Dict[str, Any]]:
    """
    Filter simulated inventory to a single origin/destination/date.

    time_window is reserved for future MCT/connection modeling; this prototype
    only returns nonstop rows.
    """
    origin_code = resolve_airport_code(origin, journey_nodes, role="origin")
    dest_code = resolve_airport_code(destination, journey_nodes, role="destination")
    if not origin_code or not dest_code:
        return []

    rows = list(inventory) if inventory is not None else FLIGHT_INVENTORY
    matched: List[Dict[str, Any]] = []
    for row in rows:
        if require_direct and not row.get("is_direct", True):
            continue
        if not same_airport(row.get("origin"), origin_code):
            continue
        if not same_airport(row.get("destination"), dest_code):
            continue
        if row.get("available") is False:
            continue
        # Demo inventory operates daily in 2026 unless a row sets operates_on.
        operates_on = row.get("operates_on")
        if operates_on:
            allowed_dates = {str(d) for d in operates_on}
            if travel_date.isoformat() not in allowed_dates:
                continue
        if disrupted_node and _is_same_resource(row, disrupted_node):
            continue
        materialized = materialize_row(row, travel_date, disrupted_node)
        if is_candidate_unavailable(materialized, known_unavailable):
            continue
        if time_window:
            start, end = time_window
            dep = datetime.fromisoformat(materialized["departure_time"])
            if start and dep < start:
                continue
            if end and dep > end:
                continue
        matched.append(materialized)
    return matched
