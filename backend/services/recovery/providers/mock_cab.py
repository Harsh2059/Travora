"""
Mock Cab / Transfer Availability Provider
Provides deterministic replacement candidates for cab / transit nodes.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from .base import BaseAvailabilityProvider


class MockCabProvider(BaseAvailabilityProvider):
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
        
        return [
            {
                "candidate_id": f"cand_cb_{node.get('id')}_1",
                "type": "CAB",
                "provider": "Uber Executive Intercity",
                "title": f"Uber Intercity (Repl. for {title})",
                "origin": origin,
                "destination": destination,
                "startDate": start_date,
                "timeStatus": "UNKNOWN",
                "isTimeFlexible": True,
                "cost": 750,
                "currency": "INR",
                "booking_id": f"UBR-RPL-{node.get('id')[:4]}",
                "modification_fee": 0,
                "cancellation_penalty": 0,
                "estimated_refund": 500,
                "quality_tier": "RECOMMENDED",
                "explanation": f"Dedicated intercity cab dispatch for {origin} → {destination} with flexible pick-up time."
            }
        ]
