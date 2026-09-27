import pytest
from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
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

def test_feedback_unauthenticated():
    res = client.post("/api/feedback", json={
        "event_type": "JOURNEY_CREATED",
        "rating": 5
    })
    assert res.status_code in [401, 403]

def test_feedback_flow(db_session):
    # Setup test users
    user_a = db_session.query(models.User).filter(models.User.email == "feedback_a@travora.travel").first()
    if not user_a:
        user_a = models.User(
            id="feedback-user-a-uuid",
            name="Alice Feedback Test",
            email="feedback_a@travora.travel",
            role="traveler"
        )
        db_session.add(user_a)
        db_session.commit()
        db_session.refresh(user_a)

    user_b = db_session.query(models.User).filter(models.User.email == "feedback_b@travora.travel").first()
    if not user_b:
        user_b = models.User(
            id="feedback-user-b-uuid",
            name="Bob Feedback Test",
            email="feedback_b@travora.travel",
            role="traveler"
        )
        db_session.add(user_b)
        db_session.commit()
        db_session.refresh(user_b)

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

    app.dependency_overrides[auth.get_current_user] = lambda: user_a

    try:
        # 1. Invalid event type
        res = client.post("/api/feedback", json={
            "event_type": "INVALID_EVENT",
            "rating": 5
        })
        assert res.status_code == 400

        # 2. Invalid rating
        res = client.post("/api/feedback", json={
            "event_type": "JOURNEY_CREATED",
            "rating": 10
        })
        assert res.status_code == 400

        # 3. Security: User A cannot attach feedback to User B's journey
        res = client.post("/api/feedback", json={
            "event_type": "JOURNEY_CREATED",
            "journey_id": trip_b.id,
            "rating": 4
        })
        assert res.status_code == 403

        # 4. Valid Journey Created Feedback
        res = client.post("/api/feedback", json={
            "event_type": "JOURNEY_CREATED",
            "rating": 5,
            "response_type": "RATING",
            "response_value": "EASY_TO_USE",
            "message": "Super intuitive setup!"
        })
        assert res.status_code == 201
        data = res.json()
        assert data["user_id"] == user_a.id
        assert data["rating"] == 5
        assert data["event_type"] == "JOURNEY_CREATED"

        # 5. Check feedback status
        res = client.get("/api/feedback/status?event_type=JOURNEY_CREATED")
        assert res.status_code == 200
        assert res.json()["has_feedback"] is True

        # 6. Valid Recovery Feedback
        res = client.post("/api/feedback", json={
            "event_type": "RECOVERY_RECOMMENDATION",
            "response_type": "YES_NO",
            "response_value": "HELPFUL",
            "context": {
                "recovery_plan_id": "plan_fastest",
                "transport_type": "FLIGHT"
            }
        })
        assert res.status_code == 201

    finally:
        app.dependency_overrides.pop(auth.get_current_user, None)
