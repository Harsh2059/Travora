"""
Mock Activity / Event Availability Provider
Provides deterministic replacement candidates for activity nodes.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from .base import BaseAvailabilityProvider


class MockActivityProvider(BaseAvailabilityProvider):
    """
    Mock activity replacement provider.
    """

    def search_candidates(
        self,
        node: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        location = node.get("location") or "Gurugram"
        title = node.get("title") or "Activity"
        
        start_date = node.get("startDate") or "2026-09-21"
        
        return [
            {
                "candidate_id": f"cand_ac_{node.get('id')}_1",
                "type": "ACTIVITY",
                "provider": "VIP Pass Entry",
                "title": f"Rescheduled {title}",
                "location": location,
                "startDate": start_date,
                "timeStatus": "UNKNOWN",
                "isTimeFlexible": True,
                "cost": 2800,
                "currency": "INR",
                "booking_id": f"TKT-RPL-{str(node.get('id'))[:4]}",
                "modification_fee": 0,
                "cancellation_penalty": 0,
                "estimated_refund": 2000,
                "quality_tier": "RECOMMENDED",
                "explanation": f"Flex-time entry ticket for {title} in {location} to fit updated travel schedule."
            }
        ]
