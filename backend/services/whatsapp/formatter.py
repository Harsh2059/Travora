"""
WhatsApp message formatting module.
Provides mode-aware recovery options, disruption alerts, and confirmation messages.
"""

import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple


_KEYCAPS = {
    1: "1️⃣", 2: "2️⃣", 3: "3️⃣", 4: "4️⃣", 5: "5️⃣",
    6: "6️⃣", 7: "7️⃣", 8: "8️⃣", 9: "9️⃣", 10: "🔟"
}


def _get_keycap(num: int) -> str:
    return _KEYCAPS.get(num, f"{num}️⃣")


def _same_endpoint(a: Optional[str], b: Optional[str]) -> bool:
    """Check if two location/airport/station endpoints refer to the same place."""
    if not a or not b:
        return False
    sa = str(a).strip().lower()
    sb = str(b).strip().lower()
    if sa == sb:
        return True

    base_a = sa.split("(")[0].strip()
    base_b = sb.split("(")[0].strip()
    if base_a and base_b and base_a == base_b:
        return True

    pa = re.search(r"\(([A-Za-z0-9]{3,4})\)", sa)
    pb = re.search(r"\(([A-Za-z0-9]{3,4})\)", sb)
    ca = pa.group(1).upper() if pa else (sa.upper() if len(sa) in (3, 4) else None)
    cb = pb.group(1).upper() if pb else (sb.upper() if len(sb) in (3, 4) else None)
    if ca and cb and ca == cb:
        return True
    if ca and ca.lower() in sb:
        return True
    if cb and cb.lower() in sa:
        return True
    return False


def _adapt_plan(plan: Dict[str, Any]) -> Dict[str, Any]:
    """
    Adapter to normalize RecoveryPlanModel output (which uses added_items)
    into the format expected by the WhatsApp formatter (changes -> new_details).
    """
    if "changes" in plan or "added_items" not in plan:
        return plan

    adapted = plan.copy()
    changes = []
    removed = adapted.get("removed_items") or []
    orig_item = removed[0] if (removed and isinstance(removed[0], dict)) else {}

    for item in adapted.get("added_items") or []:
        start = item.get("start_time") or item.get("departure_time")
        end = item.get("end_time") or item.get("arrival_time")

        dur = item.get("duration")
        if not dur and start and end:
            try:
                from datetime import datetime
                s = datetime.fromisoformat(str(start).replace("Z", "+00:00")) if isinstance(start, str) else start
                e = datetime.fromisoformat(str(end).replace("Z", "+00:00")) if isinstance(end, str) else end
                mins = int((e - s).total_seconds() / 60)
                dur = f"{mins // 60}h {mins % 60}m"
            except Exception:
                pass

        item_orig = item.get("origin") or orig_item.get("origin")
        item_dest = item.get("destination") or orig_item.get("destination")
        if item_orig and item_dest and _same_endpoint(item_orig, item_dest):
            if orig_item.get("destination") and not _same_endpoint(item_orig, orig_item.get("destination")):
                item_dest = orig_item.get("destination")

        new_details = {
            "type": str(item.get("type", "FLIGHT")).upper(),
            "provider": item.get("provider") or item.get("airline"),
            "airline": item.get("airline") or item.get("provider"),
            "flight_number": item.get("flight_number"),
            "train_number": item.get("train_number"),
            "booking_id": item.get("booking_id"),
            "origin": item_orig,
            "destination": item_dest,
            "departure_time": start,
            "arrival_time": end,
            "duration": dur,
            "fare": item.get("cost") or item.get("price"),
            "currency": item.get("currency", "INR"),
            "is_direct": item.get("is_direct"),
            "hotel_name": item.get("hotel_name") or item.get("provider"),
            "room_type": item.get("room_type"),
            "check_in": item.get("check_in"),
            "check_out": item.get("check_out"),
            "vehicle_type": item.get("vehicle_type"),
        }

        # Remove empty keys so we don't accidentally print None or override
        new_details = {k: v for k, v in new_details.items() if v is not None}

        changes.append({
            "type": new_details.get("type"),
            "action": "REPLACE",
            "new_details": new_details,
            "original_details": orig_item,
            "origin": new_details.get("origin"),
            "destination": new_details.get("destination"),
        })

    adapted["changes"] = changes
    return adapted


def _classify_mode(mode: Optional[str]) -> str:
    m = (mode or "").strip().upper()
    if not m:
        return "UNKNOWN"
    if "FLIGHT" in m or "AIR" in m or "AVIA" in m:
        return "FLIGHT"
    if "HOTEL" in m or "STAY" in m or "ACCOMMODATION" in m or "RESORT" in m:
        return "HOTEL"
    if "CAB" in m or "TAXI" in m or "TRANSFER" in m or "CAR" in m:
        return "CAB"
    if "TRAIN" in m or "RAIL" in m or "METRO" in m:
        return "TRAIN"
    if "BUS" in m:
        return "BUS"
    return "UNKNOWN"


def _mode_icon(mode: Optional[str]) -> str:
    m = _classify_mode(mode)
    if m == "FLIGHT":
        return "✈️"
    if m == "TRAIN":
        return "🚆"
    if m == "CAB":
        return "🚕"
    if m == "HOTEL":
        return "🏨"
    if m == "BUS":
        return "🚌"
    return "🔄"


def _clean_str(val: Any) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() in ("none", "null", "undefined", "n/a"):
        return None
    return s


def _format_time_hhmm(val: Any) -> Optional[str]:
    if not val:
        return None
    s = str(val).strip()
    if s.lower() in ("none", "null", "undefined", "n/a", ""):
        return None
    if "T" in s:
        try:
            return s.split("T")[1][:5]
        except Exception:
            pass
    if " " in s and ":" in s:
        try:
            for part in s.split(" "):
                if ":" in part and len(part) >= 5:
                    return part[:5]
        except Exception:
            pass
    if len(s) == 5 and s[2] == ":":
        return s
    return s


def _format_date(val: Any) -> Optional[str]:
    if not val:
        return None
    s = str(val).strip()
    if s.lower() in ("none", "null", "undefined", "n/a", ""):
        return None
    if "T" in s:
        s = s.split("T")[0]
    elif " " in s:
        s = s.split(" ")[0]
    return s if len(s) >= 8 else None


