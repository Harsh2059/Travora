from datetime import datetime
from typing import Any, Dict


def _value(change: Dict[str, Any], key: str, default: str = "") -> str:
    value = change.get(key)
    if value in (None, ""):
        value = (change.get("new_details") or {}).get(key, default)
    return str(value or default)


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
    return "Reply VIEW to see your recovery plan, ACCEPT to confirm it, or REJECT to decline it."
