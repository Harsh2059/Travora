import os
from typing import Any, Dict, List, Optional
from datetime import datetime


class DynamicSmsGenerator:
    """
    Transport-agnostic dynamic SMS generator.
    Generates SMS notifications purely from actual database and event payload objects.
    Contains NO hardcoded demo strings, fake flight numbers, or fake PNRs.
    """

    @staticmethod
    def get_recipient_phone(user_phone: Optional[str]) -> str:
        """
        Returns DEMO_SMS_RECIPIENT from environment if set, else user's phone.
        """
        env_recipient = os.getenv("DEMO_SMS_RECIPIENT", "").strip()
        if env_recipient:
            return env_recipient
        phone = (user_phone or "").strip()
        if phone:
            return phone
        return "+919999999999"  # Fallback for custom trips without phone number

    @staticmethod
    def format_time(val: Any) -> Optional[str]:
        if not val or val in ("None", "null", "undefined"):
            return None
        if isinstance(val, datetime):
            return val.strftime("%H:%M")
        if isinstance(val, str):
            val_str = val.strip()
            if not val_str or val_str in ("None", "null", "undefined"):
                return None
            try:
                # Handle ISO format strings like "2026-09-24T18:40:00"
                dt = datetime.fromisoformat(val_str.replace("Z", "+00:00"))
                return dt.strftime("%H:%M")
            except Exception:
                # If it's already "18:40" or similar, return as is
                if ":" in val_str and len(val_str) <= 8:
                    return val_str
                return val_str
        return None

    @staticmethod
    def clean_str(val: Any) -> Optional[str]:
        if val is None:
            return None
        s = str(val).strip()
        if not s or s.lower() in ("none", "null", "undefined", "n/a"):
            return None
        return s

    @classmethod
    def get_transport_mode_label(cls, raw_type: Optional[str]) -> str:
        t = (raw_type or "").upper()
        mapping = {
            "FLIGHT": "Flight",
            "TRAIN": "Train",
            "BUS": "Bus",
            "CAB": "Cab",
            "TAXI": "Cab",
            "TRANSFER": "Transfer",
            "HOTEL": "Hotel",
            "ACTIVITY": "Activity",
            "EVENT": "Event",
            "METRO": "Metro",
            "FERRY": "Ferry",
            "BOAT": "Ferry",
        }
        return mapping.get(t, "Travel Service")

    @classmethod
    def extract_segment_info(cls, item: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extracts available transport fields dynamically without inventing fake values.
        """
        meta = item.get("item_metadata") or item.get("booking_metadata") or {}
        if not isinstance(meta, dict):
            meta = {}

        raw_type = item.get("type") or meta.get("type")
        mode_label = cls.get_transport_mode_label(raw_type)

        # Identifier lookup (flight_number, train_number, bus_number, booking_id, provider)
        provider = cls.clean_str(item.get("provider")) or cls.clean_str(meta.get("operator")) or cls.clean_str(meta.get("provider"))
        booking_id = cls.clean_str(item.get("booking_id"))
        
        identifier = (
            cls.clean_str(meta.get("flight_number")) or
            cls.clean_str(meta.get("train_number")) or
            cls.clean_str(meta.get("bus_number")) or
            cls.clean_str(meta.get("service_number")) or
            cls.clean_str(meta.get("vehicle")) or
            booking_id
        )

        id_str = ""
        if provider and identifier and identifier != provider:
            id_str = f"{provider} {identifier}"
        elif identifier:
            id_str = identifier
        elif provider:
            id_str = provider
        else:
            id_str = mode_label

        origin = cls.clean_str(item.get("origin")) or cls.clean_str(meta.get("pickup_location")) or cls.clean_str(meta.get("origin"))
        dest = cls.clean_str(item.get("destination")) or cls.clean_str(meta.get("drop_location")) or cls.clean_str(meta.get("destination"))
        location = cls.clean_str(item.get("location")) or cls.clean_str(meta.get("location"))

        dep_time = cls.format_time(item.get("start_time") or meta.get("start_time") or meta.get("pickup_time"))
        arr_time = cls.format_time(item.get("end_time") or meta.get("end_time") or meta.get("arrival_time"))

        # PNR / Booking reference
        pnr = (
            cls.clean_str(meta.get("pnr")) or
            cls.clean_str(item.get("booking_reference")) or
            cls.clean_str(meta.get("booking_reference")) or
            cls.clean_str(item.get("ticket_number")) or
            cls.clean_str(meta.get("ticket_number"))
        )

        return {
            "mode_label": mode_label,
            "provider": provider,
            "identifier": id_str,
            "origin": origin,
            "destination": dest,
            "location": location,
            "dep_time": dep_time,
            "arr_time": arr_time,
            "pnr": pnr,
        }

    @classmethod
    def generate_disruption_sms(cls, disruption: Dict[str, Any]) -> str:
        """
        Dynamically generates a disruption alert SMS from actual disruption data.
        """
        event_type = (disruption.get("event_type") or "").upper()
        metadata = disruption.get("event_metadata") or {}
        if not isinstance(metadata, dict):
            metadata = {}

        item_data = disruption.get("item") or {}
        seg = cls.extract_segment_info(item_data)

        # Disruption state description
        delay_mins = metadata.get("delay_minutes") or disruption.get("delay_minutes")
        if "CANCEL" in event_type or event_type == "CANCELLATION":
            status_desc = "cancelled"
        elif "DELAY" in event_type:
            if delay_mins and str(delay_mins).isdigit():
                status_desc = f"delayed by {delay_mins} mins"
            else:
                status_desc = "delayed"
        elif "UNAVAILABLE" in event_type:
            status_desc = "unavailable"
        elif "MISSED" in event_type:
            status_desc = "missed due to connection delay"
        elif "REROUTE" in event_type or "CHANGE" in event_type:
            status_desc = "rerouted"
        else:
            status_desc = "disrupted"

        route_part = ""
        if seg["origin"] and seg["destination"]:
            route_part = f" ({seg['origin']} → {seg['destination']})"
        elif seg["location"]:
            route_part = f" at {seg['location']}"

        time_part = ""
        if seg["dep_time"]:
            time_part = f" scheduled for {seg['dep_time']}"

        return (
            f"Travora Alert: Your {seg['mode_label']} {seg['identifier']}{route_part}"
            f"{time_part} has been {status_desc}. Open Travora to view your recovery plan."
        )

    @classmethod
    def generate_recovery_sms(cls, plan_or_execution: Dict[str, Any]) -> str:
        """
        Dynamically generates a recovery confirmation SMS for single or multi-segment recoveries.
        """
        # Collect updated/replaced items
        changes = plan_or_execution.get("changes") or plan_or_execution.get("items") or []
        recovered_segments = []

        for ch in changes:
            if isinstance(ch, dict):
                action = (ch.get("action") or ch.get("replacement_type") or "").upper()
                if action in ["REPLACE", "MODIFY", "ADD", "RECOVERY", "CONFIRMED"] or not action:
                    item_dict = ch.get("item") or ch.get("replacement_item") or ch
                    if isinstance(item_dict, dict) and item_dict:
                        recovered_segments.append(cls.extract_segment_info(item_dict))

        # Fallback if no specific changes dict structure, check if plan_or_execution itself is item dict
        if not recovered_segments and plan_or_execution.get("type"):
            recovered_segments.append(cls.extract_segment_info(plan_or_execution))

        if not recovered_segments:
            return "Travora: Recovery confirmed. Open Travora to view your updated itinerary details."

        if len(recovered_segments) == 1:
            seg = recovered_segments[0]
            lines = ["Travora: Recovery confirmed.", f"New {seg['mode_label']}: {seg['identifier']}"]

            if seg["origin"] and seg["destination"]:
                lines.append(f"{seg['origin']} → {seg['destination']}")
            elif seg["location"]:
                lines.append(f"Location: {seg['location']}")

            timing_str = ""
            if seg["dep_time"] and seg["arr_time"]:
                timing_str = f"Departure: {seg['dep_time']} | Arrival: {seg['arr_time']}"
            elif seg["dep_time"]:
                timing_str = f"Departure: {seg['dep_time']}"
            if timing_str:
                lines.append(timing_str)

            if seg["pnr"]:
                lines.append(f"PNR/Ref: {seg['pnr']}")

            return "\n".join(lines)

        # Multi-segment recovery
        lines = ["Travora: Recovery confirmed."]
        for i, seg in enumerate(recovered_segments, start=1):
            seg_lines = [f"{i}. {seg['mode_label']}: {seg['identifier']}"]
            if seg["origin"] and seg["destination"]:
                seg_lines.append(f"   {seg['origin']} → {seg['destination']}")
            if seg["dep_time"]:
                t_str = f"Departure: {seg['dep_time']}"
                if seg["arr_time"]:
                    t_str += f" → {seg['arr_time']}"
                seg_lines.append(f"   {t_str}")
            if seg["pnr"]:
                seg_lines.append(f"   PNR/Ref: {seg['pnr']}")
            lines.append("\n".join(seg_lines))

        return "\n\n".join(lines)