def _calc_nights(check_in: Optional[str], check_out: Optional[str]) -> Optional[int]:
    if not check_in or not check_out:
        return None
    try:
        d1 = datetime.strptime(str(check_in)[:10], "%Y-%m-%d").date()
        d2 = datetime.strptime(str(check_out)[:10], "%Y-%m-%d").date()
        diff = (d2 - d1).days
        return diff if diff > 0 else None
    except Exception:
        return None


def _format_duration(val: Any) -> Optional[str]:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        mins = int(val)
        if mins <= 0:
            return None
        h = mins // 60
        m = mins % 60
        if h > 0 and m > 0:
            return f"{h}h {m}m"
        elif h > 0:
            return f"{h}h"
        return f"{m}m"
    s = str(val).strip()
    if not s or s.lower() in ("none", "null", "undefined", "n/a"):
        return None
    if s.isdigit():
        mins = int(s)
        h = mins // 60
        m = mins % 60
        if h > 0 and m > 0:
            return f"{h}h {m}m"
        elif h > 0:
            return f"{h}h"
        return f"{m}m"
    return s


def _format_cost(cost: Any, currency: str = "INR") -> Optional[str]:
    if cost is None or cost == "" or str(cost).lower() in ("none", "null", "undefined", "n/a"):
        return None
    try:
        val = float(cost)
        if val < 0:
            return None
        symbol = "₹" if currency == "INR" else f"{currency} "
        if val == 0:
            return f"{symbol}0"
        if val.is_integer():
            return f"{symbol}{int(val):,}"
        return f"{symbol}{val:,.2f}"
    except (ValueError, TypeError):
        return None


def _get_plan_cost_string(
    plan: Dict[str, Any],
    change: Dict[str, Any],
    new_details: Dict[str, Any],
) -> Optional[str]:
    cost = plan.get("estimated_additional_cost")
    if cost is None:
        cost = (plan.get("cost_estimate") or {}).get("estimated_additional_cost")
    if cost is None:
        cost = (
            change.get("estimated_cost")
            or new_details.get("cost")
            or new_details.get("price")
            or new_details.get("fare")
        )
    currency = (plan.get("cost_estimate") or {}).get("currency") or new_details.get("currency") or "INR"
    return _format_cost(cost, currency)


def _resolve_option_route(
    new_details: Dict[str, Any],
    change: Dict[str, Any],
    orig_item: Optional[Dict[str, Any]],
) -> Tuple[Optional[str], Optional[str]]:
    orig_item = orig_item or {}
    orig_details = change.get("original_details") or {}

    auth_orig = _clean_str(
        orig_item.get("origin")
        or orig_details.get("origin")
    )
    auth_dest = _clean_str(
        orig_item.get("destination")
        or orig_details.get("destination")
    )
    if _same_endpoint(auth_orig, auth_dest):
        loc = _clean_str(orig_item.get("location") or orig_details.get("location"))
        if loc and not _same_endpoint(auth_orig, loc):
            auth_dest = loc
        else:
            auth_dest = None

    cand_orig = _clean_str(new_details.get("origin") or change.get("origin"))
    cand_dest = _clean_str(new_details.get("destination") or change.get("destination"))

    is_cand_valid = (
        cand_orig is not None
        and cand_dest is not None
        and not _same_endpoint(cand_orig, cand_dest)
    )

    if is_cand_valid:
        return cand_orig, cand_dest

    resolved_orig = cand_orig
    resolved_dest = cand_dest

    if not resolved_orig or _same_endpoint(resolved_orig, resolved_dest):
        if auth_orig:
            resolved_orig = auth_orig

    if not resolved_dest or _same_endpoint(resolved_orig, resolved_dest):
        if auth_dest and not _same_endpoint(resolved_orig, auth_dest):
            resolved_dest = auth_dest

    if _same_endpoint(resolved_orig, resolved_dest):
        if auth_dest and not _same_endpoint(resolved_orig, auth_dest):
            resolved_dest = auth_dest
        else:
            resolved_dest = None

    return resolved_orig, resolved_dest


def _get_numeric_cost(plan: Dict[str, Any], change: Dict[str, Any], new_details: Dict[str, Any]) -> Optional[float]:
    raw = (
        new_details.get("fare")
        or new_details.get("price")
        or new_details.get("cost")
        or change.get("estimated_cost")
        or plan.get("estimated_additional_cost")
    )
    if raw is None:
        raw = (plan.get("cost_estimate") or {}).get("estimated_additional_cost")
    if raw is not None:
        try:
            return float(raw)
        except (ValueError, TypeError):
            return None
    return None


def _get_numeric_duration(new_details: Dict[str, Any], change: Dict[str, Any]) -> Optional[int]:
    raw = (
        new_details.get("duration_minutes")
        or new_details.get("duration")
        or change.get("duration")
    )
    if isinstance(raw, (int, float)):
        return int(raw)
    if isinstance(raw, str):
        s = raw.strip()
        if s.isdigit():
            return int(s)
        if "h" in s or "m" in s:
            try:
                mins = 0
                parts = s.split()
                for p in parts:
                    if p.endswith("h"):
                        mins += int(p[:-1]) * 60
                    elif p.endswith("m"):
                        mins += int(p[:-1])
                if mins > 0:
                    return mins
            except Exception:
                pass
    return None


