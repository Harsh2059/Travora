"""
Part 4 Recovery Engine Test Suite
Tests all 12 core acceptance criteria and edge cases.
"""

import sys
import os
from datetime import datetime, timedelta

# Add backend directory to sys.path
root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
backend_path = os.path.join(root_path, "backend")
if root_path not in sys.path:
    sys.path.insert(0, root_path)
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from backend.services.recovery.engine import analyze_part4_recovery
from backend.services.recovery.models import (
    Part4RecoveryResult,
    Part4RecoveryPlan,
    ActionType,
    RecoveryFeasibility,
    RecoveryPlanCategory,
)
from backend.services.recovery.providers import (
    MockFlightProvider,
    MockTrainProvider,
    MockHotelProvider,
    MockCabProvider,
    MockActivityProvider,
)




def build_sample_journey():
    """
    Standard Travora Mumbai -> Delhi Demo Journey:
    1. Flight: BOM -> DEL (09:30 - 11:40) [MUST_PRESERVE]
    2. Cab: Airport -> Hotel (12:15 - 13:00) [INTACT]
    3. Hotel: Delhi Hotel (Check-in 14:00) [MUST_PRESERVE]
    4. Metro: City Center (16:00 - 16:30) [INTACT]
    5. Activity: Critical Party/Conference (18:00 - 21:00) [MUST_PRESERVE]
    """
    base_date = "2026-09-24"
    return {
        "id": 101,
        "title": "Mumbai to Delhi Trip",
        "items": [
            {
                "id": "flight-1",
                "type": "FLIGHT",
                "title": "Indigo 6E-204 (BOM → DEL)",
                "provider": "Indigo",
                "origin": "Mumbai",
                "destination": "Delhi",
                "start_time": f"{base_date}T09:30:00",
                "end_time": f"{base_date}T11:40:00",
                "cost": 4500.0,
                "currency": "INR",
                "priority": "MUST_PRESERVE",
                "status": "CONFIRMED",
            },
            {
                "id": "cab-1",
                "type": "CAB",
                "title": "Uber Airport Transfer",
                "provider": "Uber",
                "origin": "Delhi Airport",
                "destination": "Hotel Taj",
                "start_time": f"{base_date}T12:15:00",
                "end_time": f"{base_date}T13:00:00",
                "cost": 800.0,
                "currency": "INR",
                "priority": "PREFER_TO_PRESERVE",
                "status": "CONFIRMED",
            },
            {
                "id": "hotel-1",
                "type": "HOTEL",
                "title": "Taj Palace Delhi",
                "provider": "Taj Hotels",
                "location": "Delhi",
                "start_time": f"{base_date}T14:00:00",
                "end_time": "2026-09-26T11:00:00",
                "cost": 12000.0,
                "currency": "INR",
                "priority": "MUST_PRESERVE",
                "status": "CONFIRMED",
            },
            {
                "id": "metro-1",
                "type": "METRO",
                "title": "Delhi Metro Airport Line",
                "provider": "DMRC",
                "origin": "CP",
                "destination": "Dwarka",
                "start_time": f"{base_date}T16:00:00",
                "end_time": f"{base_date}T16:30:00",
                "cost": 60.0,
                "currency": "INR",
                "priority": "OPTIMIZE",
                "status": "CONFIRMED",
            },
            {
                "id": "party-1",
                "type": "ACTIVITY",
                "title": "Annual Gala Dinner",
                "provider": "Tech Summit",
                "location": "Delhi Convention Center",
                "start_time": f"{base_date}T18:00:00",
                "end_time": f"{base_date}T21:00:00",
                "cost": 0.0,
                "currency": "INR",
                "priority": "MUST_PRESERVE",
                "status": "CONFIRMED",
            },
        ],
    }


