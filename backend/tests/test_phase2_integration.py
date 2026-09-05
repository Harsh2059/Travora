import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import app, get_db
import models


SQLALCHEMY_DATABASE_URL = "sqlite:///./test_phase2_travel_engine.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    models.Base.metadata.drop_all(bind=engine)
    models.Base.metadata.create_all(bind=engine)
    yield
    models.Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)



def test_complete_phase2_lifecycle():
    # 1. Seed demo data
    res_seed = client.post("/api/seed")
    assert res_seed.status_code == 200
    user_id = res_seed.json()["user_id"]

    # 2. Get User Trips
    res_trips = client.get(f"/api/users/{user_id}/trips")
    assert res_trips.status_code == 200
    trips = res_trips.json()
    assert len(trips) == 1
    trip_id = trips[0]["id"]
    assert trips[0]["version"] == 1
    assert len(trips[0]["items"]) == 6

    # 3. Test Graph Digital Twin
    res_graph = client.get(f"/api/trips/{trip_id}/graph")
    assert res_graph.status_code == 200
    graph_data = res_graph.json()
    assert graph_data["trip_version"] == 1
    assert graph_data["validation"]["is_valid"] is True
    assert graph_data["graph"]["node_count"] == 6
    assert graph_data["graph"]["edge_count"] >= 5

    # 4. Simulate 4-Hour Flight Delay Disruption
    res_sim = client.post(f"/api/trips/{trip_id}/simulate", json={"scenario_type": "FLIGHT_DELAY_4H"})
    assert res_sim.status_code == 200
    assessment = res_sim.json()["assessment"]
    assert assessment["trip_id"] == trip_id
    assert assessment["components_affected"] >= 4
    assert assessment["affected_percentage"] >= 60.0
    assert assessment["critical_components"] == 1

    # Verify deterministic propagation states:
    # Flight A -> AFFECTED, Flight B -> MISSED, Transfer -> INVALID, Hotel -> AT_RISK, Conference -> AT_RISK
    node_impacts = assessment["node_impacts"]
    assert node_impacts["1"]["impact_status"] == "AFFECTED"
    assert node_impacts["2"]["impact_status"] == "MISSED"
    assert node_impacts["3"]["impact_status"] == "INVALID"
    assert node_impacts["4"]["impact_status"] == "AT_RISK"
    assert node_impacts["5"]["impact_status"] == "AT_RISK"

    # 5. Plan Recovery
    res_rec = client.post(f"/api/trips/{trip_id}/recover", json={
        "preferences": {"time_weight": 0.5, "cost_weight": 0.2, "comfort_weight": 0.2, "directness_weight": 0.1}
    })
    assert res_rec.status_code == 200
    rec_data = res_rec.json()
    plans = rec_data["plans"]
    assert len(plans) >= 3

    # Check top recommended plan
    rec_plan = next((p for p in plans if p["is_recommended"]), None)
    assert rec_plan is not None
    assert rec_plan["feasibility"] is True
    assert rec_plan["preserves_critical_commitment"] is True
    assert rec_plan["explanation_summary"] != ""
    assert "critical_commitment_impact" in rec_plan["explanation_details"]

    # Check that infeasible candidate plan is correctly flagged
    infeasible_plan = next((p for p in plans if not p["feasibility"]), None)
    assert infeasible_plan is not None
    assert len(infeasible_plan["infeasibility_reasons"]) > 0

    # 6. Execute Approved Recovery Plan
    res_exec = client.post(f"/api/trips/{trip_id}/recover/execute", json={"plan": rec_plan})
    assert res_exec.status_code == 200
    exec_res = res_exec.json()
    assert exec_res["previous_version"] == 1
    assert exec_res["new_version"] == 2
    assert "REC-" in exec_res["recovery_id"]

    # 7. Check Version History
    res_hist = client.get(f"/api/trips/{trip_id}/history")
    assert res_hist.status_code == 200
    hist = res_hist.json()
    assert hist["current_version"] == 2
    assert len(hist["history"]) == 1
    assert hist["history"][0]["previous_version"] == 1
    assert hist["history"][0]["new_version"] == 2

    # 8. Cascading Recovery: Disruption on Trip v2
    res_sim2 = client.post(f"/api/trips/{trip_id}/simulate", json={"scenario_type": "FLIGHT_DELAY_4H"})
    assert res_sim2.status_code == 200

    res_rec2 = client.post(f"/api/trips/{trip_id}/recover", json={})
    assert res_rec2.status_code == 200
    assert res_rec2.json()["trip_version"] == 2 # Must operate on current version 2

    rec_plan2 = res_rec2.json()["plans"][0]
    res_exec2 = client.post(f"/api/trips/{trip_id}/recover/execute", json={"plan": rec_plan2})
    assert res_exec2.status_code == 200
    assert res_exec2.json()["previous_version"] == 2
    assert res_exec2.json()["new_version"] == 3

    # Check History after second cascading recovery
    res_hist2 = client.get(f"/api/trips/{trip_id}/history")
    assert len(res_hist2.json()["history"]) == 2
    assert res_hist2.json()["current_version"] == 3