def _get_differentiator(
    plan: Dict[str, Any],
    change: Dict[str, Any],
    new_details: Dict[str, Any],
    mode: str,
    orig_item: Optional[Dict[str, Any]] = None,
    all_plans: Optional[List[Dict[str, Any]]] = None,
    opt_idx: int = 1,
) -> str:
    orig_item = orig_item or {}
    all_plans = all_plans or []

    # Comparisons across all plans
    other_plans = [
        p for i, p in enumerate(all_plans, start=1)
        if i != opt_idx and isinstance(p, dict)
    ]

    my_cost = _get_numeric_cost(plan, change, new_details)
    other_costs = []
    for op in other_plans:
        och = _get_replacement_change(op)
        ond = och.get("new_details") or {}
        c = _get_numeric_cost(op, och, ond)
        if c is not None:
            other_costs.append(c)

    is_lowest_fare = (my_cost is not None and len(other_costs) > 0 and all(my_cost < oc for oc in other_costs))
    is_highest_fare = (my_cost is not None and len(other_costs) > 0 and all(my_cost > oc for oc in other_costs))

    my_dep = _format_time_hhmm(new_details.get("departure_time") or new_details.get("start_time") or change.get("start_time"))
    my_arr = _format_time_hhmm(new_details.get("arrival_time") or new_details.get("end_time") or change.get("end_time"))

    other_deps = []
    other_arrs = []
    other_durs = []
    for op in other_plans:
        och = _get_replacement_change(op)
        ond = och.get("new_details") or {}
        d = _format_time_hhmm(ond.get("departure_time") or ond.get("start_time") or och.get("start_time"))
        a = _format_time_hhmm(ond.get("arrival_time") or ond.get("end_time") or och.get("end_time"))
        dur = _get_numeric_duration(ond, och)
        if d:
            other_deps.append(d)
        if a:
            other_arrs.append(a)
        if dur:
            other_durs.append(dur)

    my_dur = _get_numeric_duration(new_details, change)
    is_fastest = (my_dur is not None and len(other_durs) > 0 and all(my_dur < od for od in other_durs))
    is_longer_travel_time = (my_dur is not None and len(other_durs) > 0 and all(my_dur > od for od in other_durs))

    is_earliest_arrival = (my_arr is not None and len(other_arrs) > 0 and all(my_arr < oa for oa in other_arrs))

    orig_dep = _format_time_hhmm(orig_item.get("start_time") or orig_item.get("departure_time")) if orig_item else None
    is_later_departure = False
    if my_dep and other_deps and all(my_dep > od for od in other_deps):
        is_later_departure = True
    elif my_dep and orig_dep and my_dep > orig_dep:
        is_later_departure = True

    is_direct = new_details.get("is_direct")
    if is_direct is None and "is_direct" in change:
        is_direct = change.get("is_direct")
    if is_direct is None:
        is_direct = plan.get("is_direct")

    cat = str(plan.get("category") or "").upper()
    tier = str(new_details.get("quality_tier") or change.get("quality_tier") or "").upper()
    delay_mins = plan.get("additional_delay_minutes")
    is_rec = bool(plan.get("is_recommended") or tier == "RECOMMENDED")
    preserves_sched = (cat == "PRIORITY_PRESERVING" or delay_mins == 0)

    # 1. FLIGHT
    if mode == "FLIGHT":
        if is_later_departure and is_direct is True and my_dep:
            return f"Later departure at {my_dep}, but direct and available."
        if is_highest_fare and preserves_sched:
            return "Higher fare, but preserves the preferred travel schedule."
        if is_lowest_fare:
            return "Lower fare than the other options."
        if is_earliest_arrival:
            other_lbl = "the other available option" if len(all_plans) == 2 else "the other available options"
            return f"Arrives earlier than {other_lbl}."
        if is_rec and preserves_sched:
            return "Recommended because it preserves the original journey timing."
        if is_direct is True:
            return "Direct flight with no stops; minimizes disruption."
        if is_rec:
            return "Recommended because it preserves the original journey timing."
        expl = _clean_str(change.get("explanation") or new_details.get("explanation") or plan.get("explanation"))
        if expl and len(expl) <= 70 and not expl.lower().startswith("replacement candidate"):
            return expl
        return "Available recovery option."

    # 2. TRAIN
    elif mode == "TRAIN":
        if is_later_departure and is_lowest_fare:
            return "Later departure, but lower fare."
        if is_lowest_fare:
            return "Lower fare than the other options."
        if is_rec and preserves_sched:
            return "Recommended because it preserves the original journey timing."
        if is_direct is True:
            return "Direct service with no transfers."
        if is_rec:
            return "Recommended because it preserves the original journey timing."
        expl = _clean_str(change.get("explanation") or new_details.get("explanation") or plan.get("explanation"))
        if expl and len(expl) <= 70 and not expl.lower().startswith("replacement candidate"):
            return expl
        return "Available recovery option."

    # 3. CAB / TRANSPORT
    elif mode == "CAB":
        if is_fastest:
            return "Fastest available transfer."
        if is_lowest_fare and is_longer_travel_time:
            return "Lower fare, but longer travel time."
        if is_lowest_fare:
            return "Lower fare than the other options."
        if is_rec and preserves_sched:
            return "Recommended because it preserves the original journey timing."
        if is_rec:
            return "Recommended because it preserves the original journey timing."
        expl = _clean_str(change.get("explanation") or new_details.get("explanation") or plan.get("explanation"))
        if expl and len(expl) <= 70 and not expl.lower().startswith("replacement candidate"):
            return expl
        return "Available recovery option."

    # 4. HOTEL
    elif mode == "HOTEL":
        dist = _clean_str(new_details.get("distance_from_original") or new_details.get("distance"))
        cin = _format_date(new_details.get("check_in") or new_details.get("startDate") or new_details.get("start_date") or change.get("start_time"))
        orig_cin = _format_date(orig_item.get("check_in") or orig_item.get("startDate") or orig_item.get("start_time")) if orig_item else None

        has_other_dists = any(
            _clean_str(((_get_replacement_change(op).get("new_details") or {}).get("distance_from_original")))
            for op in other_plans
        )
        if dist and is_lowest_fare and has_other_dists:
            return "Lower price, but farther from the original hotel."
        if dist:
            same_date = (cin and orig_cin and cin == orig_cin) or (cin is not None)
            if same_date:
                return "Same area and check-in date; closest available alternative."
            return f"{dist} from original hotel."
        if is_lowest_fare:
            return "Lower fare than the other options."
        if is_rec and preserves_sched:
            return "Recommended because it preserves the original journey timing."
        if is_rec:
            return "Recommended because it preserves the original journey timing."
        expl = _clean_str(change.get("explanation") or new_details.get("explanation") or plan.get("explanation"))
        if expl and len(expl) <= 70 and not expl.lower().startswith("replacement candidate"):
            return expl
        return "Available recovery option."

    # 5. GENERIC
    else:
        if is_lowest_fare:
            return "Lower fare than the other options."
        if is_rec and preserves_sched:
            return "Recommended because it preserves the original journey timing."
        if is_rec:
            return "Recommended because it preserves the original journey timing."
        expl = _clean_str(change.get("explanation") or new_details.get("explanation") or plan.get("explanation"))
        if expl and len(expl) <= 70 and not expl.lower().startswith("replacement candidate"):
            return expl
        return "Available recovery option."


