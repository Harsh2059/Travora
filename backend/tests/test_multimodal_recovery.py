import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from main import app
from services.availability.provider import MockAvailabilityProvider

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_demo():
    client.post("/api/seed")
    yield

def test_mock_availability_provider():
    provider = MockAvailabilityProvider()
    
    # 1. Train search
    trains = provider.find_alternate_trains("New Delhi (NDLS)", "Jaipur (JP)", datetime.now())
    assert len(trains) >= 2
    assert any("Vande Bharat" in t["provider"] for t in trains)
    assert any(t["type"] == "TRAIN" for t in trains)

    # 2. Hotel search
    hotels = provider.find_alternate_hotels("London", datetime.now(), datetime.now() + timedelta(days=2))
    assert len(hotels) >= 2
    assert any(h["type"] == "HOTEL" for h in hotels)

    # 3. Transfer search
    transfers = provider.find_alternate_transfers("London (LHR)", "London City", datetime.now())
    assert len(transfers) >= 2
    assert any(tr["type"] == "TRANSFER" for tr in transfers)

    # 4. Activity search
    activities = provider.find_alternate_activities("London", datetime.now())
    assert len(activities) >= 2
    assert any(act["type"] == "ACTIVITY" for act in activities)


def test_transfer_failure_recovery():
    """Test transfer disruption (Heathrow Express failure) generates cab dispatch and shuttle recovery."""
    client.post("/api/demo/reset")
    trip_res = client.get("/api/trips/1")
    items = trip_res.json()["items"]
    transfer_item = next(it for it in items if it["type"] == "TRANSFER")

    # Simulate transfer failure
    sim_res = client.post("/api/trips/1/simulate", json={"scenario_type": "TRANSFER_FAILURE"})
    assert sim_res.status_code == 200
    sim_data = sim_res.json()
    assert sim_data["assessment"]["components_affected"] >= 1

    # Generate recovery
    rec_res = client.post("/api/trips/1/recover", json={})
    assert rec_res.status_code == 200
    rec_data = rec_res.json()
    plans = rec_data["plans"]
    assert len(plans) >= 2
    strategies = [p["strategy_type"] for p in plans]
    assert "TRANSFER_REBOOK_CAB" in strategies
    assert "TRANSFER_REBOOK_SHUTTLE" in strategies

    # Verify best plan has explanation and valid cost/timeline
    best_plan = plans[0]
    assert best_plan["feasibility"] is True
    assert best_plan["explanation_summary"] != ""
    assert best_plan["trade_offs"]["what_you_gain"] != ""


def test_hotel_unavailable_recovery():
    """Test hotel disruption (Marriott unavailable) generates partner and economy hotel alternatives."""
    client.post("/api/demo/reset")
    trip_res = client.get("/api/trips/1")
    items = trip_res.json()["items"]
    hotel_item = next(it for it in items if it["type"] == "HOTEL")

    # Simulate hotel unavailable
    sim_res = client.post("/api/trips/1/simulate", json={"scenario_type": "HOTEL_UNAVAILABLE"})
    assert sim_res.status_code == 200

    # Generate recovery
    rec_res = client.post("/api/trips/1/recover", json={})
    assert rec_res.status_code == 200
    rec_data = rec_res.json()
    plans = rec_data["plans"]
    assert len(plans) >= 2
    strategies = [p["strategy_type"] for p in plans]
    assert "HOTEL_REBOOK_LUXURY" in strategies
    assert "HOTEL_REBOOK_BUDGET" in strategies

    # Check that conference event remains preserved
    for plan in plans:
        event_preserved = any(it.get("type") in ["EVENT", "ACTIVITY"] for it in plan["preserved_items"])
        assert event_preserved is True


