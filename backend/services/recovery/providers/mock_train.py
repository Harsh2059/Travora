"""
Mock Train / Rail Availability Provider
Provides deterministic replacement candidates for train/metro nodes.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from .base import BaseAvailabilityProvider


class MockTrainProvider(BaseAvailabilityProvider):
    """
    Mock train/metro replacement provider.
    """

    def search_candidates(
        self,
        node: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        origin = node.get("origin") or "Noida"
        destination = node.get("destination") or "Gurugram"
        title = node.get("title") or "Train"
        is_metro = node.get("type", "").upper() == "METRO" or node.get("transportMode") == "METRO"
        
        start_time_str = node.get("startTime") or node.get("start_time")
        base_dt = datetime.now() + timedelta(days=1)
        if start_time_str:
            try:
                base_dt = datetime.fromisoformat(str(start_time_str).replace("Z", "+00:00"))
            except Exception:
                pass
                
        c1_start = base_dt + timedelta(minutes=45)
        c1_end = c1_start + timedelta(hours=1, minutes=30)
        
        provider_name = "Rapid Metro Line" if is_metro else "Vande Bharat Express"
        
        return [
            {
                "candidate_id": f"cand_tr_{node.get('id')}_1",
                "type": "TRAIN",
                "provider": provider_name,
                "title": f"{provider_name} (Repl. for {title})",
                "origin": origin,
                "destination": destination,
                "start_time": c1_start.isoformat(),
                "end_time": c1_end.isoformat(),
                "startDate": c1_start.strftime("%Y-%m-%d"),
                "endDate": c1_end.strftime("%Y-%m-%d"),
                "timeStatus": "FIXED",
                "isTimeFlexible": False,
                "transportMode": "METRO" if is_metro else None,
                "cost": 80 if is_metro else 1200,
                "currency": "INR",
                "booking_id": f"RL-RPL-{c1_start.strftime('%H%M')}",
                "modification_fee": 0,
                "cancellation_penalty": 0,
                "estimated_refund": 50 if is_metro else 800,
                "quality_tier": "RECOMMENDED",
                "explanation": f"Adjusted {provider_name} service connecting {origin} → {destination} aligned with updated schedule."
            }
        ]