def _detect_disrupted_info(
    disruption: Optional[Dict[str, Any]],
    original_item: Optional[Dict[str, Any]],
    plans: List[Dict[str, Any]],
) -> Tuple[str, Dict[str, Any]]:
    disr = disruption or {}
    item = dict(original_item or disr.get("item") or {})
    if not item and plans:
        changes = plans[0].get("changes") or []
        if changes:
            item = dict(changes[0].get("original_details") or {})
        if not item and plans[0].get("removed_items"):
            item = dict(plans[0]["removed_items"][0])

    orig = _clean_str(item.get("origin"))
    dest = _clean_str(item.get("destination"))
    if not dest or _same_endpoint(orig, dest):
        candidate_dest = _clean_str(
            disr.get("destination")
            or (disr.get("event_metadata") or {}).get("destination")
        )
        if candidate_dest and not _same_endpoint(orig, candidate_dest):
            item["destination"] = candidate_dest
        elif plans:
            for p in plans:
                for ch in (p.get("changes") or []):
                    od = ch.get("original_details") or {}
                    d = _clean_str(od.get("destination"))
                    if d and not _same_endpoint(orig, d):
                        item["destination"] = d
                        break
                if item.get("destination") and not _same_endpoint(orig, item.get("destination")):
                    break

    raw_mode = (
        _clean_str(item.get("type"))
        or _clean_str(disr.get("entity_type"))
        or _clean_str(disr.get("disrupted_type"))
    )
    if not raw_mode:
        evt = str(disr.get("event_type") or disr.get("type") or "").upper()
        if "FLIGHT" in evt:
            raw_mode = "FLIGHT"
        elif "HOTEL" in evt or "STAY" in evt:
            raw_mode = "HOTEL"
        elif "TRAIN" in evt or "RAIL" in evt or "METRO" in evt:
            raw_mode = "TRAIN"
        elif "CAB" in evt or "TAXI" in evt or "TRANSFER" in evt or "CAR" in evt:
            raw_mode = "CAB"
        elif "BUS" in evt:
            raw_mode = "BUS"

    if not raw_mode and plans:
        for p in plans:
            for ch in (p.get("changes") or []):
                t = (ch.get("original_details") or {}).get("type") or ch.get("type")
                if t:
                    raw_mode = t
                    break
            if raw_mode:
                break

    mode = _classify_mode(raw_mode)
    return mode, item


def _format_disruption_summary(
    mode: str,
    item: Dict[str, Any],
    disruption: Optional[Dict[str, Any]],
) -> List[str]:
    lines: List[str] = []
    icon = _mode_icon(mode)
    disr = disruption or {}

    origin = _clean_str(item.get("origin"))
    dest = _clean_str(item.get("destination"))
    provider = _clean_str(item.get("provider"))
    service_no = _clean_str(
        item.get("flight_number")
        or item.get("flightNumber")
        or item.get("service_number")
        or item.get("train_number")
    )
    dep = _format_time_hhmm(item.get("start_time") or item.get("departure_time"))
    loc = _clean_str(item.get("location") or dest or origin)
    title = _clean_str(item.get("title") or item.get("name"))

    if mode == "FLIGHT":
        lines.append(f"{icon} Flight Disrupted")
        if service_no and provider:
            lines.append(f"Flight: {service_no} ({provider})")
        elif service_no:
            lines.append(f"Flight: {service_no}")
        elif provider:
            lines.append(f"Airline: {provider}")

        if origin and dest and not _same_endpoint(origin, dest):
            lines.append(f"Route: {origin} → {dest}")
        elif origin:
            lines.append(f"From: {origin}")
        elif dest:
            lines.append(f"To: {dest}")

        if dep:
            lines.append(f"Departure: {dep}")

    elif mode == "HOTEL":
        lines.append(f"{icon} Hotel Booking Disrupted")
        prop_name = provider or title or "Hotel Booking"
        lines.append(f"Property: {prop_name}")
        if loc:
            lines.append(f"Location: {loc}")
        cin = _format_date(item.get("check_in") or item.get("startDate") or item.get("start_time"))
        cout = _format_date(item.get("check_out") or item.get("endDate") or item.get("end_time"))
        if cin and cout:
            lines.append(f"Stay: {cin} → {cout}")
        elif cin:
            lines.append(f"Check-in: {cin}")

    elif mode == "CAB":
        lines.append(f"{icon} Transport Disrupted")
        if provider:
            lines.append(f"Provider: {provider}")
        if origin and dest and not _same_endpoint(origin, dest):
            lines.append(f"Route: {origin} → {dest}")
        elif origin:
            lines.append(f"Pickup: {origin}")
        if dep:
            lines.append(f"Pickup Time: {dep}")

    elif mode == "TRAIN":
        lines.append(f"{icon} Train Disrupted")
        if service_no and provider:
            lines.append(f"Train: {provider} ({service_no})")
        elif provider:
            lines.append(f"Train: {provider}")
        elif service_no:
            lines.append(f"Train Number: {service_no}")
        if origin and dest and not _same_endpoint(origin, dest):
            lines.append(f"Route: {origin} → {dest}")
        if dep:
            lines.append(f"Departure: {dep}")

    else:
        lines.append("⚠️ Journey Disrupted")
        if title:
            lines.append(f"Booking: {title}")
        elif provider:
            lines.append(f"Service: {provider}")
        if origin and dest and not _same_endpoint(origin, dest):
            lines.append(f"Route: {origin} → {dest}")
        elif loc:
            lines.append(f"Location: {loc}")
        if dep:
            lines.append(f"Time: {dep}")

    return lines


def _resolve_option_mode(
    change: Dict[str, Any],
    new_details: Dict[str, Any],
    plan: Dict[str, Any],
    disrupted_mode: str,
) -> str:
    raw = (
        _clean_str(change.get("type"))
        or _clean_str(new_details.get("type"))
        or _clean_str(new_details.get("transportMode"))
        or _clean_str(change.get("transportMode"))
        or _clean_str(plan.get("type"))
    )
    if raw:
        return _classify_mode(raw)

    text = " ".join(filter(None, [
        change.get("new_title"),
        change.get("provider"),
        new_details.get("title"),
        new_details.get("provider"),
        plan.get("title"),
    ])).upper()

    if any(k in text for k in ("HOTEL", "RESORT", "STAY", "INN", "SUITES", "PALACE")):
        return "HOTEL"
    if any(k in text for k in ("CAB", "TAXI", "UBER", "OLA", "BLUSMART", "SHUTTLE")):
        return "CAB"
    if any(k in text for k in ("TRAIN", "RAIL", "EXPRESS", "METRO", "VANDE", "SHATABDI", "TEJAS", "DMRC")):
        return "TRAIN"
    if any(k in text for k in ("AIRLINE", "AIRWAYS", "FLIGHT", "INDIGO", "SPICEJET", "AKASA")):
        return "FLIGHT"

    if disrupted_mode != "UNKNOWN":
        return disrupted_mode

    return "UNKNOWN"


