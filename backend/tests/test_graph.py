import pytest
from datetime import datetime, timedelta
import networkx as nx
from services.graph.builder import build_dependency_graph, DependencyType
from services.graph.queries import GraphQueries
from services.graph.validator import validate_graph, GraphValidationError

def create_sample_itinerary():
    now = datetime(2026, 10, 1, 10, 0)
    return [
        {
            "id": 1,
            "trip_id": 1,
            "type": "FLIGHT",
            "provider": "Air India",
            "origin": "Mumbai (BOM)",
            "destination": "Delhi (DEL)",
            "start_time": now,
            "end_time": now + timedelta(hours=2),
            "cost": 5000,
            "priority": "HIGH",
            "flexibility": "FLEXIBLE",
            "status": "CONFIRMED",
            "booking_id": "AI101",
            "refundable": False,
            "changeable": True,
            "change_fee": 2000
        },
        {
            "id": 2,
            "trip_id": 1,
            "type": "FLIGHT",
            "provider": "British Airways",
            "origin": "Delhi (DEL)",
            "destination": "London (LHR)",
            "start_time": now + timedelta(hours=4), # 2 hour layover
            "end_time": now + timedelta(hours=13),
            "cost": 45000,
            "priority": "HIGH",
            "flexibility": "FLEXIBLE",
            "status": "CONFIRMED",
            "booking_id": "BA202",
            "refundable": True,
            "refund_percentage": 50,
            "changeable": True
        },
        {
            "id": 3,
            "trip_id": 1,
            "type": "TRANSFER",
            "provider": "Heathrow Express",
            "origin": "London (LHR)",
            "destination": "London Paddington",
            "start_time": now + timedelta(hours=14),
            "end_time": now + timedelta(hours=14, minutes=30),
            "cost": 2500,
            "priority": "MEDIUM",
            "flexibility": "VERY_FLEXIBLE",
            "status": "CONFIRMED"
        },
        {
            "id": 4,
            "trip_id": 1,
            "type": "HOTEL",
            "provider": "Marriott London",
            "location": "London",
            "start_time": now + timedelta(hours=15),
            "end_time": now + timedelta(days=3),
            "cost": 30000,
            "priority": "MEDIUM",
            "flexibility": "FLEXIBLE",
            "status": "CONFIRMED",
            "refundable": True,
            "refund_percentage": 80,
            "change_fee": 500
        },
        {
            "id": 5,
            "trip_id": 1,
            "type": "EVENT",
            "provider": "Tech Conference 2026",
            "location": "London",
            "start_time": now + timedelta(days=1, hours=9),
            "end_time": now + timedelta(days=1, hours=17),
            "cost": 0,
            "priority": "CRITICAL",
            "flexibility": "FIXED",
            "status": "CONFIRMED"
        },
        {
            "id": 6,
            "trip_id": 1,
            "type": "FLIGHT",
            "provider": "Virgin Atlantic",
            "origin": "London (LHR)",
            "destination": "Mumbai (BOM)",
            "start_time": now + timedelta(days=3, hours=4),
            "end_time": now + timedelta(days=3, hours=14),
            "cost": 40000,
            "priority": "HIGH",
            "flexibility": "FIXED",
            "status": "CONFIRMED"
        }
    ]

def test_graph_builder_dynamic_inference():
    items = create_sample_itinerary()
    G = build_dependency_graph(items)
    
    assert len(G.nodes) == 6
    assert G.has_edge(1, 2)
    assert G.edges[1, 2]["dependency_type"] == DependencyType.CONNECTION
    
    assert G.has_edge(2, 3)
    assert G.edges[2, 3]["dependency_type"] == DependencyType.TRANSFER
    
    assert G.has_edge(3, 4)
    assert G.edges[3, 4]["dependency_type"] == DependencyType.ACCOMMODATION
    
    # Event during stay or after hotel
    assert G.has_edge(4, 5)
    assert G.edges[4, 5]["dependency_type"] == DependencyType.EVENT

def test_graph_queries():
    items = create_sample_itinerary()
    G = build_dependency_graph(items)
    queries = GraphQueries(G)
    
    # Critical items
    critical = queries.get_critical_items()
    assert len(critical) == 1
    assert critical[0]["id"] == 5
    assert critical[0]["priority"] == "CRITICAL"
    
    # Downstream of flight A (id=1)
    downstream = queries.get_downstream_items(1)
    assert 2 in downstream
    assert 5 in downstream # Conference is downstream of flight A
    
    # Upstream of conference (id=5)
    upstream = queries.get_upstream_items(5)
    assert 1 in upstream
    assert 2 in upstream
    assert 4 in upstream
    
    # Path
    path = queries.get_path_between_items(1, 5)
    assert path is not None
    assert path[0] == 1
    assert path[-1] == 5

def test_graph_validation_acyclic():
    items = create_sample_itinerary()
    G = build_dependency_graph(items)
    res = validate_graph(G)
    assert res["is_valid"] is True
    assert res["node_count"] == 6

def test_graph_validation_cycle_detection():
    items = create_sample_itinerary()
    G = build_dependency_graph(items)
    # introduce a cycle
    G.add_edge(5, 1, dependency_type="TEMPORAL")
    with pytest.raises(GraphValidationError) as exc_info:
        validate_graph(G)
    assert "cycle" in str(exc_info.value).lower()

def test_graph_validation_invalid_dependency_type():
    items = create_sample_itinerary()
    G = build_dependency_graph(items)
    G.add_edge(1, 4, dependency_type="UNKNOWN_TYPE")
    with pytest.raises(GraphValidationError) as exc_info:
        validate_graph(G)
    assert "invalid dependency type" in str(exc_info.value).lower()
