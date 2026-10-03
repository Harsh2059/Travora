import pytest
from fastapi.testclient import TestClient
from main import app
from database import SessionLocal, get_db
import models
import routers.auth as auth

client = TestClient(app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_get_support_faqs():
    response = client.get("/api/support/faqs")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    categories = {item["category"] for item in data}
    assert "Journey" in categories
    assert "Disruptions" in categories
    assert "Recovery" in categories
    assert "Notifications" in categories
    assert "Account" in categories

def test_get_support_contact():
    response = client.get("/api/support/contact")
    assert response.status_code == 200
    data = response.json()
    assert "support_email" in data
    assert "operating_hours" in data

def test_create_ticket_unauthenticated():
    # Calling without auth token or mock user should fail
    response = client.post("/api/support/tickets", json={
        "category": "Flight / Transport Issue",
        "description": "Flight was delayed without notice"
    })
    assert response.status_code in [401, 403]

def test_authenticated_support_ticket_flow(db_session):
    # Setup test users
    user_a = db_session.query(models.User).filter(models.User.email == "test_user_a@travora.travel").first()
    if not user_a:
        user_a = models.User(
            id="test-user-a-uuid",
            name="Alice Support Test",
            email="test_user_a@travora.travel",
            role="traveler"
        )
        db_session.add(user_a)
        db_session.commit()
        db_session.refresh(user_a)

    user_b = db_session.query(models.User).filter(models.User.email == "test_user_b@travora.travel").first()
    if not user_b:
        user_b = models.User(
            id="test-user-b-uuid",
            name="Bob Support Test",
            email="test_user_b@travora.travel",
            role="traveler"
        )
        db_session.add(user_b)
        db_session.commit()
        db_session.refresh(user_b)

    # Setup trip for User B
    trip_b = db_session.query(models.Trip).filter(models.Trip.user_id == user_b.id).first()
    if not trip_b:
        trip_b = models.Trip(
            title="Bob's Private Journey",
            user_id=user_b.id,
            version=1
        )
        db_session.add(trip_b)
        db_session.commit()
        db_session.refresh(trip_b)

    # Override get_current_user to simulate User A
    app.dependency_overrides[auth.get_current_user] = lambda: user_a

    try:
        # 1. Validation test: empty category
        res = client.post("/api/support/tickets", json={
            "category": "",
            "description": "Valid description"
        })
        assert res.status_code == 400

        # 2. Validation test: empty / too short description
        res = client.post("/api/support/tickets", json={
            "category": "App / Technical Issue",
            "description": "abc"
        })
        assert res.status_code == 400

        # 3. Security test: User A cannot associate User B's journey
        res = client.post("/api/support/tickets", json={
            "category": "Flight / Transport Issue",
            "description": "Trying to attach someone else's trip",
            "journey_id": trip_b.id
        })
        assert res.status_code == 403
        assert "not authorized" in res.json()["detail"].lower()

        # 4. Valid submission
        res = client.post("/api/support/tickets", json={
            "category": "Flight / Transport Issue",
            "description": "My flight from Mumbai to Delhi is delayed by 3 hours and I need assistance.",
            "priority": "HIGH"
        })
        assert res.status_code == 201
        ticket_data = res.json()
        assert ticket_data["ticket_number"].startswith("TRV-")
        assert ticket_data["user_id"] == user_a.id
        assert ticket_data["status"] == "OPEN"
        assert ticket_data["priority"] == "HIGH"
        created_ticket_number = ticket_data["ticket_number"]

        # 5. Fetch my tickets
        res = client.get("/api/support/tickets/my")
        assert res.status_code == 200
        my_tickets = res.json()
        assert any(t["ticket_number"] == created_ticket_number for t in my_tickets)
        # Verify no Bob tickets are in Alice's list
        assert all(t["user_id"] == user_a.id for t in my_tickets)

        # 6. Fetch ticket by ID or ticket_number
        res = client.get(f"/api/support/tickets/{created_ticket_number}")
        assert res.status_code == 200
        assert res.json()["ticket_number"] == created_ticket_number

        # 7. Switch to User B and check that User B cannot access User A's ticket
        app.dependency_overrides[auth.get_current_user] = lambda: user_b
        res = client.get(f"/api/support/tickets/{created_ticket_number}")
        assert res.status_code == 403

    finally:
        app.dependency_overrides.pop(auth.get_current_user, None)
