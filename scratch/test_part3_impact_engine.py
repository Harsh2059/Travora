import sys
import os
import json

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from services.graph.builder import build_dependency_graph
from services.impact.engine import ImpactEngine
from services.impact.models import ImpactStatus, ImpactSourceKind

def create_mock_dict_item(item_id, item_type, title, start_time, end_time, origin, destination, priority="REGULAR"):
    return {
        "id": item_id,
        "trip_id": 1,
        "type": item_type,
        "title": title,
        "start_time": start_time,
        "end_time": end_time,
        "origin": origin,
        "destination": destination,
        "location": destination,
        "priority": priority,
        "metadata": {}
    }

def create_disruption_event(d_id, entity_id, event_type, delay_minutes=0, cause="MECHANICAL", scope="SINGLE_NODE", location="BOM", reason="Disruption occurred"):
    return {
        "id": d_id,
        "disruption_id": d_id,
        "trip_id": 1,
        "entity_id": entity_id,
        "affected_node_id": entity_id,
        "event_type": event_type,
        "event_metadata": {
            "delay_minutes": delay_minutes,
            "cause": cause,
            "scope": scope,
            "affected_location": location,
            "reason": reason
        }
    }

# ----------------------------------------------------
# TEST SCENARIOS (1 to 20)
# ----------------------------------------------------

def test_1_flight_and_train():
    items = [
        create_mock_dict_item(1, "FLIGHT", "Indigo BOM-DEL", "2026-10-10T08:00:00", "2026-10-10T10:00:00", "BOM", "DEL"),
        create_mock_dict_item(2, "TRAIN", "Express DEL-JAI", "2026-10-10T11:00:00", "2026-10-10T15:00:00", "DEL", "JAI"),
    ]
    graph = build_dependency_graph(items)
    disruptions = [
        create_disruption_event(101, 1, "CANCELLED", reason="Flight cancelled"),
        create_disruption_event(102, 2, "DELAYED", delay_minutes=60, reason="Train signal failure")
    ]
    res = ImpactEngine.propagate_impact(graph, disruptions)
    nodes = res.node_impacts
    assert nodes["1"].status == ImpactStatus.BROKEN
    assert nodes["2"].status == ImpactStatus.BROKEN, "Train should be BROKEN because inbound connecting flight 1 was BROKEN"
    print("[PASS] Test 1: Flight + Train")

def test_2_flight_and_cab():
    items = [
        create_mock_dict_item(1, "FLIGHT", "Flight BOM-DEL", "2026-10-10T08:00:00", "2026-10-10T10:00:00", "BOM", "DEL"),
        create_mock_dict_item(2, "CAB", "Airport Pickup", "2026-10-10T10:30:00", "2026-10-10T11:30:00", "DEL", "Hotel"),
    ]
    graph = build_dependency_graph(items)
    disruptions = [
        create_disruption_event(101, 1, "DELAYED", delay_minutes=60, reason="Flight delay"),
        create_disruption_event(102, 2, "CAB_UNAVAILABLE", reason="Cab driver unavailable")
    ]
    res = ImpactEngine.propagate_impact(graph, disruptions)
    nodes = res.node_impacts
    assert nodes["1"].status == ImpactStatus.NEEDS_CHANGE
    assert nodes["2"].status == ImpactStatus.BROKEN, "Cab is directly BROKEN"
    print("[PASS] Test 2: Flight + Cab")

def test_3_flight_and_hotel():
    items = [
        create_mock_dict_item(1, "FLIGHT", "Flight BOM-DEL", "2026-10-10T08:00:00", "2026-10-10T10:00:00", "BOM", "DEL"),
        create_mock_dict_item(2, "HOTEL", "Taj Delhi", "2026-10-10T14:00:00", "2026-10-12T11:00:00", "DEL", "DEL"),
    ]
    graph = build_dependency_graph(items)
    disruptions = [
        create_disruption_event(101, 1, "CANCELLED", reason="Flight cancelled"),
        create_disruption_event(102, 2, "HOTEL_CANCELLED", reason="Hotel overbooked")
    ]
    res = ImpactEngine.propagate_impact(graph, disruptions)
    nodes = res.node_impacts
    assert nodes["1"].status == ImpactStatus.BROKEN
    assert nodes["2"].status == ImpactStatus.BROKEN, "Direct hotel cancellation yields BROKEN"
    print("[PASS] Test 3: Flight + Hotel")

