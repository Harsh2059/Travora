import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app, get_db
from database import Base

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_travel_engine.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

def setup_module(module):
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db

def teardown_module(module):
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)

client = TestClient(app)



def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "message": "Travel Recovery Engine API is running"}

def test_seed_database():
    response = client.post("/api/seed")
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    user_id = response.json()["user_id"]
    
    # Check if trip was created
    trips_response = client.get(f"/api/users/{user_id}/trips")
    assert trips_response.status_code == 200
    trips = trips_response.json()
    assert len(trips) == 1
    assert trips[0]["title"] == "Mumbai to London Business Trip"
    
    # Check itinerary items
    assert len(trips[0]["items"]) == 6
    assert trips[0]["items"][0]["type"] == "FLIGHT"
