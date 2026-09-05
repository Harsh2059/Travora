import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app, get_db
import models
from services.state.transition_engine import StateTransitionEngine, InvalidStateTransitionError, ItineraryItemState
from services.recovery.state_machine import RecoveryStateMachine, RecoveryStatus, InvalidRecoveryStateTransitionError
from services.execution.engine import ExecutionEngine, ItineraryVersionConflictError, ExecutionError
from services.ml.preferences import TravelerPreferences
from services.recovery.models import RecoveryPlanModel
from services.events.user_requests import UserRequestParser

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_phase3_travel_engine.db"

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

# ============================================================================
# F01 & F02: State Model and Transitions
# ============================================================================
def test_itinerary_state_transitions_valid():
    # Valid transitions: CONFIRMED -> AT_RISK -> DELAYED -> MODIFIED -> CONFIRMED
    assert StateTransitionEngine.can_transition("CONFIRMED", "AT_RISK") is True
    assert StateTransitionEngine.can_transition("AT_RISK", "DELAYED") is True
    assert StateTransitionEngine.can_transition("DELAYED", "MODIFIED") is True
    assert StateTransitionEngine.can_transition("CONFIRMED", "CANCELLED") is True
    assert StateTransitionEngine.can_transition("CANCELLED", "REFUNDED") is True

def test_itinerary_state_transitions_invalid():
    # Invalid: REFUNDED -> CONFIRMED
    assert StateTransitionEngine.can_transition("REFUNDED", "CONFIRMED") is False
    with pytest.raises(InvalidStateTransitionError):
        StateTransitionEngine.validate_and_transition("REFUNDED", "CONFIRMED", item_id=99)

# ============================================================================
# F03: Recovery Lifecycle State Machine
# ============================================================================
def test_recovery_lifecycle_state_machine():
    sm = RecoveryStateMachine("REC-TEST-1", RecoveryStatus.CREATED)
    assert sm.current_status == RecoveryStatus.CREATED

    # Follow deterministic happy path
    sm.transition_to(RecoveryStatus.ANALYZING)
    sm.transition_to(RecoveryStatus.GENERATING)
    sm.transition_to(RecoveryStatus.VALIDATING)
    sm.transition_to(RecoveryStatus.RANKED)
    sm.transition_to(RecoveryStatus.PRESENTED)
    sm.transition_to(RecoveryStatus.ACCEPTED)
    sm.transition_to(RecoveryStatus.EXECUTING)
    sm.transition_to(RecoveryStatus.COMPLETED)
    assert sm.current_status == RecoveryStatus.COMPLETED

    # Failure & Rollback path
    sm2 = RecoveryStateMachine("REC-TEST-2", RecoveryStatus.EXECUTING)
    sm2.transition_to(RecoveryStatus.FAILED)
    sm2.transition_to(RecoveryStatus.ROLLED_BACK)
    assert sm2.current_status == RecoveryStatus.ROLLED_BACK

    # Disallowed transition
    with pytest.raises(InvalidRecoveryStateTransitionError):
        sm2.transition_to(RecoveryStatus.COMPLETED)

# ============================================================================
# F04 & F05: Execution Safety & Stale Plan Protection
# ============================================================================
def test_stale_plan_protection():
    client.post("/api/seed")
    trips = client.get("/api/users/1/trips").json()
    trip_id = trips[0]["id"]

    # Generate plan for v1
    rec_res = client.post(f"/api/trips/{trip_id}/recover", json={})
    plan = rec_res.json()["plans"][0]
    assert plan["source_itinerary_version"] == 1

    # Execute plan once -> advances to v2
    client.post(f"/api/trips/{trip_id}/recover/execute", json={"plan": plan})
    updated_trip = client.get(f"/api/trips/{trip_id}").json()
    assert updated_trip["version"] == 2

    # Attempt to re-execute a stale plan targeting v1 on trip now at v2
    stale_plan = dict(plan)
    stale_plan["source_itinerary_version"] = 1 # Old version
    stale_plan["recovery_id"] = "REC-NEW-ATTEMPT" # New recovery attempt

    stale_exec_res = client.post(f"/api/trips/{trip_id}/recover/execute", json={"plan": stale_plan})
    assert stale_exec_res.status_code == 400
    assert "Recovery plan is no longer valid because the itinerary has changed" in stale_exec_res.json()["detail"]

# ============================================================================
# F06: Idempotent Execution
# ============================================================================
def test_idempotent_execution():
    client.post("/api/seed")
    trip_id = client.get("/api/users/1/trips").json()[0]["id"]

    rec_res = client.post(f"/api/trips/{trip_id}/recover", json={})
    plan = rec_res.json()["plans"][0]
    recovery_id = "REC-IDEMPOTENT-001"
    plan["recovery_id"] = recovery_id

    # First execution
    res1 = client.post(f"/api/trips/{trip_id}/recover/execute", json={"plan": plan})
    assert res1.status_code == 200
    assert res1.json()["new_version"] == 2

    # Second execution of the exact same plan
    res2 = client.post(f"/api/trips/{trip_id}/recover/execute", json={"plan": plan})
    assert res2.status_code == 200
    assert res2.json()["idempotent"] is True
    assert res2.json()["new_version"] == 2

    # Verify no duplicate history records were created
    hist_res = client.get(f"/api/trips/{trip_id}/history").json()
    assert len(hist_res["history"]) == 1