def test_4_flight_and_activity():
    items = [
        create_mock_dict_item(1, "FLIGHT", "Flight BOM-DEL", "2026-10-10T08:00:00", "2026-10-10T10:00:00", "BOM", "DEL"),
        create_mock_dict_item(2, "ACTIVITY", "City Tour", "2026-10-10T12:00:00", "2026-10-10T15:00:00", "DEL", "DEL"),
    ]
    graph = build_dependency_graph(items)
    disruptions = [
        create_disruption_event(101, 1, "DELAYED", delay_minutes=180, reason="Flight 3h delay"),
        create_disruption_event(102, 2, "ACTIVITY_CANCELLED", reason="Tour guide sick")
    ]
    res = ImpactEngine.propagate_impact(graph, disruptions)
    nodes = res.node_impacts
    assert nodes["1"].status == ImpactStatus.NEEDS_CHANGE
    assert nodes["2"].status == ImpactStatus.BROKEN, "Direct activity cancellation yields BROKEN"
    print("[PASS] Test 4: Flight + Activity")

def test_5_train_and_metro():
    items = [
        create_mock_dict_item(1, "TRAIN", "Rajdhani Exp", "2026-10-10T08:00:00", "2026-10-10T14:00:00", "BOM", "DEL"),
        create_mock_dict_item(2, "METRO", "Delhi Metro Airport Line", "2026-10-10T14:30:00", "2026-10-10T15:00:00", "DEL", "DEL"),
    ]
    graph = build_dependency_graph(items)
    disruptions = [
        create_disruption_event(101, 1, "TRAIN_CANCELLED", reason="Track maintenance"),
        create_disruption_event(102, 2, "METRO_DELAYED", delay_minutes=15, reason="Power fault")
    ]
    res = ImpactEngine.propagate_impact(graph, disruptions)
    nodes = res.node_impacts
    assert nodes["1"].status == ImpactStatus.BROKEN
    assert nodes["2"].status == ImpactStatus.BROKEN, "Metro is broken because inbound train connection was cancelled"
    print("[PASS] Test 5: Train + Metro")

def test_6_train_and_cab():
    items = [
        create_mock_dict_item(1, "TRAIN", "Shatabdi Exp", "2026-10-10T06:00:00", "2026-10-10T10:00:00", "DEL", "CHD"),
        create_mock_dict_item(2, "CAB", "Local Cab", "2026-10-10T10:30:00", "2026-10-10T11:00:00", "CHD", "Hotel"),
    ]
    graph = build_dependency_graph(items)
    disruptions = [
        create_disruption_event(101, 1, "TRAIN_DELAYED", delay_minutes=45, reason="Signal delay"),
        create_disruption_event(102, 2, "CAB_DELAYED", delay_minutes=15, reason="Traffic jam")
    ]
    res = ImpactEngine.propagate_impact(graph, disruptions)
    nodes = res.node_impacts
    assert nodes["1"].status == ImpactStatus.NEEDS_CHANGE
    assert nodes["2"].status in [ImpactStatus.NEEDS_CHANGE, ImpactStatus.BROKEN]
    print("[PASS] Test 6: Train + Cab")

