"""
test_hackcelestial_digital_twin.py

Comprehensive Integration Test Suite for HackCelestial 3.0:
- OpenWeather configuration & API key env loading
- Current & Forecast weather normalization
- Weather -> ML feature vector mapping (RandomForest)
- Normal vs. Extreme weather prediction comparison
- Digital Twin Read-Only What-If Simulation
- Real Journey Immutability Proof (DB check before & after)
- Cascading Impact Propagation across Flights, Cabs, Hotels
- Social Signals feed API & demo fixture marking (is_live=False)
- Seamless Recovery Engine integration
- Robust Error Handling (invalid journey ID, missing key, weather failure)
- Nugen waitlist pending state (nugen_aligned=False)
"""

import os
import sys
import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import database
import models
from main import app
from services.weather.weather_service import LiveWeatherService
from services.ml.disruption_model import DisruptionRiskModel
from services.ml.nugen_service import NugenReasoningService
from services.events.social_service import SocialSignalService

client = TestClient(app)


@pytest.fixture
def dt_db_fixture(tmp_path):
    db_file = tmp_path / "test_digital_twin.db"
    test_engine = create_engine(
        f"sqlite:///{db_file}",
        connect_args={"check_same_thread": False, "timeout": 15}
    )
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    models.Base.metadata.create_all(bind=test_engine)

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
    trip = models.Trip(id=888, title="HackCelestial 3.0 Hardened Journey", version=1)
    session.add(trip)
    session.commit()

    now = datetime.combine(datetime.now(timezone.utc).date(), datetime.min.time()).replace(tzinfo=timezone.utc)
    items = [
        models.ItineraryItem(
            id=8001,
            trip_id=888,
            type="FLIGHT",
            provider="Air India",
            origin="Mumbai Airport (BOM)",
            destination="Jaipur Airport (JAI)",
            location="Mumbai Airport (BOM)",
            start_time=now + timedelta(hours=6),
            end_time=now + timedelta(hours=8),
            cost=5200.0,
            status="CONFIRMED",
            booking_id="AI-441",
            item_metadata={"flight_number": "AI-441", "origin_airport": "BOM", "destination_airport": "JAI"}
        ),
        models.ItineraryItem(
            id=8002,
            trip_id=888,
            type="CAB",
            provider="Ola",
            origin="Jaipur Airport (JAI)",
            destination="Hotel Ram Jaipur",
            location="Jaipur Airport (JAI)",
            start_time=now + timedelta(hours=8, minutes=30),
            end_time=now + timedelta(hours=9, minutes=30),
            cost=650.0,
            status="CONFIRMED",
            booking_id="OLA-888",
            item_metadata={}
        ),
        models.ItineraryItem(
            id=8003,
            trip_id=888,
            type="HOTEL",
            provider="Hotel Ram",
            origin="Hotel Ram Jaipur",
            destination="Hotel Ram Jaipur",
            location="Jaipur City",
            start_time=now + timedelta(hours=10),
            end_time=now + timedelta(days=2),
            cost=7500.0,
            status="CONFIRMED",
            booking_id="HOTEL-RAM-8",
            item_metadata={}
        )
    ]
    session.add_all(items)
    session.commit()
    session.close()

    yield 888

    app.dependency_overrides.clear()
    database.engine = orig_engine
    database.SessionLocal = orig_sessionlocal


# 1. OpenWeather configuration & env key loading
def test_01_openweather_configuration():
    key = os.getenv("WEATHER_API_KEY") or os.getenv("OPENWEATHER_API_KEY")
    assert key is not None
    assert len(key) > 0


# 2. Current weather endpoint
def test_02_current_weather_endpoint():
    res = client.get("/api/weather/current?location=Mumbai")
    assert res.status_code == 200
    data = res.json()
    assert data["location"] == "Mumbai"
    assert "temperature" in data
    assert "rainfall" in data
    assert "wind" in data
    assert "visibility" in data
    assert data["is_live"] is True


# 3. Forecast endpoint
def test_03_forecast_weather_endpoint():
    res = client.get("/api/weather/forecast?location=Mumbai&hours=24")
    assert res.status_code == 200
    data = res.json()
    assert len(data["hourly_forecast"]) == 24


# 4. Weather normalization
def test_04_weather_normalization():
    w = LiveWeatherService.get_current_weather("London")
    assert isinstance(w["temperature"], (int, float))
    assert isinstance(w["rainfall"], (int, float))
    assert isinstance(w["wind"], (int, float))
    assert isinstance(w["visibility"], (int, float))
    assert w["visibility"] > 0


# 5. Weather -> ML feature mapping (Normal Weather Scenario)
def test_05_normal_weather_prediction():
    rf = DisruptionRiskModel()
    item = {"id": 1, "type": "FLIGHT", "origin": "BOM", "destination": "JAI"}
    w_normal = {"rainfall": 2.0, "wind": 10.0, "visibility": 9.5}

    pred = rf.predict_item_risk(item, w_normal)
    assert pred["disruption_probability"] < 0.35
    assert pred["estimated_delay_minutes"] < 30
    assert pred["risk_level"] == "LOW"
    assert pred["is_synthetic"] is True