def _get_replacement_change(plan: Dict[str, Any]) -> Dict[str, Any]:
    """Return the booking being replaced, never an unrelated preserved item.

    Recovery plans include ``KEEP`` changes before their replacement changes.  A
    WhatsApp option describes the selected replacement, so taking the first
    change can otherwise produce a generic "Flight Option" header (and omit
    the carrier and flight number) when another booking is merely preserved.
    """
    changes = [
        change for change in (plan.get("changes") or [])
        if isinstance(change, dict)
    ]
    return next(
        (
            change for change in changes
            if isinstance(change, dict)
            and str(change.get("action") or "").upper() in ("REPLACE", "MODIFY")
        ),
        changes[0] if changes else {},
    )


def _format_flight_option(
    idx: int,
    plan: Dict[str, Any],
    change: Dict[str, Any],
    new_details: Dict[str, Any],
    orig_item: Dict[str, Any],
    all_plans: Optional[List[Dict[str, Any]]] = None,
) -> List[str]:
    lines: List[str] = []
    keycap = _get_keycap(idx)

    airline = _clean_str(
        new_details.get("airline")
        or new_details.get("provider")
        or change.get("provider")
    )
    fl_no = _clean_str(
        new_details.get("flight_number")
        or new_details.get("flightNumber")
        or change.get("flight_number")
    )

    if airline and fl_no and fl_no not in airline:
        header_text = f"{airline} {fl_no}"
    elif fl_no:
        header_text = f"Flight {fl_no}"
    elif airline:
        header_text = airline
    else:
        new_title = _clean_str(change.get("new_title") or new_details.get("title"))
        if new_title and new_title.lower() not in ("replacement option", "option", "flight"):
            header_text = new_title
        else:
            header_text = "Flight Option"

    lines.append(f"{keycap} ✈️ {header_text}")

    origin, dest = _resolve_option_route(new_details, change, orig_item)
    if origin and dest and not _same_endpoint(origin, dest):
        lines.append(f"   Route: {origin} → {dest}")
    elif origin:
        lines.append(f"   From: {origin}")
    elif dest:
        lines.append(f"   To: {dest}")

    dep = _format_time_hhmm(new_details.get("departure_time") or new_details.get("start_time") or change.get("start_time"))
    arr = _format_time_hhmm(new_details.get("arrival_time") or new_details.get("end_time") or change.get("end_time"))
    dur_str = _format_duration(new_details.get("duration") or new_details.get("duration_minutes") or change.get("duration"))

    if dep and arr:
        sched = f"{dep} → {arr}" + (f" ({dur_str})" if dur_str else "")
        lines.append(f"   Schedule: {sched}")
    elif dep:
        lines.append(f"   Departure: {dep}")
    elif arr:
        lines.append(f"   Arrival: {arr}")
    elif dur_str:
        lines.append(f"   Duration: {dur_str}")

    is_direct = new_details.get("is_direct")
    if is_direct is None and "is_direct" in change:
        is_direct = change.get("is_direct")

    if is_direct is True:
        lines.append("   Stops: Non-stop")
    elif is_direct is False:
        transfers = plan.get("total_transfers") or 1
        lines.append(f"   Stops: {transfers} stop{'s' if transfers > 1 else ''}")

    fare = _clean_str(new_details.get("fare") or new_details.get("price") or new_details.get("cost") or change.get("estimated_cost") or plan.get("estimated_additional_cost"))
    if fare:
        currency = _clean_str(new_details.get("currency") or plan.get("currency")) or "INR"
        lines.append(f"   Price: {_format_cost(fare, currency)}")

    diff = _get_differentiator(plan, change, new_details, "FLIGHT", orig_item=orig_item, all_plans=all_plans, opt_idx=idx)
    if diff:
        lines.append(f"   Note: {diff}")

    return lines


def _format_hotel_option(
    idx: int,
    plan: Dict[str, Any],
    change: Dict[str, Any],
    new_details: Dict[str, Any],
    orig_item: Dict[str, Any],
    all_plans: Optional[List[Dict[str, Any]]] = None,
) -> List[str]:
    lines: List[str] = []
    keycap = _get_keycap(idx)

    raw_name = _clean_str(
        new_details.get("hotel_name")
        or new_details.get("provider")
        or change.get("provider")
        or change.get("new_title")
        or new_details.get("title")
    )
    if raw_name:
        prop_name = raw_name.split(" (Repl.")[0].split(" (repl.")[0].strip()
    else:
        prop_name = "Hotel Stay"

    lines.append(f"{keycap} 🏨 {prop_name}")

    loc = _clean_str(
        new_details.get("location")
        or change.get("location")
        or orig_item.get("location")
        or new_details.get("destination")
        or change.get("destination")
        or orig_item.get("destination")
    )
    if loc:
        lines.append(f"   Location: {loc}")

    room = _clean_str(new_details.get("room_type") or new_details.get("roomType") or new_details.get("room"))
    if room:
        lines.append(f"   Room: {room}")

    rating = _clean_str(new_details.get("rating") or new_details.get("stars") or new_details.get("star_rating"))
    if rating:
        r_str = f"{rating}★" if "★" not in str(rating) else str(rating)
        lines.append(f"   Rating: {r_str}")

    cin = _format_date(
        new_details.get("check_in")
        or new_details.get("startDate")
        or new_details.get("start_date")
        or change.get("start_time")
    )
    cout = _format_date(
        new_details.get("check_out")
        or new_details.get("endDate")
        or new_details.get("end_date")
        or change.get("end_time")
    )
    nights = new_details.get("number_of_nights") or new_details.get("nights") or _calc_nights(cin, cout)

    if cin and cout:
        n_label = f" ({nights} night{'s' if nights > 1 else ''})" if nights else ""
        lines.append(f"   Dates: {cin} → {cout}{n_label}")
    elif cin:
        n_label = f" ({nights} night{'s' if nights > 1 else ''})" if nights else ""
        lines.append(f"   Check-in: {cin}{n_label}")
    elif nights:
        lines.append(f"   Duration: {nights} night{'s' if nights > 1 else ''}")

    fare = _clean_str(new_details.get("price") or new_details.get("cost") or change.get("estimated_cost") or plan.get("estimated_additional_cost"))
    if fare:
        currency = _clean_str(new_details.get("currency") or plan.get("currency")) or "INR"
        lines.append(f"   Total Price: {_format_cost(fare, currency)}")

    diff = _get_differentiator(plan, change, new_details, "HOTEL", orig_item=orig_item, all_plans=all_plans, opt_idx=idx)
    if diff:
        lines.append(f"   Note: {diff}")

    return lines