def test_activity_cancelled_recovery():
    """Test conference / activity disruption generates reschedule and refund credit candidates."""
    client.post("/api/demo/reset")
    trip_res = client.get("/api/trips/1")
    items = trip_res.json()["items"]
    act_item = next(it for it in items if it["type"] in ["EVENT", "ACTIVITY"])

    # Simulate activity cancelled
    sim_res = client.post("/api/trips/1/simulate", json={"scenario_type": "ACTIVITY_CANCELLED"})
    assert sim_res.status_code == 200

    # Generate recovery
    rec_res = client.post("/api/trips/1/recover", json={})
    assert rec_res.status_code == 200
    rec_data = rec_res.json()
    plans = rec_data["plans"]
    assert len(plans) >= 2
    strategies = [p["strategy_type"] for p in plans]
    assert "ACTIVITY_RESCHEDULE" in strategies
    assert "ACTIVITY_CANCEL_REFUND" in strategies


def test_train_disruption_crossmodal_recovery():
    """Test train disruption recovery with express train rebooking and cross-modal flight options."""
    now = datetime.now()
    # Create custom trip with a TRAIN item
    user_res = client.get("/api/users")
    user_id = user_res.json()[0]["id"]

    # Directly test recovery generator for a TRAIN item
    train_item = {
        "id": 901,
        "type": "TRAIN",
        "provider": "Shatabdi Express",
        "origin": "New Delhi (NDLS)",
        "destination": "Jaipur (JP)",
        "start_time": now + timedelta(hours=2),
        "end_time": now + timedelta(hours=6),
        "cost": 1200,
        "priority": "HIGH",
        "flexibility": "FLEXIBLE",
        "status": "CONFIRMED",
        "booking_id": "SHATABDI-12015",
        "refundable": True,
        "changeable": True,
        "change_fee": 250,
        "cancellation_fee": 400
    }
    transfer_item = {
        "id": 902,
        "type": "TRANSFER",
        "provider": "Jaipur Station Taxi",
        "origin": "Jaipur (JP)",
        "destination": "Hotel Rajputana",
        "start_time": now + timedelta(hours=6, minutes=15),
        "end_time": now + timedelta(hours=7),
        "cost": 600,
        "priority": "MEDIUM",
        "flexibility": "FLEXIBLE",
        "status": "CONFIRMED",
        "booking_id": "TAX-902",
        "refundable": True,
        "changeable": True
    }
    hotel_item = {
        "id": 903,
        "type": "HOTEL",
        "provider": "ITC Rajputana",
        "location": "Jaipur",
        "start_time": now + timedelta(hours=7, minutes=30),
        "end_time": now + timedelta(days=2),
        "cost": 15000,
        "priority": "HIGH",
        "flexibility": "FLEXIBLE",
        "status": "CONFIRMED",
        "booking_id": "HTL-903",
        "refundable": True,
        "changeable": True
    }

    items = [train_item, transfer_item, hotel_item]
    from services.recovery.generator import RecoveryEngine
    from services.ml.preferences import TravelerPreferences

    event = {
        "event_type": "TRAIN_CANCEL",
        "entity_id": 901,
        "event_metadata": {"reason": "Track signaling maintenance"}
    }
    prefs = TravelerPreferences(time_weight=0.6, cost_weight=0.2, comfort_weight=0.2, directness_weight=0.0)

    plans = RecoveryEngine.generate_and_rank_recovery_plans(
        original_items=items,
        event=event,
        preferences=prefs,
        source_itinerary_version=1,
        trip_id=1
    )

    assert len(plans) >= 3
    strategies = [p.strategy_type for p in plans]
    # Express train rebook
    assert "TRAIN_REBOOK_EXPRESS" in strategies
    # Budget train rebook
    assert "TRAIN_REBOOK_BUDGET" in strategies
    # Cross-modal flight upgrade
    assert "CROSSMODAL_FLIGHT_REROUTE" in strategies

    # Express plan should also reschedule the downstream transfer
    express_plan = next(p for p in plans if p.strategy_type == "TRAIN_REBOOK_EXPRESS")
    assert any(it["type"] == "TRANSFER" for it in express_plan.added_items)