def run_tests():
    print("=" * 70)
    print("STARTING PART 4 RECOVERY ENGINE TESTS")
    print("=" * 70)

    passed = 0
    failed = 0

    def assert_test(name: str, condition: bool, err_msg: str = ""):
        nonlocal passed, failed
        if condition:
            print(f"[PASS] {name}")
            passed += 1
        else:
            print(f"[FAIL] {name} - {err_msg}")
            failed += 1

    # -------------------------------------------------------------------------
    # TEST 1: Flight Cancelled
    # Expected: recovery candidates generated, original itinerary unchanged
    # -------------------------------------------------------------------------
    j1 = build_sample_journey()
    j1_copy = build_sample_journey()
    impact1 = {
        "journey_status": "DISRUPTED",
        "nodes": [
            {
                "node_id": "flight-1",
                "status": "BROKEN",
                "priority": "MUST_PRESERVE",
                "reason": "Flight cancelled due to airspace closure",
            },
            {"node_id": "cab-1", "status": "INTACT", "reason": "No disruption"},
            {"node_id": "hotel-1", "status": "INTACT", "reason": "No disruption"},
            {"node_id": "metro-1", "status": "INTACT", "reason": "No disruption"},
            {"node_id": "party-1", "status": "INTACT", "reason": "No disruption"},
        ],
    }

    res1 = analyze_part4_recovery(j1, impact1)
    assert_test(
        "TEST 1: Flight cancelled generates recovery plans",
        len(res1.plans) > 0 and res1.impact_status == "DISRUPTED",
        f"Expected plans > 0, got {len(res1.plans)}",
    )
    assert_test(
        "TEST 1: Original journey data not mutated",
        j1 == j1_copy,
        "Journey dict was mutated during recovery analysis!",
    )

    # -------------------------------------------------------------------------
    # TEST 2: Flight + Hotel Cancelled
    # Expected: Combined recovery plan generated, both affected items replaced
    # -------------------------------------------------------------------------
    j2 = build_sample_journey()
    impact2 = {
        "journey_status": "DISRUPTED",
        "nodes": [
            {"node_id": "flight-1", "status": "BROKEN", "reason": "Flight cancelled"},
            {"node_id": "hotel-1", "status": "BROKEN", "reason": "Hotel overbooked"},
            {"node_id": "cab-1", "status": "INTACT"},
            {"node_id": "metro-1", "status": "INTACT"},
            {"node_id": "party-1", "status": "INTACT"},
        ],
    }

    res2 = analyze_part4_recovery(j2, impact2)
    p2 = res2.plans[0]
    replaced_ids = set(p2.changed_node_ids)
    assert_test(
        "TEST 2: Combined recovery replaces both broken nodes",
        "flight-1" in replaced_ids and "hotel-1" in replaced_ids,
        f"Expected flight-1 and hotel-1 in replaced IDs, got {replaced_ids}",
    )

    # -------------------------------------------------------------------------
    # TEST 3: Candidate Provider output validation
    # -------------------------------------------------------------------------
    flight_provider = MockFlightProvider()
    cands = flight_provider.search_candidates(j1["items"][0])
    assert_test(
        "TEST 3: MockFlightProvider returns valid non-empty candidates",
        len(cands) >= 2 and "title" in cands[0] and cands[0]["cost"] > 0,
        f"Candidates invalid: {cands}",
    )

    # -------------------------------------------------------------------------
    # TEST 4: One candidate preserves all MUST_PRESERVE items
    # Expected: Appears in PRIORITY_PRESERVING category
    # -------------------------------------------------------------------------
    p_pres = [p for p in res1.plans if p.category == RecoveryPlanCategory.PRIORITY_PRESERVING]
    assert_test(
        "TEST 4: Priority-preserving plan present in priority category",
        len(p_pres) >= 1 and p_pres[0].is_recommended is True,
        f"Expected priority preserving plan, got {len(p_pres)}",
    )

    # -------------------------------------------------------------------------
    # TEST 5: Alternative plan present in ALTERNATIVE category
    # -------------------------------------------------------------------------
    p_alt = [p for p in res1.plans if p.category == RecoveryPlanCategory.ALTERNATIVE]
    assert_test(
        "TEST 5: Alternative plan present in ALTERNATIVE category",
        len(p_alt) >= 1,
        f"Expected alternative plan, got {len(p_alt)}",
    )

    # -------------------------------------------------------------------------
    # TEST 6: Preservation Rule (Unaffected nodes preserved)
    # Expected: Intact Cab/Metro/Party are NOT replaced unnecessarily (ActionType.KEEP)
    # -------------------------------------------------------------------------
    plan_changes = p2.changes
    keep_actions = [c for c in plan_changes if c.action == ActionType.KEEP]
    kept_node_ids = {c.node_id for c in keep_actions}
    assert_test(
        "TEST 6: Preservation rule keeps intact nodes (cab-1, metro-1, party-1)",
        "cab-1" in kept_node_ids and "metro-1" in kept_node_ids and "party-1" in kept_node_ids,
        f"Expected cab-1, metro-1, party-1 in kept nodes, got {kept_node_ids}",
    )

    # -------------------------------------------------------------------------
    # TEST 7: Unknown timing handling
    # Expected: No fabricated timing or false guaranteed feasibility
    # -------------------------------------------------------------------------
    j7 = build_sample_journey()
    j7["items"][0]["start_time"] = None  # Unknown timing
    res7 = analyze_part4_recovery(j7, impact1)
    assert_test(
        "TEST 7: Unknown timing handled cleanly without throwing error",
        len(res7.plans) > 0,
        "Failed to handle missing start_time cleanly",
    )

    # -------------------------------------------------------------------------
    # TEST 8: Cost calculation verification
    # Verify: replacement cost + fee - refund = estimated_additional_cost
    # -------------------------------------------------------------------------
    plan1 = res1.plans[0]
    rep_changes = [c for c in plan1.changes if c.action == ActionType.REPLACE]
    calculated_add_cost = sum(c.estimated_cost for c in rep_changes)
    calculated_refund = sum(c.estimated_refund for c in rep_changes)

    assert_test(
        "TEST 8: Cost calculation transparently separates cost and refund",
        round(calculated_add_cost, 2) == round(plan1.estimated_additional_cost, 2)
        and round(calculated_refund, 2) == round(plan1.estimated_refund, 2),
        f"Cost mismatch: plan cost={plan1.estimated_additional_cost}, calc={calculated_add_cost}",
    )

    # -------------------------------------------------------------------------
    # TEST 9: Multiple active disruptions single combined ImpactResult
    # -------------------------------------------------------------------------
    j9 = build_sample_journey()
    impact9 = {
        "journey_status": "DISRUPTED",
        "nodes": [
            {"node_id": "flight-1", "status": "BROKEN", "reason": "Flight cancelled"},
            {"node_id": "hotel-1", "status": "NEEDS_CHANGE", "reason": "Checkin missed due to flight"},
            {"node_id": "cab-1", "status": "INTACT"},
        ],
    }
    res9 = analyze_part4_recovery(j9, impact9)
    assert_test(
        "TEST 9: Single combined recovery result for multiple disruptions",
        res9.impact_status == "DISRUPTED" and len(res9.plans) == 2,
        f"Unexpected plan count: {len(res9.plans)}",
    )

    # -------------------------------------------------------------------------
    # TEST 10: No active disruptions (NORMAL journey)
    # Expected: No recovery plans generated, clear normal message
    # -------------------------------------------------------------------------
    j10 = build_sample_journey()
    impact10 = {
        "journey_status": "NORMAL",
        "nodes": [
            {"node_id": "flight-1", "status": "INTACT"},
            {"node_id": "hotel-1", "status": "INTACT"},
        ],
    }
    res10 = analyze_part4_recovery(j10, impact10)
    assert_test(
        "TEST 10: NORMAL journey produces no recovery plans",
        len(res10.plans) == 0 and res10.impact_status == "NORMAL",
        f"Expected 0 plans, got {len(res10.plans)}",
    )

    # -------------------------------------------------------------------------
    # TEST 11: Deterministic results on repeated analysis
    # -------------------------------------------------------------------------
    res11_a = analyze_part4_recovery(j1, impact1)
    res11_b = analyze_part4_recovery(j1, impact1)
    assert_test(
        "TEST 11: Deterministic output across repeated runs",
        res11_a.plans[0].estimated_additional_cost == res11_b.plans[0].estimated_additional_cost
        and len(res11_a.plans) == len(res11_b.plans),
        "Repeated analysis produced non-deterministic results",
    )

    # -------------------------------------------------------------------------
    # TEST 12: Provider abstractions for all node types
    # -------------------------------------------------------------------------
    train_p = MockTrainProvider()
    hotel_p = MockHotelProvider()
    cab_p = MockCabProvider()
    act_p = MockActivityProvider()

    c_train = train_p.search_candidates(j1["items"][3])
    c_hotel = hotel_p.search_candidates(j1["items"][2])
    c_cab = cab_p.search_candidates(j1["items"][1])
    c_act = act_p.search_candidates(j1["items"][4])

    assert_test(
        "TEST 12: Providers exist and return candidates for TRAIN, HOTEL, CAB, ACTIVITY",
        len(c_train) > 0 and len(c_hotel) > 0 and len(c_cab) > 0 and len(c_act) > 0,
        "One or more mock providers failed to return candidates",
    )

    print("=" * 70)
    print(f"RESULTS: {passed} PASSED, {failed} FAILED")
    print("=" * 70)

    return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