def _format_cab_option(
    idx: int,
    plan: Dict[str, Any],
    change: Dict[str, Any],
    new_details: Dict[str, Any],
    orig_item: Dict[str, Any],
    all_plans: Optional[List[Dict[str, Any]]] = None,
) -> List[str]:
    lines: List[str] = []
    keycap = _get_keycap(idx)

    raw_provider = _clean_str(
        new_details.get("provider")
        or change.get("provider")
        or change.get("new_title")
        or new_details.get("title")
    )
    if raw_provider:
        provider = raw_provider.split(" (Repl.")[0].split(" (repl.")[0].strip()
    else:
        provider = "Cab Service"

    lines.append(f"{keycap} 🚕 {provider}")

    pickup, dropoff = _resolve_option_route(new_details, change, orig_item)
    if pickup and dropoff and not _same_endpoint(pickup, dropoff):
        lines.append(f"   Route: {pickup} → {dropoff}")
    elif pickup:
        lines.append(f"   Pickup: {pickup}")
    elif dropoff:
        lines.append(f"   Drop-off: {dropoff}")

    pickup_t = _format_time_hhmm(
        new_details.get("pickup_time")
        or new_details.get("start_time")
        or change.get("start_time")
    )
    arr_t = _format_time_hhmm(
        new_details.get("arrival_time")
        or new_details.get("end_time")
        or change.get("end_time")
    )
    if pickup_t and arr_t:
        lines.append(f"   Time: {pickup_t} → {arr_t}")
    elif pickup_t:
        lines.append(f"   Pickup Time: {pickup_t}")

    dur_str = _format_duration(
        new_details.get("duration")
        or new_details.get("duration_minutes")
        or change.get("duration")
    )
    if dur_str:
        lines.append(f"   Est. Duration: {dur_str}")

    veh = _clean_str(
        new_details.get("vehicle_category")
        or new_details.get("vehicle_type")
        or new_details.get("service_type")
    )
    if veh:
        lines.append(f"   Vehicle: {veh}")

    fare = _clean_str(new_details.get("price") or new_details.get("cost") or change.get("estimated_cost") or plan.get("estimated_additional_cost"))
    if fare:
        currency = _clean_str(new_details.get("currency") or plan.get("currency")) or "INR"
        lines.append(f"   Price: {_format_cost(fare, currency)}")

    diff = _get_differentiator(plan, change, new_details, "CAB", orig_item=orig_item, all_plans=all_plans, opt_idx=idx)
    if diff:
        lines.append(f"   Note: {diff}")

    return lines


def _format_train_option(
    idx: int,
    plan: Dict[str, Any],
    change: Dict[str, Any],
    new_details: Dict[str, Any],
    orig_item: Dict[str, Any],
    all_plans: Optional[List[Dict[str, Any]]] = None,
) -> List[str]:
    lines: List[str] = []
    keycap = _get_keycap(idx)

    custom_title = _clean_str(change.get("new_title") or new_details.get("title"))
    if custom_title and custom_title.lower() in ("replacement option", "option", "train"):
        custom_title = None

    train_name = _clean_str(
        new_details.get("train_name")
        or custom_title
        or new_details.get("provider")
        or change.get("provider")
    )
    if train_name:
        train_name = train_name.split(" (Repl.")[0].split(" (repl.")[0].strip()
    else:
        train_name = "Train Service"

    train_no = _clean_str(
        new_details.get("train_number")
        or new_details.get("trainNumber")
        or new_details.get("booking_id")
        or new_details.get("resource_id")
    )
    if train_no and train_no not in train_name and not str(train_no).startswith("cand_"):
        header_text = f"{train_name} ({train_no})"
    else:
        header_text = train_name

    lines.append(f"{keycap} 🚆 {header_text}")

    origin, dest = _resolve_option_route(new_details, change, orig_item)
    if origin and dest and not _same_endpoint(origin, dest):
        lines.append(f"   Route: {origin} → {dest}")
    elif origin:
        lines.append(f"   From: {origin}")
    elif dest:
        lines.append(f"   To: {dest}")

    dep = _format_time_hhmm(new_details.get("departure_time") or new_details.get("start_time") or change.get("start_time"))
    arr = _format_time_hhmm(new_details.get("arrival_time") or new_details.get("end_time") or change.get("end_time"))
    dur_str = _format_duration(new_details.get("duration") or new_details.get("duration_minutes") or change.get("duration"))

    if dep and arr:
        sched = f"{dep} → {arr}" + (f" ({dur_str})" if dur_str else "")
        lines.append(f"   Schedule: {sched}")
    elif dep:
        lines.append(f"   Departure: {dep}")
    elif arr:
        lines.append(f"   Arrival: {arr}")
    elif dur_str:
        lines.append(f"   Duration: {dur_str}")

    cls = _clean_str(new_details.get("class") or new_details.get("cabin_class") or new_details.get("coach"))
    if cls:
        lines.append(f"   Class: {cls}")

    fare = _clean_str(new_details.get("price") or new_details.get("cost") or new_details.get("fare") or change.get("estimated_cost") or plan.get("estimated_additional_cost"))
    if fare:
        currency = _clean_str(new_details.get("currency") or plan.get("currency")) or "INR"
        lines.append(f"   Price: {_format_cost(fare, currency)}")

    diff = _get_differentiator(plan, change, new_details, "TRAIN", orig_item=orig_item, all_plans=all_plans, opt_idx=idx)
    if diff:
        lines.append(f"   Note: {diff}")

    return lines


