import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app, get_db
import models

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_cascade_travel_engine.db"

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

def test_full_cascading_recovery_e2e():
    """
    End-to-End Cascading Acceptance Scenario:
    1. Demo reset & load Trip v1
    2. Disruption 1: 4-hour flight delay
    3. Plan 1 accepted -> Trip v2 created
    4. Disruption 2: Cancellation event
    5. Plan 2 accepted -> Trip v3 created
    6. User Request: "I need to reach London one day earlier"
    7. Plan 3 accepted -> Trip v4 created
    8. Verify full audit trail and version comparison across all 4 versions
    """
    # 1. Reset demo & load Trip v1
    res_reset = client.post("/api/demo/reset")
    assert res_reset.status_code == 200
    trip_id = res_reset.json()["trip_id"]

    trip_v1 = client.get(f"/api/trips/{trip_id}").json()
    assert trip_v1["version"] == 1
    assert len(trip_v1["items"]) == 6

    # 2. Stage 1: Flight Delay on Trip v1
    res_sim1 = client.post(f"/api/trips/{trip_id}/simulate", json={"scenario_type": "FLIGHT_DELAY_4H"})
    assert res_sim1.status_code == 200
    assert res_sim1.json()["assessment"]["components_affected"] >= 4

    rec1 = client.post(f"/api/trips/{trip_id}/recover", json={}).json()
    plan1 = rec1["plans"][0]
    assert plan1["source_itinerary_version"] == 1

    exec1 = client.post(f"/api/trips/{trip_id}/recover/execute", json={"plan": plan1}).json()
    assert exec1["new_version"] == 2

    # 3. Stage 2: Flight Cancellation on Trip v2
    res_sim2 = client.post(f"/api/trips/{trip_id}/simulate", json={"scenario_type": "FLIGHT_CANCEL"})
    assert res_sim2.status_code == 200

    rec2 = client.post(f"/api/trips/{trip_id}/recover", json={}).json()
    assert rec2["trip_version"] == 2
    plan2 = rec2["plans"][0]
    assert plan2["source_itinerary_version"] == 2

    exec2 = client.post(f"/api/trips/{trip_id}/recover/execute", json={"plan": plan2}).json()
    assert exec2["new_version"] == 3

    # 4. Stage 3: User Request on Trip v3
    req_res = client.post(f"/api/trips/{trip_id}/user-request", json={
        "request": "I need to reach London one day earlier. Keep the conference at all costs."
    })
    assert req_res.status_code == 200
    user_req_data = req_res.json()
    assert user_req_data["parsed_intent"]["intent_type"] in ["CHANGE_ARRIVAL", "CRITICAL_COMMITMENT"]

    plan3 = user_req_data["plans"][0]
    assert plan3["source_itinerary_version"] == 3

    exec3 = client.post(f"/api/trips/{trip_id}/recover/execute", json={"plan": plan3}).json()
    assert exec3["new_version"] == 4

    # 5. Verify Final Trip v4 and Full History
    final_trip = client.get(f"/api/trips/{trip_id}").json()
    assert final_trip["version"] == 4

    history_res = client.get(f"/api/trips/{trip_id}/history").json()
    histories = history_res["history"]
    assert len(histories) == 3
    assert histories[0]["previous_version"] == 1 and histories[0]["new_version"] == 2
    assert histories[1]["previous_version"] == 2 and histories[1]["new_version"] == 3
    assert histories[2]["previous_version"] == 3 and histories[2]["new_version"] == 4

    # 6. Version Comparison between v1 and v4
    comp = client.get(f"/api/trips/{trip_id}/compare?v1=1&v2=4").json()
    assert comp["version_a"] == 1
    assert comp["version_b"] == 4
    assert len(comp["transition_history"]) == 3
    assert comp["commitments"]["critical_commitment_preserved"] is True
