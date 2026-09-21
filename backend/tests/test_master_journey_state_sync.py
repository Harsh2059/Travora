import os
import sys
import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import database
import models
from main import app

client = TestClient(app)

@pytest.fixture
def db_session_fixture(tmp_path):
    db_file = tmp_path / "test_travora_sync.db"
    test_engine = create_engine(
        f"sqlite:///{db_file}",
        connect_args={"check_same_thread": False, "timeout": 15}
    )
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    models.Base.metadata.create_all(bind=test_engine)

    # Override engine and SessionLocal in database module so main.py and engine.py use test_engine
    orig_engine = database.engine
    orig_sessionlocal = database.SessionLocal

    database.engine = test_engine
    database.SessionLocal = TestSessionLocal

    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[database.get_db] = override_get_db

    session = TestSessionLocal()
    trip = models.Trip(id=999, title="Master State Dynamic Trip", version=1)
    session.add(trip)
    session.commit()

    now = datetime.now(timezone.utc)
    items = [
        models.ItineraryItem(
            id=1001,
            trip_id=999,
            type="FLIGHT",
            provider="IndiGo",
            origin="Mumbai Airport (BOM)",
            destination="Jaipur Airport (JAI)",
            location="Mumbai Airport (BOM)",
            start_time=now + timedelta(hours=2),
            end_time=now + timedelta(hours=4),
            cost=4500.0,
            status="CONFIRMED",
            booking_id="6E-204",
            item_metadata={"flight_number": "6E-204", "origin_airport": "BOM", "destination_airport": "JAI"}
        ),
        models.ItineraryItem(
            id=1002,
            trip_id=999,
            type="CAB",
            provider="Ola",
            origin="Jaipur Airport (JAI)",
            destination="Hotel Ram Jaipur",
            location="Jaipur Airport (JAI)",
            start_time=now + timedelta(hours=4, minutes=30),
            end_time=now + timedelta(hours=5, minutes=30),
            cost=600.0,
            status="CONFIRMED",
            booking_id="OLA-99",
            item_metadata={}
        ),
        models.ItineraryItem(
            id=1003,
            trip_id=999,
            type="HOTEL",
            provider="Hotel Ram",
            origin="Hotel Ram Jaipur",
            destination="Hotel Ram Jaipur",
            location="Jaipur City",
            start_time=now + timedelta(hours=6),
            end_time=now + timedelta(days=2),
            cost=7000.0,
            status="CONFIRMED",
            booking_id="HOTEL-RAM-1",
            item_metadata={}
        )
    ]
    session.add_all(items)
    session.commit()
    session.close()

    yield 999

    app.dependency_overrides.clear()
    database.engine = orig_engine
    database.SessionLocal = orig_sessionlocal


def test_state_1_dynamic_journey_creation(db_session_fixture):
    """TEST_STATE_1: Verify payload contains items, original_items, and all_items separated properly."""
    res = client.get(f"/api/trips/{db_session_fixture}")
    assert res.status_code == 200
    data = res.json()

    assert "items" in data
    assert "original_items" in data
    assert "all_items" in data
    assert len(data["items"]) == 3
    assert len(data["original_items"]) == 3
    assert len(data["all_items"]) == 3
    assert data["items"][0]["origin"] == "Mumbai Airport (BOM)"
    assert data["items"][0]["destination"] == "Jaipur Airport (JAI)"


def test_state_2_canonical_journey_structure(db_session_fixture):
    """TEST_STATE_2: activeJourney logic returns originalJourney when viewMode is ORIGINAL."""
    res = client.get(f"/api/trips/{db_session_fixture}")
    assert res.status_code == 200
    data = res.json()

    assert data["view_mode"] == "ORIGINAL"
    assert data["activeJourney"] == data["originalJourney"]
    assert data["currentRecoveredJourney"] is None