def _format_generic_option(
    idx: int,
    plan: Dict[str, Any],
    change: Dict[str, Any],
    new_details: Dict[str, Any],
    orig_item: Dict[str, Any],
    mode: str,
    all_plans: Optional[List[Dict[str, Any]]] = None,
) -> List[str]:
    lines: List[str] = []
    keycap = _get_keycap(idx)
    icon = _mode_icon(mode)

    raw_title = _clean_str(
        change.get("new_title")
        or new_details.get("title")
        or change.get("provider")
        or new_details.get("provider")
        or plan.get("title")
    )
    if raw_title:
        title = raw_title.split(" (Repl.")[0].split(" (repl.")[0].strip()
    else:
        title = f"Option {idx}"

    lines.append(f"{keycap} {icon} {title}")

    origin, dest = _resolve_option_route(new_details, change, orig_item)
    loc = _clean_str(new_details.get("location") or change.get("location"))

    if origin and dest and not _same_endpoint(origin, dest):
        lines.append(f"   Route: {origin} → {dest}")
    elif loc:
        lines.append(f"   Location: {loc}")
    elif origin:
        lines.append(f"   From: {origin}")
    elif dest:
        lines.append(f"   To: {dest}")

    dep = _format_time_hhmm(new_details.get("start_time") or change.get("start_time"))
    arr = _format_time_hhmm(new_details.get("end_time") or change.get("end_time"))
    dur_str = _format_duration(new_details.get("duration") or new_details.get("duration_minutes") or change.get("duration"))

    if dep and arr:
        sched = f"{dep} → {arr}" + (f" ({dur_str})" if dur_str else "")
        lines.append(f"   Time: {sched}")
    elif dep:
        lines.append(f"   Time: {dep}")
    elif dur_str:
        lines.append(f"   Duration: {dur_str}")

    fare = _clean_str(new_details.get("price") or new_details.get("cost") or change.get("estimated_cost") or plan.get("estimated_additional_cost"))
    if fare:
        currency = _clean_str(new_details.get("currency") or plan.get("currency")) or "INR"
        lines.append(f"   Price: {_format_cost(fare, currency)}")

    diff = _get_differentiator(plan, change, new_details, mode, orig_item=orig_item, all_plans=all_plans, opt_idx=idx)
    if diff:
        lines.append(f"   Note: {diff}")

    return lines


def _format_reply_prompt(num_options: int) -> str:
    if num_options <= 0:
        return "Reply 0 to cancel."
    if num_options == 1:
        return "Reply 1 to select this option.\nReply 0 to cancel."
    if num_options == 2:
        return "Reply 1 or 2 to select an option.\nReply 0 to cancel."
    opts_str = ", ".join(str(i) for i in range(1, num_options)) + f" or {num_options}"
    return f"Reply {opts_str} to select an option.\nReply 0 to cancel."


