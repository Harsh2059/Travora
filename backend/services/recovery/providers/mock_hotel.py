"""
Mock Hotel Availability Provider
Provides deterministic replacement candidates for hotel nodes.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from .base import BaseAvailabilityProvider


class MockHotelProvider(BaseAvailabilityProvider):
    """
    Mock hotel replacement provider.
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
        
        return [
            {
                "candidate_id": f"cand_ht_{node.get('id')}_1",
                "type": "HOTEL",
                "provider": "Radisson Blu Resort",
                "title": f"Radisson Blu (Repl. for {title})",
                "location": location,
                "startDate": start_date,
                "endDate": end_date,
                "timeStatus": "UNKNOWN",
                "isTimeFlexible": True,
                "cost": 7500,
                "currency": "INR",
                "booking_id": f"RAD-{location[:3].upper()}-990",
                "modification_fee": 300,
                "cancellation_penalty": 0,
                "estimated_refund": 6000,
                "quality_tier": "RECOMMENDED",
                "explanation": f"Seamless stay replacement at Radisson Blu ({location}) matching original dates."
            },
            {
                "candidate_id": f"cand_ht_{node.get('id')}_2",
                "type": "HOTEL",
                "provider": "Hyatt Regency",
                "title": f"Hyatt Regency ({location})",
                "location": location,
                "startDate": start_date,
                "endDate": end_date,
                "timeStatus": "UNKNOWN",
                "isTimeFlexible": True,
                "cost": 9200,
                "currency": "INR",
                "booking_id": f"HYT-{location[:3].upper()}-771",
                "modification_fee": 0,
                "cancellation_penalty": 0,
                "estimated_refund": 6000,
                "quality_tier": "PREMIUM",
                "explanation": f"Luxury stay replacement at Hyatt Regency ({location}) with flexible check-in."
            }
        ]