def test_state_3_disruption_injection(db_session_fixture):
    """TEST_STATE_3: Disrupting an item marks status DISRUPTED and records disruption payload."""
    res = client.post(f"/api/trips/{db_session_fixture}/disruptions", json={
        "item_id": 1001,
        "disruption_type": "CANCELLED",
        "severity": "HIGH",
        "description": "IndiGo 6E-204 cancelled due to operational reasons"
    })
    assert res.status_code == 200
    disruption_data = res.json()
    assert disruption_data["status"] == "ACTIVE"

    res2 = client.get(f"/api/trips/{db_session_fixture}")
    assert res2.status_code == 200
    data2 = res2.json()
    assert len(data2["activeDisruptions"]) == 1
    assert data2["activeDisruptions"][0]["item_id"] == 1001


def test_state_4_recovery_candidate_route_feasibility(db_session_fixture):
    """TEST_STATE_4: Candidate generation returns route-specific feasible flight candidates."""
    client.post(f"/api/trips/{db_session_fixture}/disruptions", json={
        "item_id": 1001,
        "disruption_type": "CANCELLED",
        "severity": "HIGH",
        "description": "Flight cancelled"
    })

    res = client.post(f"/api/trips/{db_session_fixture}/recovery/options", json={"item_id": 1001})
    assert res.status_code == 200
    data = res.json()

    assert "options" in data
    options = data["options"]
    assert len(options) > 0

    for opt in options:
        rep = opt.get("replacement_flight") or opt.get("candidate")
        if rep:
            assert rep.get("origin_airport") == "BOM"
            assert rep.get("destination_airport") == "JAI"


def test_state_5_patch_based_recovery_execution(db_session_fixture):
    """TEST_STATE_5: Executing recovery PATCHES the active journey, preserving unaffected nodes."""
    client.post(f"/api/trips/{db_session_fixture}/disruptions", json={
        "item_id": 1001,
        "disruption_type": "CANCELLED",
        "severity": "HIGH",
        "description": "Flight cancelled"
    })

    opts_res = client.post(f"/api/trips/{db_session_fixture}/recovery/options", json={"item_id": 1001})
    options = opts_res.json()["options"]
    selected_option = options[0]

    exec_res = client.post(f"/api/trips/{db_session_fixture}/recovery/execute", json={
        "item_id": 1001,
        "option": selected_option
    })
    assert exec_res.status_code == 200
    exec_data = exec_res.json()

    assert exec_data["viewMode"] == "RECOVERED"
    assert exec_data["currentRecoveredJourney"] is not None

    recovered_items = exec_data["currentRecoveredJourney"]["items"]
    assert len(recovered_items) == 3

    item_types = [it["type"] for it in recovered_items]
    assert "FLIGHT" in item_types
    assert "CAB" in item_types
    assert "HOTEL" in item_types


def test_state_6_original_journey_immutability(db_session_fixture):
    """TEST_STATE_6: Original journey remains completely unchanged after recovery execution."""
    client.post(f"/api/trips/{db_session_fixture}/disruptions", json={
        "item_id": 1001,
        "disruption_type": "CANCELLED",
        "severity": "HIGH",
        "description": "Flight cancelled"
    })

    opts_res = client.post(f"/api/trips/{db_session_fixture}/recovery/options", json={"item_id": 1001})
    selected_option = opts_res.json()["options"][0]

    client.post(f"/api/trips/{db_session_fixture}/recovery/execute", json={
        "item_id": 1001,
        "option": selected_option
    })

    trip_res = client.get(f"/api/trips/{db_session_fixture}")
    data = trip_res.json()

    original_flight = [it for it in data["original_items"] if it["type"] == "FLIGHT"][0]
    assert original_flight["id"] == 1001
    assert original_flight["provider"] == "IndiGo"


