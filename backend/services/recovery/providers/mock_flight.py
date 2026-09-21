"""
Mock Flight Availability Provider

Candidates come from route-specific simulated 2026 inventory.
A provider name is never sufficient — origin, destination, date, and
schedule must match the disrupted flight.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from .base import BaseAvailabilityProvider, BaseBookingProvider
from ..airports import airport_label, resolve_disrupted_route
from ..flight_inventory import search_route_inventory, _travel_date_from_node


class MockFlightProvider(BaseAvailabilityProvider, BaseBookingProvider):
    """Search simulated route inventory and book deterministic demo tickets."""

    def search_candidates(
        self,
        node: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        ctx = context or {}
        journey_nodes = ctx.get("journey_nodes") or []
        known_unavail = ctx.get("known_unavailable") or node.get("known_unavailable") or []
        inventory = ctx.get("inventory")

        origin_code, dest_code = resolve_disrupted_route(node, journey_nodes)
        origin = origin_code or node.get("origin_airport") or node.get("origin")
        destination = dest_code or node.get("destination_airport") or node.get("destination")
        travel_date = _travel_date_from_node(node)

        return search_route_inventory(
            origin,
            destination,
            travel_date,
            inventory=inventory,
            journey_nodes=journey_nodes,
            disrupted_node=node,
            known_unavailable=known_unavail,
            require_direct=True,
        )

    def revalidate(
        self,
        change: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        details = change.get("new_details") or {}
        cost = change.get("estimated_cost") or details.get("cost") or details.get("price") or 4800.0
        is_available = not bool(change.get("simulated_unavailable", False) or details.get("available") is False)

        return {
            "available": is_available,
            "current_price": float(cost),
            "currency": "INR",
            "provider": change.get("provider") or details.get("provider") or "SimulatedFlightInventory",
            "checked_at": datetime.utcnow().isoformat() + "Z",
            "booking_conditions": "Simulated availability. Demo inventory only — not live airline inventory.",
            "simulated": True,
            "availability_source": "simulated",
        }

    def book(
        self,
        change: Dict[str, Any],
        traveler_details: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        node_id_str = str(change.get("node_id") or "1")
        new_details = change.get("new_details") or {}
        title_str = str(
            change.get("new_title")
            or new_details.get("title")
            or change.get("title")
            or "Flight"
        )

        provider_name = (
            change.get("provider")
            or new_details.get("provider")
            or new_details.get("airline")
        )
        if not provider_name:
            base = title_str.split(" (Repl.")[0].split(" (")[0].strip()
            provider_name = base if base and base.lower() != "flight" else "Simulated Airline"

        cost = float(
            change.get("estimated_cost")
            or new_details.get("cost")
            or new_details.get("price")
            or change.get("cost")
            or 4800.0
        )

        origin = (
            new_details.get("origin")
            or change.get("origin")
            or airport_label(new_details.get("origin_airport"), "Mumbai (BOM)")
        )
        destination = (
            new_details.get("destination")
            or change.get("destination")
            or airport_label(new_details.get("destination_airport"))
        )
        origin_airport = new_details.get("origin_airport")
        destination_airport = new_details.get("destination_airport")
        fl_number = (
            new_details.get("flight_number")
            or change.get("flight_number")
            or "SIM-UNSET"
        )
        dep = (
            new_details.get("departure_time")
            or new_details.get("start_time")
            or change.get("start_time")
            or (datetime.utcnow() + timedelta(hours=4)).isoformat() + "Z"
        )
        arr = (
            new_details.get("arrival_time")
            or new_details.get("end_time")
            or change.get("end_time")
            or (datetime.utcnow() + timedelta(hours=6, minutes=30)).isoformat() + "Z"
        )

        h_val = abs(hash(f"{node_id_str}_{fl_number}"))
        pnr_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        pnr_suffix = "".join(pnr_chars[(h_val // (36**i)) % 36] for i in range(4))
        p_low = provider_name.lower()
        if "indigo" in p_low:
            pnr_prefix = "6E"
        elif "akasa" in p_low:
            pnr_prefix = "QP"
        elif "express" in p_low:
            pnr_prefix = "IX"
        elif "air india" in p_low:
            pnr_prefix = "AI"
        elif "spice" in p_low:
            pnr_prefix = "SG"
        elif "british" in p_low:
            pnr_prefix = "BA"
        elif "virgin" in p_low:
            pnr_prefix = "VS"
        else:
            pnr_prefix = "FL"
        pnr = f"{pnr_prefix}{pnr_suffix}"[:7]
        ticket_num = f"098-{1000000000 + (h_val % 8999999999)}"

        return {
            "success": True,
            "status": "BOOKED",
            "booking": {
                "booking_reference": pnr,
                "pnr": pnr,
                "ticket_number": ticket_num,
                "provider": provider_name,
                "airline": provider_name,
                "flight_number": fl_number,
                "seat": "14A",
                "cabin_class": "Economy",
                "origin": origin,
                "destination": destination,
                "origin_airport": origin_airport,
                "destination_airport": destination_airport,
                "departure_time": dep,
                "arrival_time": arr,
                "travel_date": new_details.get("travel_date"),
                "duration": new_details.get("duration"),
                "passenger_name": "Traveler (Demo User)",
                "final_price": cost,
                "currency": "INR",
                "booking_status": "CONFIRMED",
                "booked_at": datetime.utcnow().isoformat() + "Z",
                "simulated": True,
                "availability_source": "simulated",
                "resource_id": new_details.get("resource_id") or fl_number,
            }
        }
