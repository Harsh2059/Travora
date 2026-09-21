"""
Mock Cab / Transfer Availability Provider
Provides deterministic replacement candidates for cab / transit nodes.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from .base import BaseAvailabilityProvider, BaseBookingProvider, is_candidate_unavailable


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
        
        ctx = context or {}
        known_unavail = ctx.get("known_unavailable") or node.get("known_unavailable") or []

        cands_raw = [
            {
                "candidate_id": f"cand_cb_{node.get('id')}_ola",
                "type": "CAB",
                "provider": "Ola Outstation",
                "title": f"Ola Outstation (Repl. for {title})",
                "origin": origin,
                "destination": destination,
                "startDate": start_date,
                "timeStatus": "UNKNOWN",
                "isTimeFlexible": True,
                "cost": 750,
                "currency": "INR",
                "booking_id": "CAB-OLA-750",
                "resource_id": "OLA-750",
                "modification_fee": 0,
                "cancellation_penalty": 0,
                "estimated_refund": 500,
                "quality_tier": "RECOMMENDED",
                "explanation": f"Dedicated Ola Outstation cab dispatch for {origin} → {destination}."
            },
            {
                "candidate_id": f"cand_cb_{node.get('id')}_uber",
                "type": "CAB",
                "provider": "Uber Intercity",
                "title": f"Uber Intercity (Repl. for {title})",
                "origin": origin,
                "destination": destination,
                "startDate": start_date,
                "timeStatus": "UNKNOWN",
                "isTimeFlexible": True,
                "cost": 850,
                "currency": "INR",
                "booking_id": "CAB-UBER-850",
                "resource_id": "UBER-850",
                "modification_fee": 0,
                "cancellation_penalty": 0,
                "estimated_refund": 500,
                "quality_tier": "PREMIUM",
                "explanation": f"Uber Executive Intercity cab dispatch for {origin} → {destination}."
            },
            {
                "candidate_id": f"cand_cb_{node.get('id')}_blusmart",
                "type": "CAB",
                "provider": "BluSmart Premier",
                "title": f"BluSmart Premier (Repl. for {title})",
                "origin": origin,
                "destination": destination,
                "startDate": start_date,
                "timeStatus": "UNKNOWN",
                "isTimeFlexible": True,
                "cost": 900,
                "currency": "INR",
                "booking_id": "CAB-BLU-900",
                "resource_id": "BLU-900",
                "modification_fee": 0,
                "cancellation_penalty": 0,
                "estimated_refund": 500,
                "quality_tier": "ECO_PREMIUM",
                "explanation": f"BluSmart EV premier intercity ride for {origin} → {destination}."
            },
            {
                "candidate_id": f"cand_cb_{node.get('id')}_shuttle",
                "type": "CAB",
                "provider": "Station EV Shuttle",
                "title": f"Station EV Shuttle (Repl. for {title})",
                "origin": origin,
                "destination": destination,
                "startDate": start_date,
                "timeStatus": "UNKNOWN",
                "isTimeFlexible": True,
                "cost": 400,
                "currency": "INR",
                "booking_id": "EV-SHUTTLE-400",
                "resource_id": "SHUTTLE-400",
                "modification_fee": 0,
                "cancellation_penalty": 0,
                "estimated_refund": 300,
                "quality_tier": "BUDGET",
                "explanation": f"Scheduled EV Shuttle service connecting {origin} to {destination}."
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

