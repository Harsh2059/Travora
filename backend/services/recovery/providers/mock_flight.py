"""
Mock Flight Availability Provider
Provides deterministic replacement candidates for broken or delayed flight nodes.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from .base import BaseAvailabilityProvider, BaseBookingProvider


class MockFlightProvider(BaseAvailabilityProvider, BaseBookingProvider):
    """
    Mock flight candidate search and booking execution provider.
    Returns deterministic replacement flights and booking confirmations.
    """

    def search_candidates(
        self,
        node: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        origin = node.get("origin") or "Mumbai Airport"
        destination = node.get("destination") or "Punjab"
        title = node.get("title") or "Flight"
        
        # Calculate baseline start time
        start_time_str = node.get("startTime") or node.get("start_time")
        base_dt = datetime.now() + timedelta(days=1)
        if start_time_str:
            try:
                base_dt = datetime.fromisoformat(str(start_time_str).replace("Z", "+00:00"))
            except Exception:
                pass
        
        # Candidate 1: Next available flight (same day, +3.5h departure)
        c1_start = base_dt + timedelta(hours=3, minutes=30)
        c1_end = c1_start + timedelta(hours=2, minutes=30)
        
        # Candidate 2: Evening express flight (+6h departure)
        c2_start = base_dt + timedelta(hours=6)
        c2_end = c2_start + timedelta(hours=2, minutes=20)

        orig_provider = str(node.get("provider") or node.get("title") or "").strip()

        # Dynamic selection matrix based on original provider
        if "indigo" in orig_provider.lower():
            p1_name = "Air India Express"
            p2_name = "Akasa Air"
        elif "air india" in orig_provider.lower():
            p1_name = "Indigo"
            p2_name = "Vistara Prime"
        elif "british" in orig_provider.lower() or "ba" in orig_provider.lower():
            p1_name = "Virgin Atlantic"
            p2_name = "Air India International"
        elif "emirates" in orig_provider.lower() or "qatar" in orig_provider.lower():
            p1_name = "Etihad Airways"
            p2_name = "Gulf Air"
        elif "vistara" in orig_provider.lower():
            p1_name = "Air India Express"
            p2_name = "Indigo"
        elif "spicejet" in orig_provider.lower() or "akasa" in orig_provider.lower():
            p1_name = "Indigo"
            p2_name = "Air India Express"
        else:
            base_p = orig_provider if orig_provider and orig_provider.lower() not in ["flight", "booking", "leg"] else "Express Airline"
            p1_name = f"{base_p} Express"
            p2_name = f"{base_p} Prime"

        return [
            {
                "candidate_id": f"cand_fl_{node.get('id')}_1",
                "type": "FLIGHT",
                "provider": p1_name,
                "title": f"{p1_name} (Repl. for {title})",
                "origin": origin,
                "destination": destination,
                "start_time": c1_start.isoformat(),
                "end_time": c1_end.isoformat(),
                "startDate": c1_start.strftime("%Y-%m-%d"),
                "endDate": c1_end.strftime("%Y-%m-%d"),
                "timeStatus": "FIXED",
                "isTimeFlexible": False,
                "cost": 4800,
                "currency": "INR",
                "booking_id": f"FL-RPL-{c1_start.strftime('%H%M')}",
                "modification_fee": 500,
                "cancellation_penalty": 0,
                "estimated_refund": 3500,
                "quality_tier": "RECOMMENDED",
                "explanation": f"Next available non-stop flight connecting {origin} to {destination} without breaking downstream transfers."
            },
            {
                "candidate_id": f"cand_fl_{node.get('id')}_2",
                "type": "FLIGHT",
                "provider": p2_name,
                "title": f"{p2_name} (Repl. for {title})",
                "origin": origin,
                "destination": destination,
                "start_time": c2_start.isoformat(),
                "end_time": c2_end.isoformat(),
                "startDate": c2_start.strftime("%Y-%m-%d"),
                "endDate": c2_end.strftime("%Y-%m-%d"),
                "timeStatus": "FIXED",
                "isTimeFlexible": False,
                "cost": 5900,
                "currency": "INR",
                "booking_id": f"FL-RPL-{c2_start.strftime('%H%M')}",
                "modification_fee": 0,
                "cancellation_penalty": 0,
                "estimated_refund": 3500,
                "quality_tier": "PREMIUM",
                "explanation": f"Evening express flight connecting {origin} to {destination} with guaranteed seat allocation."
            }
        ]

    def revalidate(
        self,
        change: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Revalidate flight replacement availability and current price."""
        cost = change.get("estimated_cost") or change.get("cost") or 4800.0
        # Allow simulated unavailable check via context or item_metadata if requested
        is_available = not bool(change.get("simulated_unavailable", False))
        
        return {
            "available": is_available,
            "current_price": float(cost),
            "currency": "INR",
            "provider": change.get("provider") or "MockFlightProvider",
            "checked_at": datetime.utcnow().isoformat() + "Z",
            "booking_conditions": "Instant confirmation. Includes 15kg check-in baggage."
        }

    def book(
        self,
        change: Dict[str, Any],
        traveler_details: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Execute deterministic mock flight booking."""
        node_id_str = str(change.get("node_id") or "1")
        new_details = change.get("new_details") or {}
        title_str = str(
            change.get("new_title")
            or new_details.get("title")
            or change.get("title")
            or "Flight"
        )

        # Prefer explicit candidate provider — never infer from title text
        # (titles embed "Repl. for <original>" and substring matching corrupts airline).
        provider_name = (
            change.get("provider")
            or new_details.get("provider")
            or new_details.get("airline")
        )
        if not provider_name:
            # Last-resort: leading token of new_title before " (Repl." / " ("
            base = title_str.split(" (Repl.")[0].split(" (")[0].strip()
            provider_name = base if base and base.lower() != "flight" else "Express Airline"

        cost = float(
            change.get("estimated_cost")
            or new_details.get("cost")
            or change.get("cost")
            or 4800.0
        )
        
        # Deterministic PNR generation matching provider
        h_val = abs(hash(f"{node_id_str}_{title_str}"))
        pnr_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        pnr_suffix = "".join(pnr_chars[(h_val // (36**i)) % 36] for i in range(4))
        
        p_low = provider_name.lower()
        if "indigo" in p_low:
            pnr_prefix = "6E"
            fl_number = f"6E {200 + (h_val % 700)}"
        elif "vistara" in p_low:
            pnr_prefix = "UK"
            fl_number = f"UK {900 + (h_val % 90)}"
        elif "akasa" in p_low:
            pnr_prefix = "QP"
            fl_number = f"QP {1100 + (h_val % 90)}"
        elif "air india" in p_low:
            pnr_prefix = "AIX"
            fl_number = f"IX {140 + (h_val % 50)}"
        elif "british" in p_low or "ba" in p_low:
            pnr_prefix = "BA"
            fl_number = f"BA {100 + (h_val % 80)}"
        elif "virgin" in p_low:
            pnr_prefix = "VS"
            fl_number = f"VS {300 + (h_val % 50)}"
        else:
            pnr_prefix = "FL"
            fl_number = f"FL {500 + (h_val % 400)}"

        pnr = f"{pnr_prefix}{pnr_suffix}"[:7]
        ticket_num = f"098-{1000000000 + (h_val % 8999999999)}"
        
        return {
            "success": True,
            "status": "BOOKED",
            "booking": {
                "booking_reference": pnr,
                "pnr": pnr,
                "ticket_number": ticket_num,
                "provider": provider_name,
                "airline": provider_name,
                "flight_number": fl_number,
                "seat": "14A",
                "cabin_class": "Economy",
                "origin": change.get("origin") or "Mumbai Airport (BOM)",
                "destination": change.get("destination") or "Punjab",
                "departure_time": change.get("start_time") or (datetime.utcnow() + timedelta(hours=4)).isoformat() + "Z",
                "arrival_time": change.get("end_time") or (datetime.utcnow() + timedelta(hours=6, minutes=30)).isoformat() + "Z",
                "passenger_name": "Traveler (Demo User)",
                "final_price": cost,
                "currency": "INR",
                "booking_status": "CONFIRMED",
                "booked_at": datetime.utcnow().isoformat() + "Z"
            }
        }

