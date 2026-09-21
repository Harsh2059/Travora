from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

class AvailabilityProvider(ABC):
    """
    Abstract interface for travel inventory and availability lookup.
    Keeps architecture ready for real GDS/OTA provider APIs.
    """

    @abstractmethod
    def find_alternate_flights(
        self, origin: str, destination: str, after_time: datetime, max_results: int = 5
    ) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def find_alternate_trains(
        self, origin: str, destination: str, after_time: datetime, max_results: int = 5
    ) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def find_alternate_hotels(
        self, location: str, check_in: datetime, check_out: datetime, max_results: int = 5
    ) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def find_alternate_transfers(
        self, pickup: str, dropoff: str, pickup_time: datetime, max_results: int = 5
    ) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def find_alternate_activities(
        self, location: str, target_date: datetime, max_results: int = 5
    ) -> List[Dict[str, Any]]:
        pass


class MockAvailabilityProvider(AvailabilityProvider):
    """
    Structured multi-modal mock inventory provider supporting realistic
    flights, trains, hotels, transfers, and activities with deterministic schedules.
    """

    def find_alternate_flights(
        self, origin: str, destination: str, after_time: datetime, max_results: int = 5
    ) -> List[Dict[str, Any]]:
        try:
            from services.recovery.flight_inventory import search_route_inventory
            from services.recovery.airports import resolve_airport_code, airport_label
            
            orig_code = resolve_airport_code(origin, role="origin") or "BOM"
            dest_code = resolve_airport_code(destination, role="destination") or "ATQ"
            travel_date = after_time.date() if isinstance(after_time, datetime) else datetime.utcnow().date()
            
            cands = search_route_inventory(orig_code, dest_code, travel_date)
            results = []
            for idx, c in enumerate(cands[:max_results]):
                dep_dt = datetime.fromisoformat(c["departure_time"])
                arr_dt = datetime.fromisoformat(c["arrival_time"])
                results.append({
                    "id": 200 + idx + 1,
                    "type": "FLIGHT",
                    "provider": c["provider"],
                    "flight_number": c["flight_number"],
                    "origin": airport_label(orig_code),
                    "destination": airport_label(dest_code),
                    "origin_airport": orig_code,
                    "destination_airport": dest_code,
                    "start_time": dep_dt,
                    "end_time": arr_dt,
                    "departure_time": c["departure_time"],
                    "arrival_time": c["arrival_time"],
                    "cost": c["price"],
                    "currency": "INR",
                    "priority": "HIGH",
                    "flexibility": "FLEXIBLE",
                    "status": "CONFIRMED",
                    "booking_id": c.get("booking_id") or c.get("flight_number"),
                    "available": True,
                    "refundable": True,
                    "refund_percentage": 85.0,
                    "changeable": True,
                    "change_fee": float(c.get("modification_fee", 200)),
                    "cancellation_fee": float(c.get("cancellation_penalty", 0)),
                })
            if results:
                return results
        except Exception:
            pass

        # Fallback if inventory lookup unavailable
        return []


    def find_alternate_trains(
        self, origin: str, destination: str, after_time: datetime, max_results: int = 5
    ) -> List[Dict[str, Any]]:
        results = [
            {
                "id": 301,
                "type": "TRAIN",
                "provider": "Vande Bharat Superfast Express",
                "origin": origin,
                "destination": destination,
                "start_time": after_time + timedelta(hours=1, minutes=15),
                "end_time": after_time + timedelta(hours=4, minutes=45),
                "cost": 1650,
                "currency": "INR",
                "priority": "HIGH",
                "flexibility": "FLEXIBLE",
                "status": "CONFIRMED",
                "booking_id": "VB-20977",
                "available": True,
                "refundable": True,
                "refund_percentage": 90.0,
                "changeable": True,
                "change_fee": 150.0,
                "cancellation_fee": 200.0,
            },
            {
                "id": 302,
                "type": "TRAIN",
                "provider": "Shatabdi Express",
                "origin": origin,
                "destination": destination,
                "start_time": after_time + timedelta(hours=2, minutes=45),
                "end_time": after_time + timedelta(hours=6, minutes=50),
                "cost": 1100,
                "currency": "INR",
                "priority": "HIGH",
                "flexibility": "FLEXIBLE",
                "status": "CONFIRMED",
                "booking_id": "SHT-12015",
                "available": True,
                "refundable": True,
                "refund_percentage": 80.0,
                "changeable": True,
                "change_fee": 100.0,
                "cancellation_fee": 250.0,
            },
            {
                "id": 303,
                "type": "TRAIN",
                "provider": "Intercity Overnight Superfast",
                "origin": origin,
                "destination": destination,
                "start_time": after_time + timedelta(hours=5),
                "end_time": after_time + timedelta(hours=9, minutes=30),
                "cost": 650,
                "currency": "INR",
                "priority": "MEDIUM",
                "flexibility": "FLEXIBLE",
                "status": "CONFIRMED",
                "booking_id": "IC-12414",
                "available": True,
                "refundable": True,
                "refund_percentage": 70.0,
                "changeable": True,
                "change_fee": 50.0,
                "cancellation_fee": 150.0,
            },
        ]
        return results[:max_results]

    def find_alternate_hotels(
        self, location: str, check_in: datetime, check_out: datetime, max_results: int = 5
    ) -> List[Dict[str, Any]]:
        results = [
            {
                "id": 401,
                "type": "HOTEL",
                "provider": "Jaipur Heritage Grand Palace",
                "location": location,
                "start_time": check_in,
                "end_time": check_out,
                "cost": 18500,
                "currency": "INR",
                "priority": "MEDIUM",
                "flexibility": "FLEXIBLE",
                "status": "CONFIRMED",
                "booking_id": "HTL-GRAND-401",
                "available": True,
                "refundable": True,
                "refund_percentage": 85.0,
                "changeable": True,
                "change_fee": 300.0,
                "cancellation_fee": 1000.0,
            },
            {
                "id": 402,
                "type": "HOTEL",
                "provider": "Courtyard Convention Hotel",
                "location": location,
                "start_time": check_in,
                "end_time": check_out,
                "cost": 14200,
                "currency": "INR",
                "priority": "MEDIUM",
                "flexibility": "FLEXIBLE",
                "status": "CONFIRMED",
                "booking_id": "HTL-COURT-402",
                "available": True,
                "refundable": True,
                "refund_percentage": 90.0,
                "changeable": True,
                "change_fee": 200.0,
                "cancellation_fee": 500.0,
            },
        ]
        return results[:max_results]

    def find_alternate_transfers(
        self, pickup: str, dropoff: str, pickup_time: datetime, max_results: int = 5
    ) -> List[Dict[str, Any]]:
        results = [
            {
                "id": 501,
                "type": "TRANSFER",
                "provider": "Jaipur Prime Express Cab",
                "origin": pickup,
                "destination": dropoff,
                "start_time": pickup_time,
                "end_time": pickup_time + timedelta(minutes=40),
                "cost": 750,
                "currency": "INR",
                "priority": "MEDIUM",
                "flexibility": "VERY_FLEXIBLE",
                "status": "CONFIRMED",
                "booking_id": "CAB-PRIME-501",
                "available": True,
                "refundable": True,
                "refund_percentage": 100.0,
                "changeable": True,
                "change_fee": 0.0,
                "cancellation_fee": 0.0,
            },
            {
                "id": 502,
                "type": "TRANSFER",
                "provider": "Station EV Shuttle",
                "origin": pickup,
                "destination": dropoff,
                "start_time": pickup_time + timedelta(minutes=15),
                "end_time": pickup_time + timedelta(minutes=55),
                "cost": 300,
                "currency": "INR",
                "priority": "LOW",
                "flexibility": "VERY_FLEXIBLE",
                "status": "CONFIRMED",
                "booking_id": "EV-SHUTTLE-502",
                "available": True,
                "refundable": True,
                "refund_percentage": 100.0,
                "changeable": True,
                "change_fee": 0.0,
                "cancellation_fee": 0.0,
            },
        ]
        return results[:max_results]

    def find_alternate_activities(
        self, location: str, target_date: datetime, max_results: int = 5
    ) -> List[Dict[str, Any]]:
        results = [
            {
                "id": 601,
                "type": "ACTIVITY",
                "provider": "Amber Fort Twilight Walk",
                "location": location,
                "start_time": target_date + timedelta(hours=2),
                "end_time": target_date + timedelta(hours=5),
                "cost": 1200,
                "currency": "INR",
                "priority": "LOW",
                "flexibility": "FLEXIBLE",
                "status": "CONFIRMED",
                "booking_id": "ACT-AMBER-601",
                "available": True,
                "refundable": True,
                "refund_percentage": 90.0,
                "changeable": True,
                "change_fee": 100.0,
                "cancellation_fee": 200.0,
            },
            {
                "id": 602,
                "type": "ACTIVITY",
                "provider": "City Heritage Cultural Tour",
                "location": location,
                "start_time": target_date + timedelta(hours=4),
                "end_time": target_date + timedelta(hours=7),
                "cost": 950,
                "currency": "INR",
                "priority": "LOW",
                "flexibility": "FLEXIBLE",
                "status": "CONFIRMED",
                "booking_id": "ACT-CITY-602",
                "available": True,
                "refundable": True,
                "refund_percentage": 100.0,
                "changeable": True,
                "change_fee": 0.0,
                "cancellation_fee": 0.0,
            }
        ]
        return results[:max_results]
