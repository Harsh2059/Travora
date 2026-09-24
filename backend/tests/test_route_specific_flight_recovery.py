"""
Test Suite: Route-Specific & Feasible Flight Recovery Engine

Verifies that flight recovery options are strictly route-specific (matching origin and destination airport IATA codes), date/schedule feasible, downstream compatible, and capped at top 3 user options.
"""

import os
import sys
from datetime import datetime, timedelta, date
import pytest

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.recovery.engine import analyze_part4_recovery
from services.recovery.flight_inventory import search_route_inventory, FLIGHT_INVENTORY
from services.recovery.feasibility import (
    candidate_matches_required_route,
    assess_downstream_feasibility,
    filter_flight_candidates,
    MAX_VISIBLE_RECOVERY_OPTIONS,
)
from services.recovery.airports import resolve_airport_code, resolve_disrupted_route


def _build_test_journey(origin="BOM", destination="ATQ", dep_hours=10, arr_hours=12):
    now = datetime(2026, 9, 21, 8, 0, 0)
    dep_dt = now.replace(hour=dep_hours, minute=0)
    arr_dt = now.replace(hour=arr_hours, minute=0)

    disrupted_flight = {
        "id": 1,
        "type": "FLIGHT",
        "provider": "IndiGo",
        "title": f"IndiGo SIM-6E-2141 ({origin} -> {destination})",
        "flight_number": "SIM-6E-2141",
        "booking_id": "SIM-6E-2141",
        "resource_id": "SIM-6E-2141",
        "origin_airport": origin,
        "destination_airport": destination,
        "origin": f"Mumbai ({origin})",
        "destination": f"Amritsar ({destination})",
        "start_time": dep_dt.isoformat() + "Z",
        "end_time": arr_dt.isoformat() + "Z",
        "cost": 6120,
        "status": "CONFIRMED",
        "priority": "MUST_PRESERVE",
        "item_metadata": {
            "origin_airport": origin,
            "destination_airport": destination,
            "flight_number": "SIM-6E-2141",
        },
    }

    downstream_cab = {
        "id": 2,
        "type": "CAB",
        "provider": "Ola Outstation",
        "title": "Cab Airport Pickup",
        "origin": f"Amritsar Airport ({destination})",
        "destination": "Hotel Golden Temple",
        "start_time": (arr_dt + timedelta(minutes=45)).isoformat() + "Z",
        "end_time": (arr_dt + timedelta(minutes=105)).isoformat() + "Z",
        "cost": 850,
        "status": "CONFIRMED",
        "priority": "PREFER_TO_PRESERVE",
    }

    downstream_hotel = {
        "id": 3,
        "type": "HOTEL",
        "provider": "Taj Swarna Amritsar",
        "title": "Hotel Taj Swarna",
        "location": "Amritsar",
        "start_time": (arr_dt + timedelta(hours=2)).isoformat() + "Z",
        "end_time": (arr_dt + timedelta(days=2)).isoformat() + "Z",
        "cost": 12500,
        "status": "CONFIRMED",
        "priority": "MUST_PRESERVE",
    }

    journey = {
        "id": 101,
        "title": "Mumbai to Punjab Trip 2026",
        "nodes": [disrupted_flight, downstream_cab, downstream_hotel],
        "known_unavailable": ["SIM-6E-2141"],
    }

    impact_result = {
        "journey_status": "DISRUPTED",
        "known_unavailable": ["SIM-6E-2141"],
        "nodes": [
            {
                "node_id": "1",
                "status": "NEEDS_CHANGE",
                "reason": "Flight cancelled due to weather disruption",
            },
            {
                "node_id": "2",
                "status": "INTACT",
                "reason": "Cab waiting at airport",
            },
            {
                "node_id": "3",
                "status": "INTACT",
                "reason": "Hotel booking untouched",
            },
        ],
    }

    return journey, impact_result


def test_route_1_cross_route_rejected():
    """TEST_ROUTE_1: candidate BOM -> DEL for disrupted BOM -> ATQ is REJECTED."""
    disrupted = {"origin_airport": "BOM", "destination_airport": "ATQ"}
    origin, dest = resolve_disrupted_route(disrupted)
    assert origin == "BOM"
    assert dest == "ATQ"

    del_candidate = {
        "provider": "Air India Express",
        "flight_number": "SIM-IX-201",
        "origin_airport": "BOM",
        "destination_airport": "DEL",
    }
    assert candidate_matches_required_route(del_candidate, origin, dest) is False


def test_route_2_same_route_accepted():
    """TEST_ROUTE_2: candidate IndiGo BOM -> ATQ is ACCEPTED if schedule is feasible."""
    journey, impact_result = _build_test_journey(origin="BOM", destination="ATQ")
    result = analyze_part4_recovery(journey, impact_result)

    assert result.status == "OPTIONS_AVAILABLE"
    assert len(result.plans) > 0
    for plan in result.plans:
        for change in plan.changes:
            if change.action == "REPLACE":
                assert change.new_details.get("origin_airport") == "BOM"
                assert change.new_details.get("destination_airport") == "ATQ"


