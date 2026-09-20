"""
Mock Flight Availability Provider
Provides deterministic replacement candidates for broken or delayed flight nodes.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from .base import BaseAvailabilityProvider


class MockFlightProvider(BaseAvailabilityProvider):
    """
    Mock flight candidate search provider.
    Returns deterministic replacement flights matching origin and destination.
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

        return [
            {
                "candidate_id": f"cand_fl_{node.get('id')}_1",
                "type": "FLIGHT",
                "provider": "Air India Express",
                "title": f"Air India Express (Repl. for {title})",
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
                "booking_id": f"AI-RPL-{c1_start.strftime('%H%M')}",
                "modification_fee": 500,
                "cancellation_penalty": 0,
                "estimated_refund": 3500,
                "quality_tier": "RECOMMENDED",
                "explanation": "Next available flight connecting Mumbai to Punjab without breaking downstream transfers."
            },
            {
                "candidate_id": f"cand_fl_{node.get('id')}_2",
                "type": "FLIGHT",
                "provider": "Vistara Prime",
                "title": f"Vistara Prime (Repl. for {title})",
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
                "booking_id": f"UK-RPL-{c2_start.strftime('%H%M')}",
                "modification_fee": 0,
                "cancellation_penalty": 0,
                "estimated_refund": 3500,
                "quality_tier": "PREMIUM",
                "explanation": "Evening non-stop flight with guaranteed seat allocation."
            }
        ]
