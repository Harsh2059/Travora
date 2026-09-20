"""
Mock Hotel Availability Provider
Provides deterministic replacement candidates for hotel nodes.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from .base import BaseAvailabilityProvider, BaseBookingProvider


class MockHotelProvider(BaseAvailabilityProvider, BaseBookingProvider):
    """
    Mock hotel replacement search and booking execution provider.
    """

    def search_candidates(
        self,
        node: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        location = node.get("location") or node.get("destination") or "Noida"
        title = node.get("title") or "Hotel"
        
        start_date = node.get("startDate") or "2026-09-20"
        end_date = node.get("endDate") or "2026-09-22"
        
        orig_provider = str(node.get("provider") or node.get("title") or "").strip()
        p_low = orig_provider.lower()
        
        if "taj" in p_low:
            h1_name = "Oberoi Grand"
            h2_name = "ITC Maurya"
        elif "radisson" in p_low:
            h1_name = "JW Marriott"
            h2_name = "Hyatt Regency"
        elif "hyatt" in p_low:
            h1_name = "Radisson Blu Resort"
            h2_name = "Taj Palace"
        elif "ram" in p_low or "hotel ram" in p_low:
            h1_name = "Radisson Blu Resort"
            h2_name = "Hyatt Regency"
        else:
            h1_name = f"Radisson Blu ({location})" if "radisson" not in p_low else f"JW Marriott ({location})"
            h2_name = f"Hyatt Regency ({location})" if "hyatt" not in p_low else f"Taj Palace ({location})"

        return [
            {
                "candidate_id": f"cand_ht_{node.get('id')}_1",
                "type": "HOTEL",
                "provider": h1_name,
                "title": f"{h1_name} (Repl. for {title})",
                "location": location,
                "startDate": start_date,
                "endDate": end_date,
                "timeStatus": "UNKNOWN",
                "isTimeFlexible": True,
                "cost": 7500,
                "currency": "INR",
                "booking_id": f"HTL-{location[:3].upper()}-990",
                "modification_fee": 300,
                "cancellation_penalty": 0,
                "estimated_refund": 6000,
                "quality_tier": "RECOMMENDED",
                "explanation": f"Seamless stay replacement at {h1_name} ({location}) matching original dates."
            },
            {
                "candidate_id": f"cand_ht_{node.get('id')}_2",
                "type": "HOTEL",
                "provider": h2_name,
                "title": f"{h2_name} ({location})",
                "location": location,
                "startDate": start_date,
                "endDate": end_date,
                "timeStatus": "UNKNOWN",
                "isTimeFlexible": True,
                "cost": 9200,
                "currency": "INR",
                "booking_id": f"HTL-{location[:3].upper()}-771",
                "modification_fee": 0,
                "cancellation_penalty": 0,
                "estimated_refund": 6000,
                "quality_tier": "PREMIUM",
                "explanation": f"Luxury stay replacement at {h2_name} ({location}) with flexible check-in."
            }
        ]

    def revalidate(
        self,
        change: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        cost = change.get("estimated_cost") or change.get("cost") or 7500.0
        is_available = not bool(change.get("simulated_unavailable", False))
        
        return {
            "available": is_available,
            "current_price": float(cost),
            "currency": "INR",
            "provider": change.get("provider") or "MockHotelProvider",
            "checked_at": datetime.utcnow().isoformat() + "Z",
            "booking_conditions": "Free cancellation up to 24h prior to check-in."
        }

    def book(
        self,
        change: Dict[str, Any],
        traveler_details: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        node_id_str = str(change.get("node_id") or "1")
        title_str = str(change.get("new_title") or change.get("title") or "Hotel")
        
        h_val = abs(hash(f"{node_id_str}_{title_str}"))
        code_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        code_suffix = "".join(code_chars[(h_val // (36**i)) % 36] for i in range(6))
        confirmation_num = f"HTL-{code_suffix}"
        
        provider_name = change.get("provider") or ("Hotel ABC" if "ABC" in title_str else "Radisson Blu Resort")
        cost = float(change.get("estimated_cost") or change.get("cost") or 7500.0)
        
        return {
            "success": True,
            "status": "BOOKED",
            "booking": {
                "booking_reference": confirmation_num,
                "confirmation_number": confirmation_num,
                "provider": provider_name,
                "hotel_name": provider_name,
                "guest_name": "Traveler (Demo User)",
                "room_type": "Deluxe Room",
                "check_in": change.get("startDate") or "2026-09-20",
                "check_out": change.get("endDate") or "2026-09-22",
                "number_of_nights": 2,
                "number_of_guests": 2,
                "final_price": cost,
                "currency": "INR",
                "booking_status": "CONFIRMED",
                "booked_at": datetime.utcnow().isoformat() + "Z"
            }
        }