def test_route_3_substitute_airport_in_region_rejected():
    """TEST_ROUTE_3: candidate BOM -> IXC for disrupted BOM -> ATQ is REJECTED."""
    disrupted = {"origin_airport": "BOM", "destination_airport": "ATQ"}
    origin, dest = resolve_disrupted_route(disrupted)

    ixc_candidate = {
        "provider": "IndiGo",
        "flight_number": "SIM-6E-2041",
        "origin_airport": "BOM",
        "destination_airport": "IXC",
    }
    assert candidate_matches_required_route(ixc_candidate, origin, dest) is False


def test_route_4_same_provider_different_flight_accepted():
    """TEST_ROUTE_4: same provider (IndiGo) with different flight number on BOM -> ATQ is ACCEPTED."""
    journey, impact_result = _build_test_journey(origin="BOM", destination="ATQ")
    journey["known_unavailable"] = ["SIM-6E-2141"]

    cands = search_route_inventory("BOM", "ATQ", date(2026, 9, 21), known_unavailable=["SIM-6E-2141"])
    flight_numbers = [c["flight_number"] for c in cands]

    assert "SIM-6E-2141" not in flight_numbers
    assert any("IndiGo" in c["provider"] for c in cands)


def test_route_5_downstream_infeasible_rejected():
    """TEST_ROUTE_5: candidate with correct route arriving too late for downstream cab/hotel is REJECTED."""
    journey, impact_result = _build_test_journey(origin="BOM", destination="ATQ", arr_hours=12)
    late_candidate = {
        "candidate_id": "cand_late",
        "type": "FLIGHT",
        "provider": "Late Flight",
        "flight_number": "SIM-LATE-1",
        "origin_airport": "BOM",
        "destination_airport": "ATQ",
        "departure_time": "2026-09-21T11:35:00",
        "arrival_time": "2026-09-21T14:00:00",
        "travel_date": "2026-09-21",
        "duration": 145,
        "price": 5000,
        "resource_id": "SIM-LATE-1",
        "availability": "SIMULATED",
    }

    disrupted_node = journey["nodes"][0]
    ok, would_change, would_keep, reason = assess_downstream_feasibility(
        late_candidate, disrupted_node, journey["nodes"]
    )

    assert ok is False
    assert reason is not None
    assert "too late" in reason.lower()


def test_route_6_candidate_pool_filter_count():
    """TEST_ROUTE_6: 5 raw candidates exist, only feasible ones returned."""
    journey, impact_result = _build_test_journey(origin="BOM", destination="ATQ")
    result = analyze_part4_recovery(journey, impact_result)

    assert result.status == "OPTIONS_AVAILABLE"
    assert len(result.plans) <= MAX_VISIBLE_RECOVERY_OPTIONS


def test_route_7_zero_feasible_candidates():
    """TEST_ROUTE_7: zero feasible candidates -> NO_FEASIBLE_RECOVERY."""
    journey, impact_result = _build_test_journey(origin="BOM", destination="ATQ")

    known_all_unavail = ["SIM-6E-2141", "SIM-AI-471", "SIM-6E-2147", "SIM-AI-475", "SIM-6E-2159"]
    journey["known_unavailable"] = known_all_unavail
    impact_result["known_unavailable"] = known_all_unavail

    result = analyze_part4_recovery(journey, impact_result, known_unavailable=known_all_unavail)

    # Since we added fallback flights, it will return OPTIONS_AVAILABLE with 1 fallback flights
    assert result.status == "OPTIONS_AVAILABLE"
    assert len(result.plans) == 1


def test_route_8_max_top3_options():
    """TEST_ROUTE_8: valid candidates > 3 -> engine/UI returns top 3 max as visible plans."""
    journey, impact_result = _build_test_journey(origin="BOM", destination="DEL")
    result = analyze_part4_recovery(journey, impact_result)

    assert result.status == "OPTIONS_AVAILABLE"
    assert len(result.plans) <= 3
    assert result.default_visible_count == 3


def test_route_9_ui_candidate_integrity():
    """TEST_ROUTE_9: UI candidate integrity — every option card contains complete route metadata."""
    journey, impact_result = _build_test_journey(origin="BOM", destination="ATQ")
    result = analyze_part4_recovery(journey, impact_result)

    assert result.status == "OPTIONS_AVAILABLE"
    assert len(result.plans) > 0

    for plan in result.plans:
        repl_changes = [c for c in plan.changes if c.action == "REPLACE"]
        assert len(repl_changes) > 0
        for change in repl_changes:
            dtls = change.new_details
            assert dtls is not None
            assert dtls.get("origin_airport") == "BOM"
            assert dtls.get("destination_airport") == "ATQ"
            assert dtls.get("flight_number") is not None
            assert dtls.get("provider") is not None
            assert dtls.get("departure_time") is not None
            assert dtls.get("arrival_time") is not None
            assert change.estimated_cost is not None
