import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app, get_db
from database import Base
import models
import auth
from services.whatsapp.client import MetaWhatsAppClient
from services.whatsapp.handler import WhatsAppWebhookHandler
from services.whatsapp.context import store_recovery_context
from services.whatsapp.service import WhatsAppService
from services.notifications.service import NotificationService
from services.notifications.contracts import NotificationChannel

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_auth.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_teardown_db():
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def client():
    return TestClient(app)


# ── 1. Phone Normalization Tests ─────────────────────────────────────────────
def test_phone_normalization_formats():
    """Ensure +917710989533 and 917710989533 produce the exact same representation."""
    p1 = auth.normalize_phone("+917710989533")
    p2 = auth.normalize_phone("917710989533")
    p3 = auth.normalize_phone("7710989533")
    p4 = auth.normalize_phone("+91 77109 89533")
    p5 = auth.normalize_phone("07710989533")

    assert p1 == "+917710989533"
    assert p2 == "+917710989533"
    assert p3 == "+917710989533"
    assert p4 == "+917710989533"
    assert p5 == "+917710989533"
    assert p1 == p2 == p3 == p4 == p5


# ── 2. Registration Tests ────────────────────────────────────────────────────
def test_user_registration(client):
    """Test successful user registration with password hashing and JWT issuance."""
    payload = {
        "name": "Jane Traveler",
        "email": "jane@example.com",
        "password": "securepassword123",
        "phone_number": "7710989533",
        "whatsapp_phone": "+917710989533"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "jane@example.com"
    assert data["user"]["name"] == "Jane Traveler"
    assert data["user"]["whatsapp_phone"] == "+917710989533"
    assert "password" not in data["user"]
    assert "hashed_password" not in data["user"]

    # Verify password was hashed in database
    db = TestingSessionLocal()
    user_in_db = db.query(models.User).filter(models.User.email == "jane@example.com").first()
    assert user_in_db is not None
    assert user_in_db.hashed_password != "securepassword123"
    assert auth.verify_password("securepassword123", user_in_db.hashed_password)
    db.close()


def test_user_registration_duplicate_email(client):
    """Test duplicate registration returns 400."""
    payload = {
        "name": "User One",
        "email": "dup@example.com",
        "password": "password123"
    }
    r1 = client.post("/api/auth/register", json=payload)
    assert r1.status_code == 200

    r2 = client.post("/api/auth/register", json=payload)
    assert r2.status_code == 400
    assert "already registered" in r2.json()["detail"]


# ── 3. Login Tests ───────────────────────────────────────────────────────────
def test_user_login_success(client):
    """Test login returns JWT token for valid credentials."""
    client.post("/api/auth/register", json={
        "name": "Login User",
        "email": "login@example.com",
        "password": "mysecretpassword"
    })

    login_res = client.post("/api/auth/login", json={
        "email": "login@example.com",
        "password": "mysecretpassword"
    })
    assert login_res.status_code == 200
    data = login_res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "login@example.com"


def test_user_login_invalid_credentials(client):
    """Test invalid credentials return 401."""
    client.post("/api/auth/register", json={
        "name": "Login User 2",
        "email": "login2@example.com",
        "password": "correctpassword"
    })

    bad_res = client.post("/api/auth/login", json={
        "email": "login2@example.com",
        "password": "wrongpassword"
    })
    assert bad_res.status_code == 401
    assert "Invalid email or password" in bad_res.json()["detail"]


# ── 4. /auth/me and Protected Routes ─────────────────────────────────────────
def test_protected_endpoint_without_token(client):
    """Protected endpoint without token returns 401."""
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_protected_endpoint_with_valid_token(client):
    """Protected endpoint with valid token returns user data."""
    reg = client.post("/api/auth/register", json={
        "name": "Auth Traveler",
        "email": "authtraveler@example.com",
        "password": "password123"
    }).json()

    token = reg["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/auth/me", headers=headers)
    assert res.status_code == 200
    assert res.json()["email"] == "authtraveler@example.com"
    assert res.json()["name"] == "Auth Traveler"


# ── 5. User Ownership on Trips ───────────────────────────────────────────────
def test_user_cannot_access_another_users_trip(client):
    """Ensure authenticated users cannot view or manipulate another user's trips."""
    # User 1 registers and creates a trip
    u1 = client.post("/api/auth/register", json={
        "name": "User One", "email": "u1@example.com", "password": "passuser1"
    }).json()
    token1 = u1["access_token"]
    headers1 = {"Authorization": f"Bearer {token1}"}

    trip_res = client.post(f"/api/users/{u1['user']['id']}/trips", json={"title": "U1 Secret Trip"}, headers=headers1)
    assert trip_res.status_code == 200
    trip_id = trip_res.json()["id"]

    # User 2 registers
    u2 = client.post("/api/auth/register", json={
        "name": "User Two", "email": "u2@example.com", "password": "passuser2"
    }).json()
    token2 = u2["access_token"]
    headers2 = {"Authorization": f"Bearer {token2}"}

    # User 2 attempts to read User 1's trips via user endpoint -> 403
    r_forbidden_user = client.get(f"/api/users/{u1['user']['id']}/trips", headers=headers2)
    assert r_forbidden_user.status_code == 403

    # User 2 attempts to read User 1's specific trip -> 403
    r_forbidden_trip = client.get(f"/api/trips/{trip_id}", headers=headers2)
    assert r_forbidden_trip.status_code == 403

    # User 2 attempts to trigger disruption on User 1's trip -> 403
    r_forbidden_disrupt = client.post(f"/api/trips/{trip_id}/disruptions", json={"event_type": "FLIGHT_CANCELLED"}, headers=headers2)
    assert r_forbidden_disrupt.status_code == 403

    # User 1 can access their own trip without issue
    r_allowed = client.get(f"/api/trips/{trip_id}", headers=headers1)
    assert r_allowed.status_code == 200


# ── 6. Profile Phone Persistence ────────────────────────────────────────────
def test_profile_phone_persistence(client):
    """Test updating profile via PUT /api/users/me normalizes and persists phone."""
    reg = client.post("/api/auth/register", json={
        "name": "Profile User", "email": "profile@example.com", "password": "passuser123"
    }).json()
    token = reg["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Update with raw 10-digit number
    update_res = client.put("/api/users/me", json={
        "phone_number": "7710989533",
        "whatsapp_phone": "917710989533"
    }, headers=headers)

    assert update_res.status_code == 200
    data = update_res.json()
    assert data["phone_number"] == "+917710989533"
    assert data["whatsapp_phone"] == "+917710989533"

    # Verify in DB
    db = TestingSessionLocal()
    user_db = db.query(models.User).filter(models.User.email == "profile@example.com").first()
    assert user_db.whatsapp_phone == "+917710989533"
    assert user_db.phone_number == "+917710989533"

    # A shared contact number must remain synchronized when the user edits
    # only their mobile number; future SMS and WhatsApp dispatches read these
    # current persisted fields without a new login/browser session.
    update_res = client.put("/api/users/me", json={
        "phone_number": "8812345678"
    }, headers=headers)
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["phone_number"] == "+918812345678"
    assert data["whatsapp_phone"] == "+918812345678"


def test_profile_phone_update_is_used_by_sms_and_whatsapp_without_relogin(client):
    """Both notification channels must resolve the just-persisted contact number."""
    reg = client.post("/api/auth/register", json={
        "name": "Notification User", "email": "notification-profile@example.com",
        "password": "passuser123", "phone_number": "7710989533",
    }).json()
    headers = {"Authorization": f"Bearer {reg['access_token']}"}
    update_res = client.put("/api/users/me", json={"phone_number": "8812345678"}, headers=headers)
    assert update_res.status_code == 200

    db = TestingSessionLocal()
    user = db.query(models.User).filter(models.User.email == "notification-profile@example.com").first()
    trip = models.Trip(title="Current Contact Trip", user_id=user.id)
    db.add(trip)
    db.commit()
    db.refresh(trip)

    class FakeWhatsAppClient:
        def __init__(self):
            self.recipients = []

        def send_text(self, recipient, text):
            self.recipients.append(recipient)
            return {"messages": [{"id": "wamid-current-contact"}]}

    client_stub = FakeWhatsAppClient()
    service = NotificationService(WhatsAppService(client_stub))
    disruption = {"id": 9876, "event_type": "FLIGHT_DELAYED", "event_metadata": {"delay_minutes": 30}}

    sms = service.send_disruption_notification(db, NotificationChannel.SMS, trip.id, disruption)
    whatsapp = service.send_disruption_notification(db, NotificationChannel.WHATSAPP, trip.id, disruption)

    assert sms.recipient == "+918812345678"
    assert whatsapp.recipient == "+918812345678"
    assert client_stub.recipients == ["+918812345678"]
    db.close()
    db.close()


# ── 7. WhatsApp Normalized Sender Resolution & Reply '1' ─────────────────────
def test_whatsapp_sender_resolves_normalized_phone(client, monkeypatch):
    """
    Test WhatsApp incoming webhook:
    Meta sends sender = '917710989533' (without +).
    Database has user with '+917710989533'.
    The handler should resolve the user, find the active trip and context,
    and reply '1' successfully executes the recovery plan.
    """
    db = TestingSessionLocal()
    # Create user with normalized phone
    user = models.User(
        name="Harsh Traveler",
        email="harsh@travora.com",
        whatsapp_phone="+917710989533",
        phone_number="+917710989533"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create trip for user
    trip = models.Trip(title="Mumbai to Delhi", user_id=user.id, version=1)
    db.add(trip)
    db.commit()
    db.refresh(trip)

    # Store WhatsApp recovery context
    plan_dict = {
        "id": "flight_alt_1",
        "title": "IndiGo 6E-205",
        "type": "FLIGHT",
        "total_cost": 4500,
        "disruption_fingerprint": "disp_fp_101"
    }
    store_recovery_context(
        db=db,
        sender="917710989533",
        trip_id=trip.id,
        disruption_id=1,
        disruption_fingerprint="disp_fp_101",
        plans=[plan_dict],
    )

    # Mock client and execute_plan
    class FakeClient:
        def __init__(self):
            self.sent = []
        def send_text(self, recipient, text):
            self.sent.append({"to": recipient, "message": text})
            return {"messaging_product": "whatsapp", "messages": [{"id": "wamid.test"}]}

    fake_client = FakeClient()
    executed_plans = []
    def fake_execute(**kwargs):
        executed_plans.append(kwargs)
        return {
            "execution_id": "exec_123",
            "status": "COMPLETED",
            "message": "Recovery executed successfully."
        }
    monkeypatch.setattr("services.whatsapp.handler.execute_plan", fake_execute)

    # Initialize handler
    handler = WhatsAppWebhookHandler(client=fake_client)

    # Sender delivers without '+'
    meta_sender = "917710989533"
    res = handler.handle(db=db, sender=meta_sender, text="1")

    assert res["status"] in ("SENT", "PROCESSED")
    assert res["action"] == "SELECT_OPTION"
    assert len(executed_plans) == 1
    assert executed_plans[0]["trip_id"] == trip.id
    assert executed_plans[0]["plan"]["id"] == "flight_alt_1"
    assert len(fake_client.sent) == 1
    assert "RECOVERY CONFIRMED" in fake_client.sent[0]["message"].upper()
    db.close()