def test_state_7_view_mode_toggle_safety(db_session_fixture):
    """TEST_STATE_7: viewMode toggle behaves safely and preserves recovered journey fallback."""
    trip_res = client.get(f"/api/trips/{db_session_fixture}")
    data = trip_res.json()
    assert data["activeJourney"] == data["originalJourney"]

    client.post(f"/api/trips/{db_session_fixture}/disruptions", json={
        "item_id": 1001,
        "disruption_type": "CANCELLED",
        "severity": "HIGH",
        "description": "Flight cancelled"
    })
    opts_res = client.post(f"/api/trips/{db_session_fixture}/recovery/options", json={"item_id": 1001})
    selected_option = opts_res.json()["options"][0]
    client.post(f"/api/trips/{db_session_fixture}/recovery/execute", json={
        "item_id": 1001,
        "option": selected_option
    })

    toggle_res = client.patch(f"/api/trips/{db_session_fixture}/view_mode", json={"view_mode": "ORIGINAL"})
    assert toggle_res.status_code == 200
    assert toggle_res.json()["view_mode"] == "ORIGINAL"

    data_after = client.get(f"/api/trips/{db_session_fixture}").json()
    assert data_after["view_mode"] == "ORIGINAL"
    assert data_after["activeJourney"]["items"] == data_after["original_items"]

    toggle_res2 = client.patch(f"/api/trips/{db_session_fixture}/view_mode", json={"view_mode": "RECOVERED"})
    assert toggle_res2.status_code == 200
    assert toggle_res2.json()["view_mode"] == "RECOVERED"

    data_after2 = client.get(f"/api/trips/{db_session_fixture}").json()
    assert data_after2["view_mode"] == "RECOVERED"
    assert data_after2["activeJourney"] == data_after2["currentRecoveredJourney"]


def test_state_8_items_vs_all_items_separation(db_session_fixture):
    """TEST_STATE_8: items contains active non-replaced nodes; all_items contains full DB history."""
    client.post(f"/api/trips/{db_session_fixture}/disruptions", json={
        "item_id": 1001,
        "disruption_type": "CANCELLED",
        "severity": "HIGH",
        "description": "Flight cancelled"
    })
    opts_res = client.post(f"/api/trips/{db_session_fixture}/recovery/options", json={"item_id": 1001})
    selected_option = opts_res.json()["options"][0]
    client.post(f"/api/trips/{db_session_fixture}/recovery/execute", json={
        "item_id": 1001,
        "option": selected_option
    })

    data = client.get(f"/api/trips/{db_session_fixture}").json()
    # Active items = 3 (replacement flight + any replacement cascade + hotel)
    assert len(data["items"]) == 3
    # Original items snapshot remains 3 (the original pre-recovery items)
    assert len(data["original_items"]) == 3
    # all_items >= 4 (3 original + at least 1 replacement; may be more due to cascade)
    assert len(data["all_items"]) >= 4

    replaced_items = [it for it in data["all_items"] if it.get("status") in ("REPLACED", "CANCELLED")]
    assert len(replaced_items) >= 1


def test_state_9_recovery_history_audit(db_session_fixture):
    """TEST_STATE_9: recovery_history logs exact replacement trail."""
    client.post(f"/api/trips/{db_session_fixture}/disruptions", json={
        "item_id": 1001,
        "disruption_type": "CANCELLED",
        "severity": "HIGH",
        "description": "Flight cancelled"
    })
    opts_res = client.post(f"/api/trips/{db_session_fixture}/recovery/options", json={"item_id": 1001})
    selected_option = opts_res.json()["options"][0]
    client.post(f"/api/trips/{db_session_fixture}/recovery/execute", json={
        "item_id": 1001,
        "option": selected_option
    })

    data = client.get(f"/api/trips/{db_session_fixture}").json()
    # At least 1 recovery_history entry must exist
    assert len(data["recovery_history"]) >= 1
    # Find the entry that corresponds to the disrupted flight (item_id 1001)
    flight_rec = next(
        (r for r in data["recovery_history"] if r.get("original_item_id") == 1001),
        None
    )
    assert flight_rec is not None, "No recovery_history entry for original_item_id=1001"
    assert flight_rec["replacement_item_id"] is not None


def test_state_10_traveler_admin_single_source_of_truth(db_session_fixture):
    """TEST_STATE_10: Traveler and Admin read identical payload from GET /api/trips/{trip_id}."""
    res_traveler = client.get(f"/api/trips/{db_session_fixture}")
    res_admin = client.get(f"/api/trips/{db_session_fixture}")

    assert res_traveler.status_code == 200
    assert res_admin.status_code == 200
    assert res_traveler.json() == res_admin.json()