def test_7_train_and_hotel():
    items = [
        create_mock_dict_item(1, "TRAIN", "Duronto Exp", "2026-10-10T08:00:00", "2026-10-10T16:00:00", "BOM", "KOL"),
        create_mock_dict_item(2, "HOTEL", "Oberoi Grand", "2026-10-10T17:00:00", "2026-10-12T10:00:00", "KOL", "KOL"),
    ]
    graph = build_dependency_graph(items)
    disruptions = [
        create_disruption_event(101, 1, "TRAIN_CANCELLED", reason="Flooding on track"),
    ]
    res = ImpactEngine.propagate_impact(graph, disruptions)
    nodes = res.node_impacts
    assert nodes["1"].status == ImpactStatus.BROKEN
    assert nodes["2"].status == ImpactStatus.INTACT, "Hotel stays INTACT because stay reachability remains feasible"
    print("[PASS] Test 7: Train + Hotel")

def test_8_train_and_activity():
    items = [
        create_mock_dict_item(1, "TRAIN", "Tejas Exp", "2026-10-10T08:00:00", "2026-10-10T12:00:00", "BOM", "GOA"),
        create_mock_dict_item(2, "ACTIVITY", "Sunset Cruise", "2026-10-10T17:00:00", "2026-10-10T19:00:00", "GOA", "GOA"),
    ]
    graph = build_dependency_graph(items)
    disruptions = [
        create_disruption_event(101, 1, "TRAIN_DELAYED", delay_minutes=360, reason="Engine fail"),
    ]
    res = ImpactEngine.propagate_impact(graph, disruptions)
    nodes = res.node_impacts
    assert nodes["1"].status == ImpactStatus.NEEDS_CHANGE
    assert nodes["2"].status == ImpactStatus.BROKEN, "Activity broken because train arrival 18:00 > cruise start 17:00"
    print("[PASS] Test 8: Train + Activity")

def test_9_metro_and_cab():
    items = [
        create_mock_dict_item(1, "METRO", "Metro Line 1", "2026-10-10T09:00:00", "2026-10-10T09:30:00", "A", "B"),
        create_mock_dict_item(2, "CAB", "Uber", "2026-10-10T09:40:00", "2026-10-10T10:10:00", "B", "C"),
    ]
    graph = build_dependency_graph(items)
    disruptions = [
        create_disruption_event(101, 1, "METRO_CANCELLED", reason="Line strike"),
    ]
    res = ImpactEngine.propagate_impact(graph, disruptions)
    nodes = res.node_impacts
    assert nodes["1"].status == ImpactStatus.BROKEN
    assert nodes["2"].status == ImpactStatus.BROKEN, "Cab transfer broken due to metro cancellation"
    print("[PASS] Test 9: Metro + Cab")

def test_10_metro_and_activity():
    items = [
        create_mock_dict_item(1, "METRO", "City Metro", None, None, "A", "B"),
        create_mock_dict_item(2, "ACTIVITY", "Museum Visit", "2026-10-10T14:00:00", "2026-10-10T16:00:00", "B", "B"),
    ]
    graph = build_dependency_graph(items)
    disruptions = [
        create_disruption_event(101, 1, "METRO_DELAYED", delay_minutes=30, reason="Metro delay"),
    ]
    res = ImpactEngine.propagate_impact(graph, disruptions)
    nodes = res.node_impacts
    assert nodes["1"].status == ImpactStatus.NEEDS_CHANGE
    assert nodes["2"].status == ImpactStatus.AT_RISK, "Activity AT_RISK due to unknown metro arrival time"
    print("[PASS] Test 10: Metro + Activity")

def test_11_cab_and_hotel():
    items = [
        create_mock_dict_item(1, "CAB", "Intercity Cab", "2026-10-10T08:00:00", "2026-10-10T12:00:00", "DEL", "AGR"),
        create_mock_dict_item(2, "HOTEL", "Taj Agra", "2026-10-10T13:00:00", "2026-10-11T11:00:00", "AGR", "AGR"),
    ]
    graph = build_dependency_graph(items)
    disruptions = [
        create_disruption_event(101, 1, "CAB_UNAVAILABLE", reason="Breakdown"),
    ]
    res = ImpactEngine.propagate_impact(graph, disruptions)
    nodes = res.node_impacts
    assert nodes["1"].status == ImpactStatus.BROKEN
    assert nodes["2"].status == ImpactStatus.INTACT, "Hotel stay remains INTACT despite cab failure"
    print("[PASS] Test 11: Cab + Hotel")

