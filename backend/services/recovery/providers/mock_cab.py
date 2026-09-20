"""
Mock Cab / Transfer Availability Provider
Provides deterministic replacement candidates for cab / transit nodes.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from .base import BaseAvailabilityProvider, BaseBookingProvider


class MockCabProvider(BaseAvailabilityProvider, BaseBookingProvider):
    """
    Mock cab replacement provider.
    """

    def search_candidates(
        self,
        node: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        origin = node.get("origin") or "Punjab"
        destination = node.get("destination") or "Noida"
        title = node.get("title") or "Cab"
        
        start_date = node.get("startDate") or "2026-09-20"
        
        orig_provider = str(node.get("provider") or node.get("title") or "").strip()
        p_low = orig_provider.lower()
        
        if "uber" in p_low:
            cab_provider = "Ola Outstation"
        elif "ola" in p_low:
            cab_provider = "Uber Executive Intercity"
        elif "blusmart" in p_low:
            cab_provider = "Uber Intercity"
        else:
            cab_provider = "Uber Intercity" if "Ola" in orig_provider else "Ola Outstation"

        return [
            {
                "candidate_id": f"cand_cb_{node.get('id')}_1",
                "type": "CAB",
                "provider": cab_provider,
                "title": f"{cab_provider} (Repl. for {title})",
                "origin": origin,
                "destination": destination,
                "startDate": start_date,
                "timeStatus": "UNKNOWN",
                "isTimeFlexible": True,
                "cost": 750,
                "currency": "INR",
                "booking_id": f"CAB-RPL-{str(node.get('id'))[:4]}",
                "modification_fee": 0,
                "cancellation_penalty": 0,
                "estimated_refund": 500,
                "quality_tier": "RECOMMENDED",
                "explanation": f"Dedicated intercity cab dispatch ({cab_provider}) for {origin} → {destination} with flexible pick-up time."
            }
        ]

    def revalidate(
        self,
        change: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        cost = change.get("estimated_cost") or change.get("cost") or 750.0
        is_available = not bool(change.get("simulated_unavailable", False))
        
        return {
            "available": is_available,
            "current_price": float(cost),
            "currency": "INR",
            "provider": change.get("provider") or "MockCabProvider",
            "checked_at": datetime.utcnow().isoformat() + "Z",
            "booking_conditions": "Driver dispatched 30 mins prior to departure. Guaranteed lock."
        }

    def book(
        self,
        change: Dict[str, Any],
        traveler_details: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        node_id_str = str(change.get("node_id") or "1")
        title_str = str(change.get("new_title") or change.get("title") or "Cab")
        
        h_val = abs(hash(f"{node_id_str}_{title_str}"))
        code_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        code_suffix = "".join(code_chars[(h_val // (36**i)) % 36] for i in range(6))
        booking_ref = f"CAB-{code_suffix}"
        
        provider_name = change.get("provider") or "Uber Executive Intercity"
        cost = float(change.get("estimated_cost") or change.get("cost") or 750.0)
        
        return {
            "success": True,
            "status": "BOOKED",
            "booking": {
                "booking_reference": booking_ref,
                "provider": provider_name,
                "vehicle_category": "Sedan",
                "origin": change.get("origin") or "Mumbai Airport",
                "destination": change.get("destination") or "Punjab",
                "passenger_name": "Traveler (Demo User)",
                "final_price": cost,
                "currency": "INR",
                "booking_status": "CONFIRMED",
                "booked_at": datetime.utcnow().isoformat() + "Z"
            }
        }

