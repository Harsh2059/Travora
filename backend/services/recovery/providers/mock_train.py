"""
Mock Train / Rail Availability Provider
Provides deterministic replacement candidates for train/metro nodes.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from .base import BaseAvailabilityProvider, BaseBookingProvider, is_candidate_unavailable


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
        is_metro = node.get("type", "").upper() == "METRO" or node.get("transportMode") == "METRO" or "METRO" in str(node.get("title", "")).upper()
        
        ctx = context or {}
        known_unavail = ctx.get("known_unavailable") or node.get("known_unavailable") or []

        start_time_str = node.get("startTime") or node.get("start_time")
        base_dt = datetime.now() + timedelta(days=1)
        if start_time_str:
            try:
                base_dt = datetime.fromisoformat(str(start_time_str).replace("Z", "+00:00"))
            except Exception:
                pass

        if is_metro:
            cands_raw = [
                {
                    "candidate_id": f"cand_tr_{node.get('id')}_dmrc",
                    "type": "METRO",
                    "provider": "DMRC Airport Express Line",
                    "title": f"DMRC Airport Express (Repl. for {title})",
                    "origin": origin,
                    "destination": destination,
                    "start_time": (base_dt + timedelta(minutes=30)).isoformat(),
                    "end_time": (base_dt + timedelta(hours=1, minutes=15)).isoformat(),
                    "startDate": base_dt.strftime("%Y-%m-%d"),
                    "endDate": base_dt.strftime("%Y-%m-%d"),
                    "timeStatus": "FIXED",
                    "isTimeFlexible": False,
                    "transportMode": "METRO",
                    "cost": 80,
                    "currency": "INR",
                    "booking_id": "MTR-DMRC-80",
                    "resource_id": "DMRC-80",
                    "modification_fee": 0,
                    "cancellation_penalty": 0,
                    "estimated_refund": 50,
                    "quality_tier": "RECOMMENDED",
                    "explanation": f"High-frequency DMRC Airport Express service connecting {origin} → {destination}."
                },
                {
                    "candidate_id": f"cand_tr_{node.get('id')}_rapid",
                    "type": "METRO",
                    "provider": "Rapid Metro Line",
                    "title": f"Rapid Metro Line (Repl. for {title})",
                    "origin": origin,
                    "destination": destination,
                    "start_time": (base_dt + timedelta(minutes=45)).isoformat(),
                    "end_time": (base_dt + timedelta(hours=1, minutes=30)).isoformat(),
                    "startDate": base_dt.strftime("%Y-%m-%d"),
                    "endDate": base_dt.strftime("%Y-%m-%d"),
                    "timeStatus": "FIXED",
                    "isTimeFlexible": False,
                    "transportMode": "METRO",
                    "cost": 60,
                    "currency": "INR",
                    "booking_id": "MTR-RAPID-60",
                    "resource_id": "RAPID-60",
                    "modification_fee": 0,
                    "cancellation_penalty": 0,
                    "estimated_refund": 40,
                    "quality_tier": "BUDGET",
                    "explanation": f"Rapid Metro Line service connecting {origin} → {destination}."
                }
            ]
        else:
            cands_raw = [
                {
                    "candidate_id": f"cand_tr_{node.get('id')}_vb",
                    "type": "TRAIN",
                    "provider": "Vande Bharat Express",
                    "title": f"Vande Bharat Express (Repl. for {title})",
                    "origin": origin,
                    "destination": destination,
                    "start_time": (base_dt + timedelta(hours=1, minutes=15)).isoformat(),
                    "end_time": (base_dt + timedelta(hours=4, minutes=45)).isoformat(),
                    "startDate": base_dt.strftime("%Y-%m-%d"),
                    "endDate": base_dt.strftime("%Y-%m-%d"),
                    "timeStatus": "FIXED",
                    "isTimeFlexible": False,
                    "cost": 1650,
                    "currency": "INR",
                    "booking_id": "VB-20977",
                    "resource_id": "VB-20977",
                    "modification_fee": 150,
                    "cancellation_penalty": 0,
                    "estimated_refund": 1200,
                    "quality_tier": "RECOMMENDED",
                    "explanation": f"Premium Vande Bharat Express connecting {origin} → {destination}."
                },
                {
                    "candidate_id": f"cand_tr_{node.get('id')}_tejas",
                    "type": "TRAIN",
                    "provider": "Tejas Express",
                    "title": f"Tejas Express (Repl. for {title})",
                    "origin": origin,
                    "destination": destination,
                    "start_time": (base_dt + timedelta(hours=2, minutes=30)).isoformat(),
                    "end_time": (base_dt + timedelta(hours=6)).isoformat(),
                    "startDate": base_dt.strftime("%Y-%m-%d"),
                    "endDate": base_dt.strftime("%Y-%m-%d"),
                    "timeStatus": "FIXED",
                    "isTimeFlexible": False,
                    "cost": 1400,
                    "currency": "INR",
                    "booking_id": "TEJ-82901",
                    "resource_id": "TEJ-82901",
                    "modification_fee": 100,
                    "cancellation_penalty": 0,
                    "estimated_refund": 1000,
                    "quality_tier": "PREMIUM",
                    "explanation": f"High-speed Tejas Express connecting {origin} → {destination} with onboard catering."
                },
                {
                    "candidate_id": f"cand_tr_{node.get('id')}_sht",
                    "type": "TRAIN",
                    "provider": "Shatabdi Express",
                    "title": f"Shatabdi Express (Repl. for {title})",
                    "origin": origin,
                    "destination": destination,
                    "start_time": (base_dt + timedelta(hours=3, minutes=45)).isoformat(),
                    "end_time": (base_dt + timedelta(hours=7, minutes=30)).isoformat(),
                    "startDate": base_dt.strftime("%Y-%m-%d"),
                    "endDate": base_dt.strftime("%Y-%m-%d"),
                    "timeStatus": "FIXED",
                    "isTimeFlexible": False,
                    "cost": 1100,
                    "currency": "INR",
                    "booking_id": "SHT-12015",
                    "resource_id": "SHT-12015",
                    "modification_fee": 100,
                    "cancellation_penalty": 0,
                    "estimated_refund": 800,
                    "quality_tier": "BUDGET",
                    "explanation": f"Shatabdi Express service connecting {origin} → {destination}."
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