def test_12_cab_and_activity():
    items = [
        create_mock_dict_item(1, "CAB", "Local Cab", "2026-10-10T15:00:00", "2026-10-10T15:30:00", "Hotel", "Venue"),
        create_mock_dict_item(2, "ACTIVITY", "Concert", "2026-10-10T16:00:00", "2026-10-10T19:00:00", "Venue", "Venue"),
    ]
    graph = build_dependency_graph(items)
    disruptions = [
        create_disruption_event(101, 1, "CAB_DELAYED", delay_minutes=90, reason="Severe traffic"),
    ]
    res = ImpactEngine.propagate_impact(graph, disruptions)
    nodes = res.node_impacts
    assert nodes["1"].status == ImpactStatus.NEEDS_CHANGE
    assert nodes["2"].status == ImpactStatus.BROKEN, "Concert start 16:00 < arrival 16:30 -> BROKEN"
    print("[PASS] Test 12: Cab + Activity")

def test_13_hotel_and_activity():
    items = [
        create_mock_dict_item(1, "HOTEL", "Hotel Paris", "2026-10-10T14:00:00", "2026-10-12T11:00:00", "PAR", "PAR"),
        create_mock_dict_item(2, "ACTIVITY", "Louvre Museum", "2026-10-11T10:00:00", "2026-10-11T13:00:00", "PAR", "PAR"),
    ]
    graph = build_dependency_graph(items)
    disruptions = [
        create_disruption_event(101, 1, "HOTEL_CANCELLED", reason="Hotel fire"),
    ]
    res = ImpactEngine.propagate_impact(graph, disruptions)
    nodes = res.node_impacts
    assert nodes["1"].status == ImpactStatus.BROKEN
    print("[PASS] Test 13: Hotel + Activity")

def test_14_multiple_transport_disruptions():
    items = [
        create_mock_dict_item(1, "FLIGHT", "Flight 1", "2026-10-10T08:00:00", "2026-10-10T10:00:00", "BOM", "DEL"),
        create_mock_dict_item(2, "TRAIN", "Train 1", "2026-10-10T12:00:00", "2026-10-10T16:00:00", "DEL", "JAI"),
        create_mock_dict_item(3, "CAB", "Cab 1", "2026-10-10T16:30:00", "2026-10-10T17:00:00", "JAI", "Hotel"),
    ]
    graph = build_dependency_graph(items)
    disruptions = [
        create_disruption_event(101, 1, "FLIGHT_DELAYED", delay_minutes=30),
        create_disruption_event(102, 2, "TRAIN_CANCELLED"),
    ]
    res = ImpactEngine.propagate_impact(graph, disruptions)
    nodes = res.node_impacts
    assert nodes["1"].status == ImpactStatus.NEEDS_CHANGE
    assert nodes["2"].status == ImpactStatus.BROKEN
    assert nodes["3"].status == ImpactStatus.BROKEN, "Cab broken due to train cancellation"
    print("[PASS] Test 14: Multiple transport disruptions")

