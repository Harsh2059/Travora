from datetime import datetime
from typing import Any, Dict, List, Optional


_KEYCAPS = {
    1: "1️⃣", 2: "2️⃣", 3: "3️⃣", 4: "4️⃣", 5: "5️⃣",
    6: "6️⃣", 7: "7️⃣", 8: "8️⃣", 9: "9️⃣", 10: "🔟"
}


def _get_keycap(num: int) -> str:
    return _KEYCAPS.get(num, f"{num}️⃣")


def _mode_icon(mode: Optional[str]) -> str:
    m = (mode or "").upper()
    if "FLIGHT" in m:
        return "✈️"
    if "TRAIN" in m or "RAIL" in m:
        return "🚆"
    if "BUS" in m:
        return "🚌"
    if "CAB" in m or "TAXI" in m or "CAR" in m:
        return "🚕"
    if "HOTEL" in m or "STAY" in m or "ACCOMMODATION" in m:
        return "🏨"
    return "🔄"


def _format_time_hhmm(val: Any) -> Optional[str]:
    if not val:
        return None
    s = str(val).strip()
    if s in ("None", "null", "undefined", ""):
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


def _format_cost(cost: Any, currency: str = "INR") -> Optional[str]:
    if cost is None or cost == "" or str(cost).lower() in ("none", "null"):
        return None
    try:
        val = float(cost)
        if val <= 0:
            return None
        symbol = "₹" if currency == "INR" else f"{currency} "
        if val.is_integer():
            return f"{symbol}{int(val):,}"
        return f"{symbol}{val:,.2f}"
    except (ValueError, TypeError):
        return None


def _clean_str(val: Any) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() in ("none", "null", "undefined", "n/a"):
        return None
    return s


def _value(change: Dict[str, Any], key: str, default: str = "") -> str:
    value = change.get(key)
    if value in (None, ""):
        value = (change.get("new_details") or {}).get(key, default)
    return str(value or default)


def format_whatsapp_recovery_options(
    trip_id: int,
    disruption: Optional[Dict[str, Any]],
    plans: List[Dict[str, Any]],
    original_item: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Format available recovery plans dynamically into numbered WhatsApp options.
    Only displays options that actually exist. Never displays fake options or None values.
    """
    lines: List[str] = [
        "🚨 TRAVORA TRAVEL ALERT",
        "",
        "Your journey has been disrupted.",
    ]

    # Resolve original disrupted journey info if available
    disr = disruption or {}
    item = original_item or disr.get("item") or {}
    if not item and plans:
        changes = plans[0].get("changes") or []
        if changes:
            item = changes[0].get("original_details") or {}

    orig_mode = _clean_str(item.get("type")) or "FLIGHT"
    orig_icon = _mode_icon(orig_mode)
    orig_origin = _clean_str(item.get("origin"))
    orig_destination = _clean_str(item.get("destination"))
    orig_flight = _clean_str(item.get("flight_number") or item.get("flightNumber") or item.get("service_number"))
    orig_provider = _clean_str(item.get("provider"))
    orig_dep = _format_time_hhmm(item.get("start_time") or item.get("departure_time"))

    orig_block = []
    orig_block.append(f"{orig_icon} Original Journey")
    if orig_origin and orig_destination:
        orig_block.append(f"{orig_origin} → {orig_destination}")
    if orig_flight:
        label = "Flight" if "FLIGHT" in orig_mode.upper() else "Service"
        orig_block.append(f"{label}: {orig_flight}")
    elif orig_provider:
        orig_block.append(f"Service: {orig_provider}")
    if orig_dep:
        orig_block.append(f"Departure: {orig_dep}")

    if len(orig_block) > 1:
        lines.append("")
        lines.extend(orig_block)

    # Options section
    if len(plans) == 1:
        lines.extend(["", "We found this recovery option:"])
    else:
        lines.extend(["", "We found these recovery options:"])

    for idx, plan in enumerate(plans, start=1):
        lines.append("")
        keycap = _get_keycap(idx)
        changes = plan.get("changes") or []
        change = changes[0] if changes else {}
        new_details = change.get("new_details") or {}

        mode = _clean_str(change.get("type") or plan.get("type") or new_details.get("type")) or "FLIGHT"
        icon = _mode_icon(mode)

        # Mode label
        m_upper = mode.upper()
        if "FLIGHT" in m_upper:
            mode_label = "Alternative Flight"
        elif "TRAIN" in m_upper:
            mode_label = "Train"
        elif "BUS" in m_upper:
            mode_label = "Bus"
        elif "CAB" in m_upper or "TAXI" in m_upper:
            mode_label = "Cab"
        elif "HOTEL" in m_upper:
            mode_label = "Hotel"
        else:
            mode_label = mode.capitalize()

        lines.append(f"{keycap} {icon} {mode_label}")

        # Provider / Service title
        new_title = _clean_str(change.get("new_title") or new_details.get("title"))
        provider = _clean_str(change.get("provider") or new_details.get("provider"))
        service_num = _clean_str(
            new_details.get("flight_number")
            or new_details.get("flightNumber")
            or new_details.get("train_number")
            or new_details.get("trainNumber")
        )

        if new_title and new_title.lower() not in ("replacement option", "option"):
            lines.append(new_title)
        elif provider and service_num:
            lines.append(f"{provider} {service_num}")
        elif provider:
            lines.append(provider)

        # Route
        origin = _clean_str(change.get("origin") or new_details.get("origin") or orig_origin)
        destination = _clean_str(change.get("destination") or new_details.get("destination") or orig_destination)
        if origin and destination:
            lines.append(f"{origin} → {destination}")
        elif origin:
            lines.append(f"From {origin}")
        elif destination:
            lines.append(f"To {destination}")

        # Timing
        start_t = _format_time_hhmm(change.get("start_time") or new_details.get("start_time") or new_details.get("departure_time"))
        end_t = _format_time_hhmm(change.get("end_time") or new_details.get("end_time") or new_details.get("arrival_time"))
        if start_t and end_t:
            lines.append(f"{start_t} → {end_t}")
        elif start_t:
            lines.append(f"Departure: {start_t}")

        # Cost
        cost = plan.get("estimated_additional_cost")
        if cost is None:
            cost = (plan.get("cost_estimate") or {}).get("estimated_additional_cost")
        if cost is None:
            cost = change.get("estimated_cost") or new_details.get("fare") or new_details.get("price")
        currency = (plan.get("cost_estimate") or {}).get("currency", "INR")
        formatted_price = _format_cost(cost, currency)
        if formatted_price:
            lines.append(formatted_price)

        # Seat / Class / Meals
        cabin = _clean_str(new_details.get("cabin_class") or new_details.get("class"))
        seat = _clean_str(new_details.get("seat") or new_details.get("seat_or_berth"))
        meals = _clean_str(new_details.get("meal_info") or new_details.get("meals"))
        if cabin:
            lines.append(f"Class: {cabin}")
        if seat:
            lines.append(f"Seat: {seat}")
        if meals:
            lines.append(f"Meals: {meals}")

    # Reply instructions
    lines.extend(["", "👉 Reply with:"])
    for idx in range(1, len(plans) + 1):
        keycap = _get_keycap(idx)
        lines.append(f"{keycap} Select Option {idx}")

    lines.extend(["", "Reply 0️⃣ to cancel."])
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

    mode = _clean_str(booking.get("type") or change.get("type") or new_details.get("type")) or "FLIGHT"
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
        original = _value(change, "original_title", "Your booking")
        replacement = _value(change, "new_title", "Replacement option")
        lines.append(f"{original} -> {replacement}")
        departure = _value(change, "start_time")
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
