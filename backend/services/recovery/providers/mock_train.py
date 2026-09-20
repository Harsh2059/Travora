"""
Mock Train / Rail Availability Provider
Provides deterministic replacement candidates for train/metro nodes.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from .base import BaseAvailabilityProvider, BaseBookingProvider


class MockTrainProvider(BaseAvailabilityProvider, BaseBookingProvider):
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
        
        orig_provider = str(node.get("provider") or node.get("title") or "").strip()
        p_low = orig_provider.lower()

        if is_metro:
            if "rapid" in p_low:
                provider_name = "DMRC Airport Express Line"
            else:
                provider_name = "Rapid Metro Express"
        else:
            if "vande" in p_low:
                provider_name = "Rajdhani Express"
            elif "rajdhani" in p_low:
                provider_name = "Vande Bharat Express"
            elif "shatabdi" in p_low:
                provider_name = "Tejas Express"
            else:
                provider_name = "Vande Bharat Express" if "Rajdhani" not in orig_provider else "Rajdhani Express"

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

    def revalidate(
        self,
        change: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        cost = change.get("estimated_cost") or change.get("cost") or 1200.0
        is_available = not bool(change.get("simulated_unavailable", False))
        
        return {
            "available": is_available,
            "current_price": float(cost),
            "currency": "INR",
            "provider": change.get("provider") or "MockTrainProvider",
            "checked_at": datetime.utcnow().isoformat() + "Z",
            "booking_conditions": "Confirmed seat allocation with IRCTC / Rail operator."
        }

    def book(
        self,
        change: Dict[str, Any],
        traveler_details: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        node_id_str = str(change.get("node_id") or "1")
        title_str = str(change.get("new_title") or change.get("title") or "Train")
        is_metro = "Metro" in title_str or change.get("transportMode") == "METRO"
        
        h_val = abs(hash(f"{node_id_str}_{title_str}"))
        pnr = f"MTR-{h_val % 89999 + 10000}" if is_metro else str(2410000000 + (h_val % 899999999))
        
        provider_name = change.get("provider") or ("Rapid Metro Line" if is_metro else "Vande Bharat Express")
        cost = float(change.get("estimated_cost") or change.get("cost") or (80.0 if is_metro else 1200.0))
        
        return {
            "success": True,
            "status": "BOOKED",
            "booking": {
                "booking_reference": pnr,
                "pnr": pnr,
                "provider": provider_name,
                "train_name": provider_name,
                "train_number": "12951" if not is_metro else "MTR-LINE-2",
                "coach": "B2" if not is_metro else "C1",
                "class": "2A" if not is_metro else "Metro Pass",
                "seat_or_berth": "34 (Side Lower)" if not is_metro else "Open Seating",
                "origin": change.get("origin") or "Noida",
                "destination": change.get("destination") or "Gurugram",
                "departure_time": change.get("start_time") or datetime.utcnow().isoformat() + "Z",
                "arrival_time": change.get("end_time") or (datetime.utcnow() + timedelta(hours=2)).isoformat() + "Z",
                "passenger_name": "Traveler (Demo User)",
                "final_price": cost,
                "currency": "INR",
                "booking_status": "CONFIRMED",
                "booked_at": datetime.utcnow().isoformat() + "Z"
            }
        }