def test_15_multiple_direct_cancellations():
    items = [
        create_mock_dict_item(1, "FLIGHT", "Flight 1", "2026-10-10T08:00:00", "2026-10-10T10:00:00", "BOM", "DEL"),
        create_mock_dict_item(2, "HOTEL", "Hotel 1", "2026-10-10T14:00:00", "2026-10-12T11:00:00", "DEL", "DEL"),
        create_mock_dict_item(3, "ACTIVITY", "Activity 1", "2026-10-11T10:00:00", "2026-10-11T12:00:00", "DEL", "DEL"),
    ]
    graph = build_dependency_graph(items)
    disruptions = [
        create_disruption_event(101, 1, "FLIGHT_CANCELLED"),
        create_disruption_event(102, 2, "HOTEL_CANCELLED"),
        create_disruption_event(103, 3, "ACTIVITY_CANCELLED"),
    ]
    res = ImpactEngine.propagate_impact(graph, disruptions)
    nodes = res.node_impacts
    assert nodes["1"].status == ImpactStatus.BROKEN
    assert nodes["2"].status == ImpactStatus.BROKEN
    assert nodes["3"].status == ImpactStatus.BROKEN
    assert len(res.disruption_ids) == 3
    print("[PASS] Test 15: Multiple direct cancellations")

def test_16_multiple_delays():
    items = [
        create_mock_dict_item(1, "FLIGHT", "Flight 1", "2026-10-10T08:00:00", "2026-10-10T10:00:00", "BOM", "DEL"),
        create_mock_dict_item(2, "CAB", "Cab 1", "2026-10-10T11:00:00", "2026-10-10T12:00:00", "DEL", "Hotel"),
    ]
    graph = build_dependency_graph(items)
    disruptions = [
        create_disruption_event(101, 1, "FLIGHT_DELAYED", delay_minutes=30),
        create_disruption_event(102, 2, "CAB_DELAYED", delay_minutes=15),
    ]
    res = ImpactEngine.propagate_impact(graph, disruptions)
    nodes = res.node_impacts
    assert nodes["1"].status == ImpactStatus.NEEDS_CHANGE
    assert nodes["2"].status == ImpactStatus.NEEDS_CHANGE
    print("[PASS] Test 16: Multiple delays")

def test_17_direct_and_propagated_impact_on_same_node():
    items = [
        create_mock_dict_item(1, "FLIGHT", "Flight 1", "2026-10-10T08:00:00", "2026-10-10T10:00:00", "BOM", "DEL"),
        create_mock_dict_item(2, "CAB", "Cab 1", "2026-10-10T10:30:00", "2026-10-10T11:00:00", "DEL", "Hotel"),
    ]
    graph = build_dependency_graph(items)
    disruptions = [
        create_disruption_event(101, 1, "FLIGHT_CANCELLED"),
        create_disruption_event(102, 2, "CAB_UNAVAILABLE"),
    ]
    res = ImpactEngine.propagate_impact(graph, disruptions)
    nodes = res.node_impacts
    cab_imp = nodes["2"]
    assert cab_imp.status == ImpactStatus.BROKEN
    assert len(cab_imp.impact_sources) >= 2, f"Expected >= 2 impact sources on Cab, got {len(cab_imp.impact_sources)}"
    print("[PASS] Test 17: Direct + propagated impact on same node")

def test_18_three_or_more_simultaneous_disruptions():
    items = [
        create_mock_dict_item(1, "FLIGHT", "Flight 1", "2026-10-10T08:00:00", "2026-10-10T10:00:00", "BOM", "DEL"),
        create_mock_dict_item(2, "TRAIN", "Train 1", "2026-10-10T11:00:00", "2026-10-10T15:00:00", "DEL", "JAI"),
        create_mock_dict_item(3, "CAB", "Cab 1", "2026-10-10T15:30:00", "2026-10-10T16:00:00", "JAI", "Hotel"),
        create_mock_dict_item(4, "HOTEL", "Hotel 1", "2026-10-10T17:00:00", "2026-10-12T11:00:00", "JAI", "JAI"),
    ]
    graph = build_dependency_graph(items)
    disruptions = [
        create_disruption_event(101, 1, "FLIGHT_DELAYED", delay_minutes=90),
        create_disruption_event(102, 2, "TRAIN_DELAYED", delay_minutes=120),
        create_disruption_event(103, 3, "CAB_UNAVAILABLE"),
    ]
    res = ImpactEngine.propagate_impact(graph, disruptions)
    assert len(res.disruption_ids) == 3
    assert res.summary.broken >= 1
    print("[PASS] Test 18: Three or more simultaneous disruptions")

