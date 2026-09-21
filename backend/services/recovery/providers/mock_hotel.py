"""
Mock Hotel Availability Provider
Provides deterministic replacement candidates for hotel nodes.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from .base import BaseAvailabilityProvider, BaseBookingProvider, is_candidate_unavailable


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
        
        ctx = context or {}
        known_unavail = ctx.get("known_unavailable") or node.get("known_unavailable") or []

        cands_raw = [
            {
                "candidate_id": f"cand_ht_{node.get('id')}_court",
                "type": "HOTEL",
                "provider": "Courtyard Convention Hotel",
                "title": f"Courtyard Convention Hotel (Repl. for {title})",
                "location": location,
                "startDate": start_date,
                "endDate": end_date,
                "timeStatus": "UNKNOWN",
                "isTimeFlexible": True,
                "cost": 14200,
                "currency": "INR",
                "booking_id": "HTL-COURT-402",
                "resource_id": "HTL-COURT-402",
                "modification_fee": 200,
                "cancellation_penalty": 0,
                "estimated_refund": 10000,
                "quality_tier": "RECOMMENDED",
                "explanation": f"Business convention stay replacement at Courtyard Convention ({location})."
            },
            {
                "candidate_id": f"cand_ht_{node.get('id')}_grand",
                "type": "HOTEL",
                "provider": "Heritage Grand Palace",
                "title": f"Heritage Grand Palace (Repl. for {title})",
                "location": location,
                "startDate": start_date,
                "endDate": end_date,
                "timeStatus": "UNKNOWN",
                "isTimeFlexible": True,
                "cost": 18500,
                "currency": "INR",
                "booking_id": "HTL-GRAND-401",
                "resource_id": "HTL-GRAND-401",
                "modification_fee": 300,
                "cancellation_penalty": 0,
                "estimated_refund": 10000,
                "quality_tier": "PREMIUM",
                "explanation": f"Luxury stay replacement at Heritage Grand Palace ({location})."
            },
            {
                "candidate_id": f"cand_ht_{node.get('id')}_marriott",
                "type": "HOTEL",
                "provider": "Marriott Business Hotel",
                "title": f"Marriott Business Hotel (Repl. for {title})",
                "location": location,
                "startDate": start_date,
                "endDate": end_date,
                "timeStatus": "UNKNOWN",
                "isTimeFlexible": True,
                "cost": 16000,
                "currency": "INR",
                "booking_id": "HTL-MARRIOTT-503",
                "resource_id": "HTL-MARRIOTT-503",
                "modification_fee": 0,
                "cancellation_penalty": 0,
                "estimated_refund": 10000,
                "quality_tier": "PREMIUM",
                "explanation": f"Executive stay replacement at Marriott Business Hotel ({location})."
            }
        ]

        valid_cands = [c for c in cands_raw if not is_candidate_unavailable(c, known_unavail)]
        
        node_booking_id = str(node.get("booking_id") or "").strip().lower()
        if node_booking_id:
            valid_cands = [c for c in valid_cands if str(c.get("booking_id") or "").strip().lower() != node_booking_id]

        return valid_cands


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

