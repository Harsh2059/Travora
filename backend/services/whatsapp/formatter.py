"""
WhatsApp message formatting module.
Provides mode-aware recovery options, disruption alerts, and confirmation messages.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple


_KEYCAPS = {
    1: "1️⃣", 2: "2️⃣", 3: "3️⃣", 4: "4️⃣", 5: "5️⃣",
    6: "6️⃣", 7: "7️⃣", 8: "8️⃣", 9: "9️⃣", 10: "🔟"
}


def _get_keycap(num: int) -> str:
    return _KEYCAPS.get(num, f"{num}️⃣")


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


def _get_differentiator(
    plan: Dict[str, Any],
    change: Dict[str, Any],
    new_details: Dict[str, Any],
    mode: str,
) -> Optional[str]:
    tags: List[str] = []

    tier = str(new_details.get("quality_tier") or change.get("quality_tier") or "").upper()
    cat = str(plan.get("category") or "").upper()
    is_rec = plan.get("is_recommended") or tier == "RECOMMENDED"

    if is_rec:
        tags.append("Recommended")
    if tier == "PREMIUM" and "Recommended" not in tags:
        tags.append("Premium")
    elif tier == "BUDGET":
        tags.append("Budget-Friendly")
    elif tier == "ECO_PREMIUM":
        tags.append("Eco-Friendly")

    if cat == "PRIORITY_PRESERVING":
        tags.append("Priority-Preserving")

    dist = _clean_str(new_details.get("distance_from_original") or new_details.get("distance"))
    if dist:
        tags.append(f"{dist} from original")

    if not tags:
        expl = _clean_str(change.get("explanation") or new_details.get("explanation") or plan.get("explanation"))
        if expl and len(expl) <= 70 and not expl.lower().startswith("replacement candidate"):
            tags.append(expl)

    return " • ".join(tags) if tags else None


def _detect_disrupted_info(
    disruption: Optional[Dict[str, Any]],
    original_item: Optional[Dict[str, Any]],
    plans: List[Dict[str, Any]],
) -> Tuple[str, Dict[str, Any]]:
    disr = disruption or {}
    item = original_item or disr.get("item") or {}
    if not item and plans:
        changes = plans[0].get("changes") or []
        if changes:
            item = changes[0].get("original_details") or {}

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

        if origin and dest:
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
        if origin and dest:
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
        if origin and dest:
            lines.append(f"Route: {origin} → {dest}")
        if dep:
            lines.append(f"Departure: {dep}")

    else:
        lines.append("⚠️ Journey Disrupted")
        if title:
            lines.append(f"Booking: {title}")
        elif provider:
            lines.append(f"Service: {provider}")
        if origin and dest:
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


def _format_flight_option(
    idx: int,
    plan: Dict[str, Any],
    change: Dict[str, Any],
    new_details: Dict[str, Any],
    orig_item: Dict[str, Any],
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
    new_title = _clean_str(change.get("new_title") or new_details.get("title"))

    if airline and fl_no:
        header_text = f"{airline} {fl_no}"
    elif fl_no:
        header_text = f"Flight {fl_no}"
    elif airline:
        header_text = airline
    elif new_title and new_title.lower() not in ("replacement option", "option", "flight"):
        header_text = new_title
    else:
        header_text = "Flight Option"

    lines.append(f"{keycap} ✈️ {header_text}")

    origin = _clean_str(new_details.get("origin") or change.get("origin") or orig_item.get("origin"))
    dest = _clean_str(new_details.get("destination") or change.get("destination") or orig_item.get("destination"))
    if origin and dest:
        lines.append(f"   Route: {origin} → {dest}")

    dep = _format_time_hhmm(new_details.get("departure_time") or new_details.get("start_time") or change.get("start_time"))
    arr = _format_time_hhmm(new_details.get("arrival_time") or new_details.get("end_time") or change.get("end_time"))
    dur_str = _format_duration(new_details.get("duration") or new_details.get("duration_minutes") or plan.get("total_duration_minutes"))

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
    if is_direct is None and "is_direct" in plan:
        is_direct = plan.get("is_direct")
    if is_direct is None and "total_transfers" in plan:
        is_direct = (plan.get("total_transfers") == 0)

    if is_direct is True:
        lines.append("   Stops: Non-stop")
    elif is_direct is False:
        transfers = plan.get("total_transfers") or 1
        lines.append(f"   Stops: {transfers} stop{'s' if transfers > 1 else ''}")

    price = _get_plan_cost_string(plan, change, new_details)
    if price:
        lines.append(f"   Price: {price}")

    diff = _get_differentiator(plan, change, new_details, "FLIGHT")
    if diff:
        lines.append(f"   Note: {diff}")

    return lines


def _format_hotel_option(
    idx: int,
    plan: Dict[str, Any],
    change: Dict[str, Any],
    new_details: Dict[str, Any],
    orig_item: Dict[str, Any],
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
        or new_details.get("destination")
        or change.get("destination")
        or orig_item.get("location")
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
        or orig_item.get("startDate")
    )
    cout = _format_date(
        new_details.get("check_out")
        or new_details.get("endDate")
        or new_details.get("end_date")
        or change.get("end_time")
        or orig_item.get("endDate")
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

    price = _get_plan_cost_string(plan, change, new_details)
    if price:
        lines.append(f"   Total Price: {price}")

    diff = _get_differentiator(plan, change, new_details, "HOTEL")
    if diff:
        lines.append(f"   Note: {diff}")

    return lines


def _format_cab_option(
    idx: int,
    plan: Dict[str, Any],
    change: Dict[str, Any],
    new_details: Dict[str, Any],
    orig_item: Dict[str, Any],
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

    pickup = _clean_str(new_details.get("origin") or change.get("origin") or orig_item.get("origin"))
    dropoff = _clean_str(new_details.get("destination") or change.get("destination") or orig_item.get("destination"))
    if pickup and dropoff:
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
        or plan.get("total_duration_minutes")
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

    price = _get_plan_cost_string(plan, change, new_details)
    if price:
        lines.append(f"   Price: {price}")

    diff = _get_differentiator(plan, change, new_details, "CAB")
    if diff:
        lines.append(f"   Note: {diff}")

    return lines


def _format_train_option(
    idx: int,
    plan: Dict[str, Any],
    change: Dict[str, Any],
    new_details: Dict[str, Any],
    orig_item: Dict[str, Any],
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

    origin = _clean_str(new_details.get("origin") or change.get("origin") or orig_item.get("origin"))
    dest = _clean_str(new_details.get("destination") or change.get("destination") or orig_item.get("destination"))
    if origin and dest:
        lines.append(f"   Route: {origin} → {dest}")

    dep = _format_time_hhmm(new_details.get("departure_time") or new_details.get("start_time") or change.get("start_time"))
    arr = _format_time_hhmm(new_details.get("arrival_time") or new_details.get("end_time") or change.get("end_time"))
    dur_str = _format_duration(new_details.get("duration") or new_details.get("duration_minutes") or plan.get("total_duration_minutes"))

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

    price = _get_plan_cost_string(plan, change, new_details)
    if price:
        lines.append(f"   Price: {price}")

    diff = _get_differentiator(plan, change, new_details, "TRAIN")
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

    origin = _clean_str(new_details.get("origin") or change.get("origin"))
    dest = _clean_str(new_details.get("destination") or change.get("destination"))
    loc = _clean_str(new_details.get("location") or change.get("location"))

    if origin and dest:
        lines.append(f"   Route: {origin} → {dest}")
    elif loc:
        lines.append(f"   Location: {loc}")
    elif origin:
        lines.append(f"   From: {origin}")
    elif dest:
        lines.append(f"   To: {dest}")

    dep = _format_time_hhmm(new_details.get("start_time") or change.get("start_time"))
    arr = _format_time_hhmm(new_details.get("end_time") or change.get("end_time"))
    dur_str = _format_duration(new_details.get("duration") or new_details.get("duration_minutes") or plan.get("total_duration_minutes"))

    if dep and arr:
        sched = f"{dep} → {arr}" + (f" ({dur_str})" if dur_str else "")
        lines.append(f"   Time: {sched}")
    elif dep:
        lines.append(f"   Time: {dep}")
    elif dur_str:
        lines.append(f"   Duration: {dur_str}")

    price = _get_plan_cost_string(plan, change, new_details)
    if price:
        lines.append(f"   Price: {price}")

    diff = _get_differentiator(plan, change, new_details, "GENERIC")
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

    disrupted_mode, item = _detect_disrupted_info(disruption, original_item, plans)

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
    for plan in plans:
        changes = plan.get("changes") or []
        change = changes[0] if changes else {}
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

    for idx, (plan, opt_mode) in enumerate(zip(plans, option_modes), start=1):
        lines.append("")
        changes = plan.get("changes") or []
        change = changes[0] if changes else {}
        new_details = change.get("new_details") or {}

        if opt_mode == "FLIGHT":
            opt_lines = _format_flight_option(idx, plan, change, new_details, item)
        elif opt_mode == "HOTEL":
            opt_lines = _format_hotel_option(idx, plan, change, new_details, item)
        elif opt_mode == "CAB":
            opt_lines = _format_cab_option(idx, plan, change, new_details, item)
        elif opt_mode == "TRAIN":
            opt_lines = _format_train_option(idx, plan, change, new_details, item)
        else:
            opt_lines = _format_generic_option(idx, plan, change, new_details, item, opt_mode)

        lines.extend(opt_lines)

    lines.append("")
    lines.append(_format_reply_prompt(len(plans)))

    return "\n".join(lines)


def format_recovery_confirmation(
    plan: Dict[str, Any],
    execution_result: Optional[Dict[str, Any]] = None,
) -> str:
    """Format a dynamic WhatsApp confirmation after successful recovery plan execution."""
    lines = [
        "✅ RECOVERY CONFIRMED",
        "",
        "Your recovery option has been selected successfully.",
    ]

    confirmed = (execution_result or {}).get("confirmed_bookings") or []
    booking = confirmed[0] if confirmed else {}
    changes = plan.get("changes") or []
    change = changes[0] if changes else {}
    new_details = change.get("new_details") or {}

    raw_mode = booking.get("type") or change.get("type") or new_details.get("type")
    mode = _classify_mode(raw_mode)
    icon = _mode_icon(mode)
    lines.extend(["", f"{icon} New Journey"])

    title = _clean_str(
        booking.get("replacement_title")
        or change.get("new_title")
        or booking.get("provider")
        or change.get("provider")
        or new_details.get("title")
    )
    if title and title.lower() not in ("replacement option", "option"):
        lines.append(title)

    origin = _clean_str(booking.get("origin") or change.get("origin") or new_details.get("origin"))
    destination = _clean_str(booking.get("destination") or change.get("destination") or new_details.get("destination"))
    if origin and destination:
        lines.extend(["", f"{origin} → {destination}"])
    elif origin:
        lines.extend(["", f"From: {origin}"])
    elif destination:
        lines.extend(["", f"To: {destination}"])

    dep = _format_time_hhmm(booking.get("departure_time") or change.get("start_time") or new_details.get("departure_time"))
    arr = _format_time_hhmm(booking.get("arrival_time") or change.get("end_time") or new_details.get("arrival_time"))
    timing_block = []
    if dep:
        timing_block.append(f"Departure: {dep}")
    if arr:
        timing_block.append(f"Arrival: {arr}")
    if timing_block:
        lines.append("")
        lines.extend(timing_block)

    pnr = _clean_str(booking.get("pnr") or booking.get("booking_reference") or new_details.get("pnr"))
    if pnr and pnr not in ("N/A", "None", ""):
        lines.extend(["", f"PNR: {pnr}"])

    lines.extend(["", "Your itinerary has been updated."])
    return "\n".join(lines)


def format_recovery_notification(trip_id: int, plan: Dict[str, Any]) -> str:
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