def test_19_shared_weather_cause_affecting_multiple_transport():
    items = [
        create_mock_dict_item(1, "FLIGHT", "Flight BOM-DEL", "2026-10-10T10:00:00", "2026-10-10T12:00:00", "BOM", "DEL"),
        create_mock_dict_item(2, "TRAIN", "Train BOM-PUNE", "2026-10-10T11:00:00", "2026-10-10T15:00:00", "BOM", "PUNE"),
        create_mock_dict_item(3, "FLIGHT", "Flight DEL-CCU", "2026-10-12T10:00:00", "2026-10-12T12:00:00", "DEL", "CCU"),
    ]
    graph = build_dependency_graph(items)
    disruptions = [
        create_disruption_event(101, 1, "FLIGHT_CANCELLED", cause="WEATHER", scope="AIRPORT", location="BOM"),
    ]
    res = ImpactEngine.propagate_impact(graph, disruptions)
    nodes = res.node_impacts
    assert nodes["1"].status == ImpactStatus.BROKEN
    assert nodes["2"].status == ImpactStatus.AT_RISK, "Train departing from BOM also at risk due to weather at BOM"
    assert nodes["3"].status == ImpactStatus.INTACT, "Unrelated flight in DEL on diff date remains INTACT"
    print("[PASS] Test 19: Shared weather cause affecting multiple transport nodes")

def test_20_unrelated_disruptions_isolation():
    items = [
        create_mock_dict_item(1, "FLIGHT", "Flight BOM-DEL", "2026-10-10T10:00:00", "2026-10-10T12:00:00", "BOM", "DEL"),
        create_mock_dict_item(2, "HOTEL", "Hotel Goa", "2026-10-20T14:00:00", "2026-10-22T11:00:00", "GOA", "GOA"),
    ]
    graph = build_dependency_graph(items)
    disruptions = [
        create_disruption_event(101, 1, "FLIGHT_CANCELLED"),
    ]
    res = ImpactEngine.propagate_impact(graph, disruptions)
    nodes = res.node_impacts
    assert nodes["1"].status == ImpactStatus.BROKEN
    assert nodes["2"].status == ImpactStatus.INTACT, "Unrelated hotel in Goa on different dates must remain INTACT"
    print("[PASS] Test 20: Unrelated disruptions isolation")


# ── Test 21: Journey status — Flight + Hotel CANCELLED → DISRUPTED ─────────

def test_21_journey_status_disrupted_flight_hotel():
    """
    Acceptance criteria:
      Flight CANCELLED + Hotel CANCELLED → journey_status = DISRUPTED
      needs_recovery = 2, unchanged ≥ 1, at_risk = 0
    """
    from services.impact.models import JourneyStatus

    items = [
        create_mock_dict_item(101, "FLIGHT", "IndiGo BOM\u2192DEL",
            "2026-09-24T06:00:00", "2026-09-24T08:00:00", "BOM", "DEL"),
        create_mock_dict_item(102, "HOTEL",  "Hotel Ram, Delhi",
            "2026-09-24T14:00:00", "2026-09-25T11:00:00", "DEL", "DEL"),
        create_mock_dict_item(103, "CAB",    "Airport Cab",
            "2026-09-24T08:30:00", "2026-09-24T09:30:00", "DEL", "DEL"),
        create_mock_dict_item(104, "ACTIVITY", "City Tour",
            "2026-09-24T10:00:00", "2026-09-24T13:00:00", "DEL", "DEL"),
    ]

    disruptions = [
        create_disruption_event(201, 101, "FLIGHT_CANCELLED", 0,  "AIRLINE", "SINGLE_NODE", "BOM", "Flight cancelled by airline"),
        create_disruption_event(202, 102, "HOTEL_CANCELLED",  0,  "HOTEL",   "SINGLE_NODE", "DEL", "Hotel booking cancelled"),
    ]

    graph = build_dependency_graph(items)
    result = ImpactEngine.propagate_impact(graph, disruptions)

    assert result.journey_status == JourneyStatus.DISRUPTED, \
        f"Expected DISRUPTED, got {result.journey_status}"

    needs_recovery = sum(1 for n in result.nodes if n.status.value in ("BROKEN", "NEEDS_CHANGE"))
    at_risk        = sum(1 for n in result.nodes if n.status.value == "AT_RISK")
    unchanged      = sum(1 for n in result.nodes if n.status.value == "INTACT")

    assert needs_recovery == 2, f"Expected 2 needs_recovery, got {needs_recovery}"
    assert at_risk + unchanged == 2, f"Expected 2 remaining nodes, got {at_risk + unchanged}"

    print("[PASS] Test 21: Journey status DISRUPTED \u2014 Flight + Hotel cancelled")


