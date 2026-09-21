"""
Mock Activity / Event Availability Provider
Provides deterministic replacement candidates for activity nodes.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from .base import BaseAvailabilityProvider, is_candidate_unavailable


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
        
        ctx = context or {}
        known_unavail = ctx.get("known_unavailable") or node.get("known_unavailable") or []

        cands_raw = [
            {
                "candidate_id": f"cand_ac_{node.get('id')}_twilight",
                "type": "ACTIVITY",
                "provider": "Guided Twilight Walk",
                "title": f"Guided Twilight Walk (Repl. for {title})",
                "location": location,
                "startDate": start_date,
                "timeStatus": "UNKNOWN",
                "isTimeFlexible": True,
                "cost": 1200,
                "currency": "INR",
                "booking_id": "ACT-AMBER-601",
                "resource_id": "ACT-AMBER-601",
                "modification_fee": 100,
                "cancellation_penalty": 0,
                "estimated_refund": 1000,
                "quality_tier": "RECOMMENDED",
                "explanation": f"Guided Twilight Walk in {location} to fit updated travel schedule."
            },
            {
                "candidate_id": f"cand_ac_{node.get('id')}_heritage",
                "type": "ACTIVITY",
                "provider": "Cultural Heritage Tour",
                "title": f"Cultural Heritage Tour (Repl. for {title})",
                "location": location,
                "startDate": start_date,
                "timeStatus": "UNKNOWN",
                "isTimeFlexible": True,
                "cost": 950,
                "currency": "INR",
                "booking_id": "ACT-CITY-602",
                "resource_id": "ACT-CITY-602",
                "modification_fee": 0,
                "cancellation_penalty": 0,
                "estimated_refund": 800,
                "quality_tier": "RECOMMENDED",
                "explanation": f"Cultural Heritage Tour ticket in {location} with flexible arrival."
            }
        ]

        valid_cands = [c for c in cands_raw if not is_candidate_unavailable(c, known_unavail)]
        
        node_booking_id = str(node.get("booking_id") or "").strip().lower()
        if node_booking_id:
            valid_cands = [c for c in valid_cands if str(c.get("booking_id") or "").strip().lower() != node_booking_id]

        return valid_cands

