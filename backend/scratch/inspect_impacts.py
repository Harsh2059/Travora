import sys
import os
import json

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from main import app, get_db
import models
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_travel_engine.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
def override_get_db():
    db = TestingSessionLocal()
    try: yield db
    finally: db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

res_seed = client.post("/api/seed")
user_id = res_seed.json()["user_id"]
res_trips = client.get(f"/api/users/{user_id}/trips")
trips = res_trips.json()
trip_id = trips[0]["id"]
res_sim = client.post(f"/api/trips/{trip_id}/simulate", json={"scenario_type": "FLIGHT_DELAY_4H"})
assessment = res_sim.json()["assessment"]
print(json.dumps(assessment["node_impacts"], indent=2))