# ── Test 22: Journey status — AT_RISK only → NORMAL ───────────────────────

def test_22_journey_status_normal_at_risk_only():
    """
    AT_RISK alone does NOT make the journey DISRUPTED.
    If no node is BROKEN or NEEDS_CHANGE, journey_status stays NORMAL.
    """
    from services.impact.models import JourneyStatus, ImpactStatus

    items = [
        create_mock_dict_item(111, "FLIGHT", "Air India BOM\u2192DEL",
            "2026-09-24T06:00:00", "2026-09-24T08:00:00", "BOM", "DEL"),
        create_mock_dict_item(112, "CAB",    "Cab DEL",
            "2026-09-24T08:30:00", "2026-09-24T09:30:00", "DEL", "DEL"),
    ]

    disruptions = [
        create_disruption_event(211, 111, "FLIGHT_DELAYED", 30,
                                "WEATHER", "SINGLE_NODE", "BOM",
                                "Minor weather delay, within buffer"),
    ]

    graph = build_dependency_graph(items)
    result = ImpactEngine.propagate_impact(graph, disruptions)

    has_breakage = any(n.status in (ImpactStatus.BROKEN, ImpactStatus.NEEDS_CHANGE)
                       for n in result.nodes)

    if has_breakage:
        assert result.journey_status == JourneyStatus.DISRUPTED, \
            "Engine produced BROKEN/NEEDS_CHANGE node but journey_status is NORMAL \u2014 inconsistent"
        print("[PASS] Test 22: Journey status DISRUPTED (delay broke connection \u2014 consistent)")
    else:
        assert result.journey_status == JourneyStatus.NORMAL, \
            f"Expected NORMAL for AT_RISK-only scenario, got {result.journey_status}"
        print("[PASS] Test 22: Journey status NORMAL \u2014 AT_RISK only, no breakage")


if __name__ == "__main__":
    test_1_flight_and_train()
    test_2_flight_and_cab()
    test_3_flight_and_hotel()
    test_4_flight_and_activity()
    test_5_train_and_metro()
    test_6_train_and_cab()
    test_7_train_and_hotel()
    test_8_train_and_activity()
    test_9_metro_and_cab()
    test_10_metro_and_activity()
    test_11_cab_and_hotel()
    test_12_cab_and_activity()
    test_13_hotel_and_activity()
    test_14_multiple_transport_disruptions()
    test_15_multiple_direct_cancellations()
    test_16_multiple_delays()
    test_17_direct_and_propagated_impact_on_same_node()
    test_18_three_or_more_simultaneous_disruptions()
    test_19_shared_weather_cause_affecting_multiple_transport()
    test_20_unrelated_disruptions_isolation()
    test_21_journey_status_disrupted_flight_hotel()
    test_22_journey_status_normal_at_risk_only()
    print("\n[ALL 22 TEST MATRIX SCENARIOS PASSED SUCCESSFULLY]")