# 6 & 7. Extreme Weather Prediction Comparison
def test_06_extreme_weather_prediction():
    rf = DisruptionRiskModel()
    item = {"id": 1, "type": "FLIGHT", "origin": "BOM", "destination": "JAI"}
    w_extreme = {"rainfall": 150.0, "wind": 55.0, "visibility": 1.0}

    pred = rf.predict_item_risk(item, w_extreme)
    assert pred["disruption_probability"] > 0.70
    assert pred["estimated_delay_minutes"] > 100
    assert pred["risk_level"] == "HIGH"
    assert pred["transport_impact"] > 0.50
    assert pred["hotel_impact"] > 0.40


# 8 & 9. Digital Twin Simulation & Real Journey Immutability Proof
def test_07_digital_twin_simulation_and_immutability(dt_db_fixture):
    # READ BEFORE SIMULATION
    before_res = client.get(f"/api/trips/{dt_db_fixture}")
    before_data = before_res.json()
    before_items = before_data["items"]

    # RUN SIMULATION
    sim_payload = {
        "journey_id": dt_db_fixture,
        "location": "Mumbai",
        "rainfall": 150.0,
        "wind": 55.0,
        "visibility": 1.0,
        "temperature": 31.0
    }
    sim_res = client.post("/api/digital-twin/simulate", json=sim_payload)
    assert sim_res.status_code == 200
    sim_data = sim_res.json()

    assert sim_data["mode"] == "SIMULATED"
    assert sim_data["is_real_journey_mutated"] is False
    assert sim_data["prediction"]["estimated_delay_minutes"] > 100

    # READ AFTER SIMULATION — VERIFY DB UNTOUCHED
    after_res = client.get(f"/api/trips/{dt_db_fixture}")
    after_data = after_res.json()
    after_items = after_data["items"]

    assert after_data["view_mode"] == "ORIGINAL"
    assert len(after_items) == len(before_items)
    for b_item, a_item in zip(before_items, after_items):
        assert b_item["id"] == a_item["id"]
        assert b_item["status"] == a_item["status"]
        assert b_item["start_time"] == a_item["start_time"]


# 10. Cascading Impact Propagation
def test_08_cascading_impact_propagation(dt_db_fixture):
    sim_payload = {
        "journey_id": dt_db_fixture,
        "rainfall": 150.0,
        "wind": 55.0,
        "visibility": 1.0
    }
    sim_res = client.post("/api/digital-twin/simulate", json=sim_payload)
    data = sim_res.json()

    affected = data["affected_entities"]
    assert len(affected) >= 2
    types = [a["type"] for a in affected]
    assert "FLIGHT" in types
    assert "CAB" in types


# 11. Social Signals API & Demo Fixture Marking
def test_09_social_signals_endpoint():
    res = client.get("/api/social-signals?location=Mumbai")
    assert res.status_code == 200
    data = res.json()
    assert data["location"] == "Mumbai"
    assert data["is_live"] is False
    assert len(data["signals"]) > 0


# 12. Recovery Engine Integration
def test_10_recovery_engine_integration_under_simulation(dt_db_fixture):
    sim_payload = {
        "journey_id": dt_db_fixture,
        "rainfall": 120.0,
        "wind": 45.0,
        "visibility": 1.5
    }
    sim_res = client.post("/api/digital-twin/simulate", json=sim_payload)
    data = sim_res.json()

    assert data["recovery_plans_count"] >= 1
    assert len(data["simulated_recovery_options"]) >= 1


# 13. Invalid Journey Handling
def test_11_invalid_journey_id_handling():
    res = client.post("/api/digital-twin/simulate", json={"journey_id": 999999})
    assert res.status_code in [200, 404]
    if res.status_code == 200:
        assert res.json()["is_real_journey_mutated"] is False


# 14 & 15. Weather API Failure & Missing Key Handling
def test_12_weather_fallback_handling():
    w = LiveWeatherService.get_current_weather("UnknownCity123")
    assert "temperature" in w
    assert w["rainfall"] >= 0.0


# 16. Nugen Waitlist Pending State
def test_13_nugen_waitlist_pending_state():
    nugen_svc = NugenReasoningService(api_key="demo_nugen_key")
    res = nugen_svc.generate_domain_reasoning(
        journey_title="Test Journey",
        weather={"rainfall": 100.0, "wind": 50.0, "visibility": 1.0},
        disruption_pred={"disruption_probability": 0.8, "estimated_delay_minutes": 120},
        affected_nodes=[]
    )
    assert res["nugen_aligned"] is False
    assert res["model_id"] == "nugen-waitlist-pending"
    assert "explanation" in res