def format_whatsapp_recovery_options(
    trip_id: int,
    disruption: Optional[Dict[str, Any]],
    plans: List[Dict[str, Any]],
    original_item: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Format available recovery plans dynamically into numbered WhatsApp options.
    Mode-aware: formats Flight, Hotel, Transport/Cab, Train, or Generic appropriately.
    Never hardcodes flight if the disruption was hotel/cab/train.
    """
    lines: List[str] = [
        "🚨 TRAVEL DISRUPTION",
    ]

    adapted_plans = [_adapt_plan(p) for p in (plans or [])]
    disrupted_mode, item = _detect_disrupted_info(disruption, original_item, adapted_plans)

    summary_lines = _format_disruption_summary(disrupted_mode, item, disruption)
    if summary_lines:
        lines.append("")
        lines.extend(summary_lines)

    if not plans:
        lines.extend([
            "",
            "No automated recovery options are available at this moment.",
            "Our support team is reviewing your journey.",
            "",
            "Reply 0 to cancel.",
        ])
        return "\n".join(lines)

    option_modes = []
    for plan in adapted_plans:
        change = _get_replacement_change(plan)
        new_details = change.get("new_details") or {}
        opt_mode = _resolve_option_mode(change, new_details, plan, disrupted_mode)
        option_modes.append(opt_mode)

    predominant_mode = option_modes[0] if option_modes else disrupted_mode
    if all(m == predominant_mode for m in option_modes):
        options_mode_label = predominant_mode
    else:
        options_mode_label = "UNKNOWN"

    count = len(plans)
    if options_mode_label == "FLIGHT":
        intro = "Available flight option:" if count == 1 else "Available flight options:"
    elif options_mode_label == "HOTEL":
        intro = "Available hotel option:" if count == 1 else "Available hotel options:"
    elif options_mode_label == "CAB":
        intro = "Available transport option:" if count == 1 else "Available transport options:"
    elif options_mode_label == "TRAIN":
        intro = "Available train option:" if count == 1 else "Available train options:"
    else:
        intro = "Available recovery option:" if count == 1 else "Available recovery options:"

    lines.append("")
    lines.append(intro)

    for idx, (plan, opt_mode) in enumerate(zip(adapted_plans, option_modes), start=1):
        lines.append("")
        change = _get_replacement_change(plan)
        new_details = change.get("new_details") or {}

        if opt_mode == "FLIGHT":
            opt_lines = _format_flight_option(idx, plan, change, new_details, item, all_plans=adapted_plans)
        elif opt_mode == "HOTEL":
            opt_lines = _format_hotel_option(idx, plan, change, new_details, item, all_plans=adapted_plans)
        elif opt_mode == "CAB":
            opt_lines = _format_cab_option(idx, plan, change, new_details, item, all_plans=adapted_plans)
        elif opt_mode == "TRAIN":
            opt_lines = _format_train_option(idx, plan, change, new_details, item, all_plans=adapted_plans)
        else:
            opt_lines = _format_generic_option(idx, plan, change, new_details, item, opt_mode, all_plans=adapted_plans)

        lines.extend(opt_lines)

    lines.append("")
    lines.append(_format_reply_prompt(len(plans)))

    return "\n".join(lines)


def format_recovery_confirmation(
    plan: Dict[str, Any],
    execution_result: Optional[Dict[str, Any]] = None,
) -> str:
    """Format a dynamic WhatsApp confirmation after successful recovery plan execution."""
    plan = _adapt_plan(plan)
    lines = [
        "✅ RECOVERY CONFIRMED",
        "",
        "Your itinerary has been updated.",
    ]

    confirmed = (execution_result or {}).get("confirmed_bookings") or []
    booking = confirmed[0] if confirmed else {}
    change = _get_replacement_change(plan)
    new_details = change.get("new_details") or {}
    orig_details = change.get("original_details") or {}

    raw_mode = booking.get("type") or change.get("type") or new_details.get("type")
    mode = _classify_mode(raw_mode)
    icon = _mode_icon(mode)

    # Provider and Service number
    provider = _clean_str(booking.get("provider") or new_details.get("provider"))
    service_no = _clean_str(
        booking.get("flight_number") or booking.get("train_number") or new_details.get("flight_number") or new_details.get("train_number") or new_details.get("booking_id")
    )

    header = f"{icon}"
    if provider and service_no and service_no not in provider:
        header += f" {provider} {service_no}"
    elif provider:
        header += f" {provider}"
    elif service_no:
        header += f" {service_no}"
    else:
        title = _clean_str(booking.get("replacement_title") or change.get("new_title") or new_details.get("title"))
        if title and title.lower() not in ("replacement option", "option"):
            header += f" {title}"
        else:
            header += " New Booking"

    lines.extend(["", header])

    origin = _clean_str(booking.get("origin") or new_details.get("origin"))
    destination = _clean_str(booking.get("destination") or new_details.get("destination"))
    if origin and destination:
        lines.append(f"{origin} → {destination}")
    elif origin:
        lines.append(f"From: {origin}")
    elif destination:
        lines.append(f"To: {destination}")

    dep = _format_time_hhmm(booking.get("departure_time") or new_details.get("departure_time") or new_details.get("start_time") or change.get("start_time"))
    arr = _format_time_hhmm(booking.get("arrival_time") or new_details.get("arrival_time") or new_details.get("end_time") or change.get("end_time"))

    if dep:
        lines.append(f"🕐 Departure: {dep}")
    if arr:
        lines.append(f"🕐 Arrival: {arr}")

    dur_str = _format_duration(new_details.get("duration") or new_details.get("duration_minutes") or change.get("duration"))
    if dur_str:
        lines.append(f"⏱️ Duration: {dur_str}")

    cls = _clean_str(booking.get("cabin_class") or booking.get("room_type") or booking.get("vehicle_category") or new_details.get("class") or new_details.get("cabin_class") or new_details.get("room_type"))
    if cls:
        lines.append(f"💺 Class/service type: {cls}")

    fare = _clean_str(booking.get("final_price") or new_details.get("price") or new_details.get("fare") or new_details.get("cost"))
    if fare:
        currency = _clean_str(booking.get("currency") or new_details.get("currency")) or "INR"
        lines.append(f"💰 Fare: {_format_cost(fare, currency)}")

    pnr = _clean_str(booking.get("pnr") or booking.get("booking_reference") or booking.get("ticket_number") or new_details.get("pnr"))
    if pnr and pnr.lower() not in ("n/a", "none", "null", ""):
        lines.append(f"🎫 PNR/Booking ID: {pnr}")

    # Before vs After
    lines.append("")
    lines.append("Previous itinerary:")

    old_provider = _clean_str(booking.get("original_provider") or orig_details.get("provider") or change.get("original_provider"))
    old_title = _clean_str(booking.get("original_title") or orig_details.get("title"))
    old_header = old_provider or old_title or "Old Booking"

    old_service_no = _clean_str(orig_details.get("flight_number") or orig_details.get("train_number"))
    if old_service_no and old_provider and old_service_no not in old_provider:
        old_header = f"{old_provider} {old_service_no}"

    lines.append(old_header)

    old_origin = _clean_str(orig_details.get("origin") or change.get("origin"))
    old_dest = _clean_str(orig_details.get("destination") or change.get("destination"))
    if old_origin and old_dest:
        lines.append(f"{old_origin} → {old_dest}")

    old_dep = _format_time_hhmm(orig_details.get("start_time") or orig_details.get("departure_time"))
    if old_dep:
        lines.append(f"Departure: {old_dep}")

    old_fare = _clean_str(orig_details.get("cost") or orig_details.get("price") or orig_details.get("fare"))
    if old_fare:
        old_curr = _clean_str(orig_details.get("currency")) or "INR"
        lines.append(f"Fare: {_format_cost(old_fare, old_curr)}")

    lines.append("")
    lines.append("Updated itinerary:")
    lines.append(header.replace(icon + " ", ""))
    if origin and destination:
        lines.append(f"{origin} → {destination}")
    if dep:
        lines.append(f"Departure: {dep}")
    if fare:
        currency = _clean_str(booking.get("currency") or new_details.get("currency")) or "INR"
        lines.append(f"Fare: {_format_cost(fare, currency)}")

    return "\n".join(lines)


def format_recovery_notification(trip_id: int, plan: Dict[str, Any]) -> str:
    plan = _adapt_plan(plan)
    changes = plan.get("changes") or []
    replacements = [c for c in changes if c.get("action") in ("REPLACE", "MODIFY")]
    lines = ["Travel Disruption", "", plan.get("title") or "A recovery plan is ready for your journey.", ""]
    for change in replacements[:3]:
        original = change.get("original_title") or "Your booking"
        replacement = change.get("new_title") or "Replacement option"
        lines.append(f"{original} -> {replacement}")
        departure = change.get("start_time")
        if departure:
            lines.append(f"Departure: {departure}")
    cost = plan.get("estimated_additional_cost")
    if cost is None:
        cost = plan.get("cost_estimate", {}).get("estimated_additional_cost", 0)
    currency = (plan.get("cost_estimate") or {}).get("currency", "INR")
    lines.extend([
        "",
        f"Estimated additional cost: {currency} {float(cost or 0):,.2f}",
        "",
        "Reply VIEW to review, ACCEPT to confirm, REJECT to decline, or HELP for assistance.",
    ])
    return "\n".join(lines)


def format_disruption_alert(disruption: Dict[str, Any]) -> str:
    metadata = disruption.get("event_metadata") or {}
    item = disruption.get("item") or {}
    event_type = disruption.get("event_type") or disruption.get("type") or "Disruption detected"
    reason = metadata.get("reason") or disruption.get("reason") or event_type
    severity = disruption.get("severity") or "HIGH"
    location = (
        metadata.get("affected_location")
        or item.get("location")
        or item.get("origin")
        or item.get("destination")
    )
    delay = metadata.get("delay_minutes") or disruption.get("delay_minutes")

    lines = ["🚨 TRAVORA DISRUPTION ALERT", ""]
    if location:
        lines.append(f"📍 Location: {location}")
    if reason:
        lines.append(f"⚠️ Event: {reason}")
    if severity:
        lines.append(f"🔴 Severity: {severity}")
    if delay:
        lines.append(f"⏱️ Expected delay: {delay} minutes")
    lines.extend([
        "",
        "🧭 Recommended action:",
        "Please consider an alternate route.",
    ])
    return "\n".join(lines)


def format_help() -> str:
    return "Reply with an option number (e.g. 1, 2) to select a recovery plan, 0 to cancel, VIEW to review, or HELP for assistance."