# ============================================================================
# F07 & F08: Transaction Safety & Mock Booking Execution
# ============================================================================
def test_mock_booking_execution():
    client.post("/api/seed")
    trip_id = client.get("/api/users/1/trips").json()[0]["id"]

    rec_res = client.post(f"/api/trips/{trip_id}/recover", json={})
    plan = rec_res.json()["plans"][0]
    exec_res = client.post(f"/api/trips/{trip_id}/recover/execute", json={"plan": plan})
    assert exec_res.status_code == 200
    data = exec_res.json()
    assert len(data["booking_confirmations"]) > 0
    assert "CONF-" in data["booking_confirmations"][0]["confirmation_code"]

def test_transaction_rollback_on_infeasible_plan():
    client.post("/api/seed")
    trip_id = client.get("/api/users/1/trips").json()[0]["id"]

    db = TestingSessionLocal()
    # Infeasible plan
    infeasible_plan = RecoveryPlanModel(
        plan_id="plan_infeas",
        title="Impossible Plan",
        strategy_type="INVALID",
        feasibility=False,
        infeasibility_reasons=["Violates conference arrival time"]
    )
    with pytest.raises(ExecutionError):
        ExecutionEngine.execute_recovery_plan(db, trip_id, infeasible_plan)
    db.close()

# ============================================================================
# F09 & F10: Recovery History & Version Comparison
# ============================================================================
def test_version_comparison_endpoint():
    client.post("/api/seed")
    trip_id = client.get("/api/users/1/trips").json()[0]["id"]

    # Disruption -> Recover -> Execute -> Trip v2
    client.post(f"/api/trips/{trip_id}/simulate", json={"scenario_type": "FLIGHT_DELAY_4H"})
    rec_res = client.post(f"/api/trips/{trip_id}/recover", json={})
    plan = rec_res.json()["plans"][0]
    client.post(f"/api/trips/{trip_id}/recover/execute", json={"plan": plan})

    # Compare v1 to v2
    comp_res = client.get(f"/api/trips/{trip_id}/compare?v1=1&v2=2")
    assert comp_res.status_code == 200
    comp_data = comp_res.json()
    assert comp_data["trip_id"] == trip_id
    assert comp_data["version_a"] == 1
    assert comp_data["version_b"] == 2
    assert "financial_diff" in comp_data
    assert "operational_diff" in comp_data
    assert comp_data["commitments"]["critical_commitment_preserved"] is True

# ============================================================================
# F11 & F12: Advanced Preferences & Personalized Ranking
# ============================================================================
def test_advanced_traveler_preferences():
    # Validate non-negative weight validation
    with pytest.raises(ValueError):
        TravelerPreferences(time_weight=-0.5)

    # Time-focused traveler vs Cost-focused traveler
    pref_time = TravelerPreferences(time_weight=0.9, cost_weight=0.1)
    pref_cost = TravelerPreferences(time_weight=0.1, cost_weight=0.9)

    plan_fast_expensive = {"additional_delay_minutes": 10, "net_cost": 25000}
    plan_slow_cheap = {"additional_delay_minutes": 300, "net_cost": 1000}

    score_fast_by_time = pref_time.score_plan(plan_fast_expensive)
    score_slow_by_time = pref_time.score_plan(plan_slow_cheap)
    assert score_fast_by_time > score_slow_by_time

    score_fast_by_cost = pref_cost.score_plan(plan_fast_expensive)
    score_slow_by_cost = pref_cost.score_plan(plan_slow_cheap)
    assert score_slow_by_cost > score_fast_by_cost

# ============================================================================
# F34: Demo Reset
# ============================================================================
def test_demo_reset_endpoint():
    client.post("/api/seed")
    trip_id = client.get("/api/users/1/trips").json()[0]["id"]

    # Simulate disruption and execute recovery to reach v2
    client.post(f"/api/trips/{trip_id}/simulate", json={"scenario_type": "FLIGHT_DELAY_4H"})
    rec_res = client.post(f"/api/trips/{trip_id}/recover", json={})
    client.post(f"/api/trips/{trip_id}/recover/execute", json={"plan": rec_res.json()["plans"][0]})
    assert client.get(f"/api/trips/{trip_id}").json()["version"] == 2

    # Call demo reset
    reset_res = client.post("/api/demo/reset")
    assert reset_res.status_code == 200
    assert reset_res.json()["version"] == 1
    assert reset_res.json()["items_count"] == 6

    # Verify history is purged and trip is at v1
    hist = client.get(f"/api/trips/{trip_id}/history").json()
    assert len(hist["history"]) == 0
    trip = client.get(f"/api/trips/{trip_id}").json()
    assert trip["version"] == 1

# ============================================================================
# F36: User Requested Changes Intent Parsing
# ============================================================================
def test_user_request_parsing():
    p1 = UserRequestParser.parse_request("I need to reach London one day earlier.")
    assert p1["intent_type"] == "CHANGE_ARRIVAL"
    assert p1["advance_hours"] == 24

    p2 = UserRequestParser.parse_request("Keep the conference at all costs.")
    assert p2["intent_type"] == "CRITICAL_COMMITMENT"
    assert p2["priority"] == "CRITICAL"

    p3 = UserRequestParser.parse_request("Please minimize additional cost.")
    assert p3["intent_type"] == "MINIMIZE_COST"
    assert p3["preferences_override"]["cost_weight"] > 0.5
