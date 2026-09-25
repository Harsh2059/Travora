from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, Body, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime

import crud, models, schemas, seed
import hashlib
import hmac
from database import engine, get_db, SessionLocal
from services.graph.builder import build_dependency_graph
from services.graph.queries import GraphQueries
from services.events.manager import EventManager
from services.impact.engine import ImpactEngine
from services.recovery.generator import RecoveryEngine
from services.recovery.models import RecoveryPlanModel
from services.recovery.engine import analyze_part4_recovery
from services.recovery.execution_engine import revalidate_plan, execute_plan, get_execution_by_id, restore_original_journey, activate_recovered_journey
from services.execution.engine import ExecutionEngine, ExecutionError
from services.ml.disruption_model import DisruptionRiskModel
from services.ml.downstream_risk import DownstreamRiskModel
from services.ml.preferences import TravelerPreferences
from services.versioning.comparison import VersionComparisonEngine
from services.demo.reset_service import DemoResetService
from services.events.user_requests import UserRequestParser
from services.notifications.contracts import NotificationChannel
from services.notifications.service import NotificationService
from services.whatsapp.client import MetaWhatsAppClient
from services.whatsapp.config import WhatsAppSettings
from services.whatsapp.handler import WhatsAppWebhookHandler
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("travel_recovery")

models.Base.metadata.create_all(bind=engine)

# Migration helper for SQLite DB: ensure columns exist
with engine.connect() as conn:
    try:
        from sqlalchemy import text
        conn.execute(text("ALTER TABLE disruption_events ADD COLUMN status VARCHAR DEFAULT 'ACTIVE'"))
        conn.commit()
    except Exception:
        pass
    try:
        from sqlalchemy import text
        conn.execute(text("ALTER TABLE recovery_executions ADD COLUMN demo_restored BOOLEAN DEFAULT 0"))
        conn.execute(text("ALTER TABLE recovery_executions ADD COLUMN restored_at DATETIME"))
        conn.commit()
    except Exception:
        pass
    try:
        from sqlalchemy import text
        conn.execute(text("ALTER TABLE trips ADD COLUMN view_mode VARCHAR DEFAULT 'ORIGINAL'"))
        conn.commit()
    except Exception:
        pass
    try:
        from sqlalchemy import text
        conn.execute(text("ALTER TABLE users ADD COLUMN whatsapp_phone VARCHAR"))
        conn.commit()
    except Exception:
        pass
    try:
        from sqlalchemy import text
        conn.execute(text("ALTER TABLE users ADD COLUMN hashed_password VARCHAR"))
        conn.commit()
    except Exception:
        pass
    try:
        from sqlalchemy import text
        conn.execute(text("ALTER TABLE users ADD COLUMN phone_number VARCHAR"))
        conn.commit()
    except Exception:
        pass
    try:
        from sqlalchemy import text
        conn.execute(text("ALTER TABLE users ADD COLUMN created_at TIMESTAMP"))
        conn.commit()
    except Exception:
        pass

import auth
app = FastAPI(title="Travel Recovery Engine API")

@app.on_event("startup")
def startup_event():
    try:
        db = SessionLocal()
        seed.seed_demo_data(db)
        db.close()
        logger.info("Demo data seed check complete on startup.")
    except Exception as e:
        logger.error(f"Startup seed error: {e}")

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ml_disruption_model = DisruptionRiskModel()

@app.get("/")
def root():
    return {"message": "Backend is running. Please access the frontend at http://localhost:5173"}

@app.get("/api/health")
def health_check(details: bool = False, db: Session = Depends(get_db)):
    res = {"status": "ok", "message": "Travel Recovery Engine API is running"}
    if details:
        db_healthy = True
        try:
            db.query(models.Trip).first()
        except Exception:
            db_healthy = False
        res["subsystems"] = {
            "database": "connected" if db_healthy else "error",
            "graph_engine": "available",
            "ml_disruption_model": "active",
            "ml_downstream_model": "active",
            "booking_service": "ready",
            "version_comparison": "ready"
        }
    return res

@app.post("/api/seed")
def seed_database(db: Session = Depends(get_db)):
    user = seed.seed_demo_data(db)
    return {"status": "success", "message": "Demo data seeded successfully", "user_id": user.id}

@app.post("/api/demo/reset")
def reset_demo(db: Session = Depends(get_db)):
    """
    Recreate the optional SAMPLE trip only. Does not delete other user journeys.
    Use Trip Builder + Admin Console to choose which journey to work on.
    """
    trip = DemoResetService.reset_demo_trip(db)
    return {
        "status": "success",
        "message": "Optional sample trip reset. Your other journeys were left unchanged.",
        "trip_id": trip.id,
        "version": trip.version,
        "items_count": len(trip.items),
        "title": trip.title,
    }


@app.post("/api/trips/{trip_id}/simulations/clear")
def clear_trip_simulations(trip_id: int, db: Session = Depends(get_db)):
    """
    Clear disruptions and recovery execution state for a specific trip
    without replacing the itinerary — keeps the user's chosen journey intact.
    """
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    try:
        trip = DemoResetService.clear_trip_simulations(db, trip_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {
        "status": "success",
        "message": "Simulations cleared for this trip. Itinerary bookings preserved.",
        "trip_id": trip.id,
        "title": trip.title,
    }

# ============================================================================
# MULTI-USER AUTHENTICATION & PROFILE ENDPOINTS
# ============================================================================

@app.post("/api/auth/register", response_model=schemas.TokenResponse)
def register(payload: schemas.UserRegister, db: Session = Depends(get_db)):
    """Register a new user with password hashing and return JWT token."""
    email = payload.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    if not payload.password or len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    existing = crud.get_user_by_email(db, email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    norm_phone = auth.normalize_phone(payload.phone_number)
    norm_wa = auth.normalize_phone(payload.whatsapp_phone) or norm_phone

    if norm_wa:
        existing_wa = db.query(models.User).filter(models.User.whatsapp_phone == norm_wa).first()
        if existing_wa:
            raise HTTPException(status_code=400, detail="WhatsApp number already registered")

    user = models.User(
        name=payload.name.strip(),
        email=email,
        hashed_password=auth.hash_password(payload.password),
        phone_number=norm_phone,
        whatsapp_phone=norm_wa,
        created_at=datetime.utcnow()
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = auth.create_access_token({"sub": str(user.id), "email": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@app.post("/api/auth/login", response_model=schemas.TokenResponse)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    """Authenticate user with email and password, return JWT token."""
    email = payload.email.strip().lower()
    user = crud.get_user_by_email(db, email)
    if not user or not auth.verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = auth.create_access_token({"sub": str(user.id), "email": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@app.get("/api/auth/me", response_model=schemas.UserResponse)
def get_auth_me(current_user: models.User = Depends(auth.get_current_user)):
    """Get current authenticated user info. Protected route."""
    return current_user

@app.put("/api/users/me", response_model=schemas.UserResponse)
def update_profile(
    payload: schemas.UserProfileUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Update profile and persist phone number / WhatsApp number in normalized form."""
    if payload.name is not None and payload.name.strip():
        current_user.name = payload.name.strip()

    if payload.email is not None and payload.email.strip():
        new_email = payload.email.strip().lower()
        if new_email != current_user.email:
            existing = crud.get_user_by_email(db, new_email)
            if existing and existing.id != current_user.id:
                raise HTTPException(status_code=400, detail="Email already in use")
            current_user.email = new_email

    if payload.phone_number is not None:
        current_user.phone_number = auth.normalize_phone(payload.phone_number)

    if payload.whatsapp_phone is not None:
        norm_wa = auth.normalize_phone(payload.whatsapp_phone)
        if norm_wa and norm_wa != current_user.whatsapp_phone:
            existing_wa = db.query(models.User).filter(models.User.whatsapp_phone == norm_wa).first()
            if existing_wa and existing_wa.id != current_user.id:
                raise HTTPException(status_code=400, detail="WhatsApp number already in use")
        current_user.whatsapp_phone = norm_wa

    db.commit()
    db.refresh(current_user)
    return current_user

@app.get("/api/users", response_model=List[schemas.User])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    users = crud.get_users(db, skip=skip, limit=limit)
    return users

@app.get("/api/users/{user_id}/trips", response_model=List[schemas.Trip])
def read_user_trips(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_optional_user)
):
    if isinstance(current_user, models.User) and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="You do not have access to another user's trips")
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user.trips

# ============================================================================
# JOURNEY BUILDER — CREATE & MANAGE USER TRIPS
# ============================================================================

@app.post("/api/users/{user_id}/trips")
def create_trip(
    user_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_optional_user)
):
    """Create a new trip for a user (journey builder flow)."""
    effective_user_id = current_user.id if isinstance(current_user, models.User) else user_id
    if isinstance(current_user, models.User) and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Cannot create trip for another user")
    db_user = crud.get_user(db, user_id=effective_user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    title = payload.get("title", "My Journey")
    trip = models.Trip(title=title, version=1, user_id=effective_user_id)
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return {"id": trip.id, "title": trip.title, "version": trip.version, "user_id": trip.user_id, "items": []}

@app.post("/api/trips/{trip_id}/items")
def add_trip_item(
    trip_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_optional_user)
):
    """Add a single itinerary item to an existing trip."""
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if isinstance(current_user, models.User) and trip.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this trip")

    def parse_dt(val: Optional[str]) -> Optional[datetime]:
        if not val:
            return None
        try:
            return datetime.fromisoformat(val.replace("Z", "+00:00"))
        except Exception:
            return None

    start_time = parse_dt(payload.get("start_time"))
    end_time = parse_dt(payload.get("end_time"))

    item = models.ItineraryItem(
        trip_id=trip_id,
        type=payload.get("type", "FLIGHT"),
        provider=payload.get("provider", ""),
        origin=payload.get("origin"),
        destination=payload.get("destination"),
        location=payload.get("location"),
        start_time=start_time,
        end_time=end_time,
        cost=float(payload.get("cost", 0.0)),
        currency=payload.get("currency", "INR"),
        priority=payload.get("priority", "MEDIUM"),
        flexibility=payload.get("flexibility", "FLEXIBLE"),
        status=payload.get("status", "CONFIRMED"),
        booking_id=payload.get("booking_id"),
        refundable=bool(payload.get("refundable", False)),
        refund_percentage=float(payload.get("refund_percentage", 0.0)),
        cancellation_fee=float(payload.get("cancellation_fee", 0.0)),
        changeable=bool(payload.get("changeable", False)),
        change_fee=float(payload.get("change_fee", 0.0)),
        non_refundable_amount=float(payload.get("non_refundable_amount", 0.0)),
        item_metadata=payload.get("item_metadata", {}),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {
        "id": item.id, "trip_id": item.trip_id, "type": item.type, "provider": item.provider,
        "origin": item.origin, "destination": item.destination, "location": item.location,
        "start_time": item.start_time.isoformat() if item.start_time else None,
        "end_time": item.end_time.isoformat() if item.end_time else None,
        "cost": item.cost, "currency": item.currency, "priority": item.priority,
        "flexibility": item.flexibility, "status": item.status, "booking_id": item.booking_id,
        "item_metadata": item.item_metadata or {}
    }

@app.put("/api/trips/{trip_id}/items/{item_id}")
def update_trip_item(
    trip_id: int,
    item_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_optional_user)
):
    """Update an existing itinerary item."""
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if isinstance(current_user, models.User) and trip.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this trip")

    item = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.id == item_id,
        models.ItineraryItem.trip_id == trip_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    def parse_dt(val: Optional[str]) -> Optional[datetime]:
        if not val:
            return None
        try:
            return datetime.fromisoformat(val.replace("Z", "+00:00"))
        except Exception:
            return None

    updatable = ["type", "provider", "origin", "destination", "location",
                 "cost", "currency", "priority", "flexibility", "status", "booking_id"]
    for field in updatable:
        if field in payload:
            setattr(item, field, payload[field])
    if "start_time" in payload:
        dt = parse_dt(payload["start_time"])
        if dt:
            item.start_time = dt
    if "end_time" in payload:
        dt = parse_dt(payload["end_time"])
        if dt:
            item.end_time = dt
    if "item_metadata" in payload:
        item.item_metadata = payload["item_metadata"]

    db.commit()
    db.refresh(item)
    return {
        "id": item.id, "trip_id": item.trip_id, "type": item.type, "provider": item.provider,
        "origin": item.origin, "destination": item.destination, "location": item.location,
        "start_time": item.start_time.isoformat() if item.start_time else None,
        "end_time": item.end_time.isoformat() if item.end_time else None,
        "cost": item.cost, "currency": item.currency, "priority": item.priority,
        "flexibility": item.flexibility, "status": item.status, "booking_id": item.booking_id,
        "item_metadata": item.item_metadata or {}
    }

@app.delete("/api/trips/{trip_id}/items/{item_id}")
def delete_trip_item(
    trip_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_optional_user)
):
    """Delete an itinerary item from a trip."""
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if isinstance(current_user, models.User) and trip.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this trip")

    item = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.id == item_id,
        models.ItineraryItem.trip_id == trip_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.query(models.ItineraryDependency).filter((models.ItineraryDependency.source_id == item_id) | (models.ItineraryDependency.target_id == item_id)).delete(synchronize_session=False)
    db.delete(item)
    db.commit()
    return {"status": "deleted", "item_id": item_id}

@app.get("/api/trips/{trip_id}")
def get_trip_details(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_optional_user)
):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if isinstance(current_user, models.User) and trip.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this trip")

    active_items = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.trip_id == trip_id,
        models.ItineraryItem.status.notin_(["CANCELLED", "REPLACED", "RESTORED_DEMO"])
    ).order_by(models.ItineraryItem.start_time.asc()).all()

    all_trip_items = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.trip_id == trip_id
    ).order_by(models.ItineraryItem.start_time.asc()).all()

    def serialize_item(it):
        return {
            "id": it.id,
            "trip_id": it.trip_id,
            "type": it.type,
            "provider": it.provider,
            "origin": it.origin,
            "destination": it.destination,
            "location": it.location,
            "start_time": it.start_time.isoformat() if it.start_time else None,
            "end_time": it.end_time.isoformat() if it.end_time else None,
            "cost": it.cost,
            "currency": it.currency,
            "priority": it.priority,
            "flexibility": it.flexibility,
            "status": it.status,
            "booking_id": it.booking_id,
            "refundable": it.refundable,
            "refund_percentage": it.refund_percentage,
            "cancellation_fee": it.cancellation_fee,
            "changeable": it.changeable,
            "change_fee": it.change_fee,
            "cancellation_deadline": it.cancellation_deadline.isoformat() if it.cancellation_deadline else None,
            "change_deadline": it.change_deadline.isoformat() if it.change_deadline else None,
            "non_refundable_amount": it.non_refundable_amount,
            "item_metadata": it.item_metadata or {}
        }

    # Original items: non-replacement items (or items prior to replacement)
    original_items = [
        it for it in all_trip_items
        if not ((it.item_metadata or {}).get("is_replacement") or (it.item_metadata or {}).get("recovery_execution_id"))
    ]

    # Active disruptions
    active_disruptions = db.query(models.DisruptionEvent).filter(
        models.DisruptionEvent.trip_id == trip_id,
        models.DisruptionEvent.status == "ACTIVE"
    ).all()

    # Recovery history
    exec_history = db.query(models.RecoveryExecution).filter(
        models.RecoveryExecution.trip_id == trip_id,
        models.RecoveryExecution.status.in_(["COMPLETED", "PARTIALLY_COMPLETED"])
    ).order_by(models.RecoveryExecution.created_at.asc()).all()

    has_recovered = len(exec_history) > 0
    demo_restored = any(e.demo_restored for e in exec_history)

    # Use persistent view_mode from Trip record; fall back to computed value if column missing.
    stored_view_mode = getattr(trip, "view_mode", None)
    if demo_restored:
        view_mode = "ORIGINAL"
    elif stored_view_mode in ("ORIGINAL", "RECOVERED"):
        # Respect user's explicit toggle, but RECOVERED is only valid when recovery exists
        view_mode = stored_view_mode if (stored_view_mode == "ORIGINAL" or has_recovered) else "ORIGINAL"
    else:
        view_mode = "RECOVERED" if has_recovered else "ORIGINAL"

    original_journey_payload = {"items": [serialize_item(it) for it in original_items]}
    recovered_journey_payload = {"items": [serialize_item(it) for it in active_items]} if has_recovered else None
    active_journey_payload = original_journey_payload if view_mode == "ORIGINAL" else (recovered_journey_payload or original_journey_payload)


    disruption_list = [
        {
            "id": de.id,
            "event_type": de.event_type,
            "entity_id": de.entity_id,
            "item_id": de.entity_id,
            "status": de.status,
            "timestamp": de.timestamp.isoformat() if de.timestamp else None,
            "event_metadata": de.event_metadata or {}
        }
        for de in active_disruptions
    ]

    # Build enriched recovery_history with original_item_id and replacement_item_id
    # Pre-load all replacement items for this trip (Python-level filtering, avoids SQLite JSON issues)
    all_replacement_items = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.trip_id == trip_id
    ).all()
    # Build a map: execution_id → list of replacement ItineraryItem objects
    exec_id_to_replacement_items: Dict[str, list] = {}
    for ri in all_replacement_items:
        meta = ri.item_metadata or {}
        if isinstance(meta, dict) and meta.get("is_replacement"):
            eid = meta.get("recovery_execution_id")
            if eid:
                exec_id_to_replacement_items.setdefault(eid, []).append(ri)
    # Also build map: exec_id+journey_item_id → replacement item id
    # journey_item_id == replaced_item_id in metadata
    def find_replacement_for_original(exec_id: str, original_item_id: int) -> Optional[int]:
        repl_list = exec_id_to_replacement_items.get(exec_id, [])
        for ri in repl_list:
            meta = ri.item_metadata or {}
            if meta.get("replaced_item_id") == original_item_id:
                return ri.id
        # Fallback: first replacement item for this execution
        if repl_list:
            return repl_list[0].id
        return None

    enriched_history = []
    for er in exec_history:
        # Look up RecoveryExecutionItem rows for this execution
        exec_items = db.query(models.RecoveryExecutionItem).filter(
            models.RecoveryExecutionItem.execution_id == er.execution_id,
            models.RecoveryExecutionItem.status == "BOOKED"
        ).all()
        for ei in exec_items:
            original_id = ei.journey_item_id
            replacement_id = find_replacement_for_original(er.execution_id, original_id) if original_id else None
            enriched_history.append({
                "execution_id": er.execution_id,
                "plan_id": er.recovery_plan_id,
                "status": er.status,
                "executed_at": er.created_at.isoformat() if er.created_at else None,
                "demo_restored": er.demo_restored,
                "original_item_id": original_id,
                "replacement_item_id": replacement_id,
            })
        # If no execution items found, still include basic history entry
        if not exec_items:
            enriched_history.append({
                "execution_id": er.execution_id,
                "plan_id": er.recovery_plan_id,
                "status": er.status,
                "executed_at": er.created_at.isoformat() if er.created_at else None,
                "demo_restored": er.demo_restored,
                "original_item_id": None,
                "replacement_item_id": None,
            })


    return {
        "id": trip.id,
        "title": trip.title,
        "version": trip.version or 1,
        "user_id": trip.user_id,
        "items": [serialize_item(it) for it in active_items],
        "original_items": [serialize_item(it) for it in original_items],
        "all_items": [serialize_item(it) for it in all_trip_items],
        "originalJourney": original_journey_payload,
        "currentRecoveredJourney": recovered_journey_payload,
        "activeJourney": active_journey_payload,
        "view_mode": view_mode,
        "viewMode": view_mode,
        "active_disruptions": disruption_list,
        "activeDisruptions": disruption_list,
        "recovery_history": enriched_history
    }

@app.patch("/api/trips/{trip_id}/view_mode")
def toggle_view_mode(
    trip_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    """
    Toggle view_mode between ORIGINAL and RECOVERED.
    RECOVERED is only allowed when a completed recovery execution exists for the trip.
    This endpoint does NOT mutate any itinerary items — it is purely a view preference toggle.
    """
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    requested_mode = str(payload.get("view_mode", "ORIGINAL")).upper()
    if requested_mode not in ("ORIGINAL", "RECOVERED"):
        raise HTTPException(status_code=400, detail="view_mode must be 'ORIGINAL' or 'RECOVERED'")

    # Only allow RECOVERED mode when a completed recovery execution exists
    if requested_mode == "RECOVERED":
        has_recovery = db.query(models.RecoveryExecution).filter(
            models.RecoveryExecution.trip_id == trip_id,
            models.RecoveryExecution.status.in_(["COMPLETED", "PARTIALLY_COMPLETED"])
        ).count() > 0
        if not has_recovery:
            raise HTTPException(
                status_code=409,
                detail="Cannot switch to RECOVERED view: no completed recovery execution exists for this trip."
            )

    # Persist the view_mode preference to the Trip record
    if hasattr(trip, "view_mode"):
        trip.view_mode = requested_mode
        db.commit()

    return {"trip_id": trip_id, "view_mode": requested_mode}


# ============================================================================
# PHASE 2: ITINERARY DIGITAL TWIN & DEPENDENCY GRAPH
# ============================================================================
@app.get("/api/trips/{trip_id}/graph")
def get_trip_graph(trip_id: int, db: Session = Depends(get_db)):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    items = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.trip_id == trip_id,
        models.ItineraryItem.status.notin_(["CANCELLED", "REPLACED", "RESTORED_DEMO"])
    ).order_by(models.ItineraryItem.start_time.asc()).all()

    G = build_dependency_graph(items)
    queries = GraphQueries(G)
    validation = queries.validate_graph()
    graph_data = queries.to_dict()

    return {
        "trip_id": trip_id,
        "trip_title": trip.title,
        "trip_version": trip.version or 1,
        "validation": validation,
        "graph": graph_data
    }

# ============================================================================
# PHASE 2: EVENT MANAGEMENT & IMPACT PROPAGATION
# ============================================================================
@app.post("/api/trips/{trip_id}/disruptions")
def trigger_disruption(
    trip_id: int,
    event_payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_optional_user)
):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if isinstance(current_user, models.User) and trip.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this trip")

    event_type = event_payload.get("event_type") or event_payload.get("disruption_type") or event_payload.get("type") or "FLIGHT_CANCELLED"
    entity_id = event_payload.get("entity_id") or event_payload.get("item_id") or event_payload.get("affected_node_id")
    event_metadata = dict(event_payload.get("event_metadata", {}))

    if "detected_at" in event_payload:
        event_metadata["detected_at"] = event_payload["detected_at"]
    if "reason" in event_payload:
        event_metadata["reason"] = event_payload["reason"]
    if "delay_minutes" in event_payload:
        event_metadata["delay_minutes"] = event_payload["delay_minutes"]

    # ── E: Block duplicate ACTIVE disruptions (trip_id + entity_id + event_type) ──
    # DisruptionEvent rows are deleted on reset, so any existing row is active.
    # Two different disruption types on the same booking are allowed.
    # Two same-type disruptions on different bookings are allowed.
    existing_active = db.query(models.DisruptionEvent).filter(
        models.DisruptionEvent.trip_id == trip_id,
        models.DisruptionEvent.entity_id == entity_id,
        models.DisruptionEvent.event_type == event_type,
        models.DisruptionEvent.status == "ACTIVE",
    ).first()
    if existing_active:
        raise HTTPException(
            status_code=409,
            detail=(
                f"This disruption is already active for this booking. "
                f"Reset it first before re-triggering."
            )
        )

    dt_now = datetime.utcnow()
    if event_payload.get("detected_at"):
        try:
            raw_dt = str(event_payload["detected_at"]).replace("Z", "+00:00")
            dt_now = datetime.fromisoformat(raw_dt)
        except Exception as dt_err:
            print(f"Warning: Could not parse detected_at '{event_payload.get('detected_at')}': {dt_err}")

    disruption_record = models.DisruptionEvent(
        trip_id=trip_id,
        event_type=event_type,
        entity_id=entity_id,
        severity=event_payload.get("severity", "HIGH"),
        old_state=event_payload.get("old_state", {}),
        new_state=event_payload.get("new_state", {}),
        event_metadata=event_metadata,
        timestamp=dt_now
    )
    db.add(disruption_record)
    db.commit()
    db.refresh(disruption_record)
    logger.info("[DISRUPTION] created id=%s trip_id=%s", disruption_record.id, trip_id)
    print(f"[DISRUPTION] created id={disruption_record.id} trip_id={trip_id}", flush=True)

    # ── D: Invalidate any cached Part 4 recovery for this trip ──
    # Home polling will detect the new disruption_fingerprint and clear the selected plan.
    LATEST_PART4_RECOVERY.pop(trip_id, None)

    assessment_dict = {}
    active_items = []  # Initialize before try block to prevent NameError if DB query fails
    try:
        active_items = db.query(models.ItineraryItem).filter(
            models.ItineraryItem.trip_id == trip_id,
            models.ItineraryItem.status.notin_(["CANCELLED", "REPLACED", "RESTORED_DEMO"])
        ).order_by(models.ItineraryItem.start_time.asc()).all()

        G = build_dependency_graph(active_items)
        assessment = ImpactEngine.propagate_impact(G, {
            "trip_id": trip_id,
            "event_type": event_type,
            "entity_id": entity_id,
            "event_metadata": event_metadata
        })
        assessment_dict = assessment.model_dump()
    except Exception:
        assessment_dict = {"affected_items": [], "total_delay": 0}

    alert_item = next(
        (item for item in active_items if str(item.id) == str(entity_id)),
        None,
    )
    disruption_for_notification = {
        "id": disruption_record.id,
        "event_id": disruption_record.id,
        "trip_id": trip_id,
        "entity_id": entity_id,
        "event_type": event_type,
        "severity": disruption_record.severity,
        "event_metadata": event_metadata,
        "item": {
            "type": alert_item.type,
            "provider": alert_item.provider,
            "origin": alert_item.origin,
            "destination": alert_item.destination,
            "location": alert_item.location,
            "start_time": alert_item.start_time.isoformat() if alert_item and alert_item.start_time else None,
            "end_time": alert_item.end_time.isoformat() if alert_item and alert_item.end_time else None,
            "flight_number": ((alert_item.item_metadata or {}).get("flight_number") if alert_item and isinstance(alert_item.item_metadata, dict) else None),
        } if alert_item else {},
    }
    recovery_plans = []
    try:
        recovery_plans = _resolve_all_whatsapp_plans(trip_id=trip_id, db=db)
    except Exception as exc:
        logger.warning("Could not pre-resolve recovery plans for WhatsApp notification: %s", exc)

    logger.info("[NOTIFICATION] recovery plans count=%d", len(recovery_plans))
    print(f"[NOTIFICATION] recovery plans count={len(recovery_plans)}", flush=True)

    try:
        try:
            db.rollback()  # Safety: ensure clean session state after recovery resolution before WhatsApp dispatch
        except Exception:
            pass
        notification = NotificationService().send_disruption_notification(
            db=db,
            channel=NotificationChannel.WHATSAPP,
            trip_id=trip_id,
            disruption=disruption_for_notification,
            plans=recovery_plans,
        )
        notification_status = notification.status
    except Exception as exc:
        logger.warning(
            "Disruption persisted but WhatsApp alert failed: %s",
            type(exc).__name__,
        )
        notification_status = "FAILED"

    # Send SMS notification — fresh session state after WhatsApp path
    try:
        try:
            db.rollback()  # Safety: ensure clean session state before SMS commit
        except Exception:
            pass
        NotificationService().send_disruption_notification(
            db=db,
            channel=NotificationChannel.SMS,
            trip_id=trip_id,
            disruption=disruption_for_notification,
        )
    except Exception as exc:
        logger.warning(
            "Disruption SMS queueing failed: %s",
            type(exc).__name__,
        )

    return {
        "id": disruption_record.id,
        "event_id": disruption_record.id,
        "trip_id": trip_id,
        "entity_id": entity_id,
        "affected_node_id": entity_id,
        "event_type": event_type,
        "type": event_type,
        "severity": disruption_record.severity,
        "status": disruption_record.status,
        "timestamp": disruption_record.timestamp.isoformat() if disruption_record.timestamp else None,
        "event_metadata": event_metadata,
        "assessment": assessment_dict,
        "notification": {
            "channel": NotificationChannel.WHATSAPP.value,
            "status": notification_status,
        },
    }

@app.get("/api/trips/{trip_id}/disruptions")
def get_trip_disruptions(trip_id: int, db: Session = Depends(get_db)):
    """Fetch active disruption history for a given trip."""
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    events = db.query(models.DisruptionEvent).filter(
        models.DisruptionEvent.trip_id == trip_id
    ).order_by(models.DisruptionEvent.timestamp.desc()).all()

    return [
        {
            "id": ev.id,
            "event_id": ev.id,
            "trip_id": ev.trip_id,
            "entity_id": ev.entity_id,
            "affected_node_id": ev.entity_id,
            "event_type": ev.event_type,
            "type": ev.event_type,
            "severity": ev.severity,
            "status": ev.status or "ACTIVE",
            "timestamp": ev.timestamp.isoformat() if ev.timestamp else None,
            "event_metadata": ev.event_metadata or {},
        }
        for ev in events
    ]

@app.post("/api/trips/{trip_id}/disruptions/reset")
def reset_trip_disruptions(trip_id: int, db: Session = Depends(get_db)):
    """Reset simulation state for a trip by clearing disruption events without deleting the trip or items."""
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    db.query(models.WhatsAppRecoveryContext).filter(models.WhatsAppRecoveryContext.trip_id == trip_id).delete(synchronize_session=False)
    db.query(models.NotificationRecord).filter(models.NotificationRecord.trip_id == trip_id, models.NotificationRecord.disruption_id.isnot(None)).delete(synchronize_session=False)
    db.query(models.SmsJob).filter(models.SmsJob.trip_id == trip_id, models.SmsJob.idempotency_key.like("DISR_%")).delete(synchronize_session=False)
    db.query(models.DisruptionEvent).filter(models.DisruptionEvent.trip_id == trip_id).delete(synchronize_session=False)
    db.commit()

    LATEST_PART4_RECOVERY.pop(trip_id, None)

    return {"status": "success", "message": "Simulation disruption state reset successfully", "trip_id": trip_id}

@app.delete("/api/trips/{trip_id}/disruptions/{disruption_id}")
@app.post("/api/trips/{trip_id}/disruptions/{disruption_id}/reset")
def reset_individual_disruption(trip_id: int, disruption_id: int, db: Session = Depends(get_db)):
    """Reset/remove an individual disruption event for a trip."""
    event = db.query(models.DisruptionEvent).filter(
        models.DisruptionEvent.id == disruption_id,
        models.DisruptionEvent.trip_id == trip_id
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="Disruption event not found")

    db.query(models.WhatsAppRecoveryContext).filter(models.WhatsAppRecoveryContext.disruption_id == disruption_id).delete(synchronize_session=False)
    db.query(models.NotificationRecord).filter(models.NotificationRecord.disruption_id == disruption_id).delete(synchronize_session=False)
    db.query(models.SmsJob).filter(models.SmsJob.idempotency_key == f"DISR_{disruption_id}").delete(synchronize_session=False)
    db.delete(event)
    db.commit()

    LATEST_PART4_RECOVERY.pop(trip_id, None)

    return {"status": "success", "message": f"Disruption #{disruption_id} reset successfully", "trip_id": trip_id, "disruption_id": disruption_id}

@app.post("/api/disruptions/reset-all")
def reset_all_simulations(db: Session = Depends(get_db)):
    """Reset all simulation disruption events across all trips."""
    db.query(models.WhatsAppRecoveryContext).delete(synchronize_session=False)
    db.query(models.NotificationRecord).filter(models.NotificationRecord.disruption_id.isnot(None)).delete(synchronize_session=False)
    db.query(models.SmsJob).filter(models.SmsJob.idempotency_key.like("DISR_%")).delete(synchronize_session=False)
    deleted_count = db.query(models.DisruptionEvent).delete(synchronize_session=False)
    db.commit()

    LATEST_PART4_RECOVERY.clear()

    return {"status": "success", "message": f"Reset {deleted_count} simulation disruptions across all trips", "deleted_count": deleted_count}


# ============================================================================
# PART 3: IMPACT & RIPPLE ENGINE ENDPOINTS
# ============================================================================
@app.post("/api/trips/{trip_id}/impact/analyze")
def analyze_trip_impact(
    trip_id: int,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db)
):
    """
    Analyzes downstream impact of a disruption event on a trip's dependency graph.
    Does NOT mutate itinerary items or attempt recovery.
    """
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    disruption_ids_param = payload.get("disruption_ids")
    single_disruption_id = payload.get("disruption_id")

    if disruption_ids_param and isinstance(disruption_ids_param, list):
        disruption_events = db.query(models.DisruptionEvent).filter(
            models.DisruptionEvent.id.in_(disruption_ids_param),
            models.DisruptionEvent.trip_id == trip_id,
            models.DisruptionEvent.status == "ACTIVE"
        ).all()
    elif single_disruption_id:
        ev = db.query(models.DisruptionEvent).filter(
            models.DisruptionEvent.id == single_disruption_id,
            models.DisruptionEvent.trip_id == trip_id,
            models.DisruptionEvent.status == "ACTIVE"
        ).first()
        disruption_events = [ev] if ev else []
    else:
        disruption_events = db.query(models.DisruptionEvent).filter(
            models.DisruptionEvent.trip_id == trip_id,
            models.DisruptionEvent.status == "ACTIVE"
        ).order_by(models.DisruptionEvent.timestamp.asc()).all()

    items = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.trip_id == trip_id,
        models.ItineraryItem.status.notin_(["CANCELLED", "REPLACED", "RESTORED_DEMO"])
    ).all()

    # Include disrupted entities even if currently REPLACED/RESTORED so impact
    # can attach (avoids "ON TRACK" while an active cancellation exists).
    disrupted_entity_ids = {
        int(de.entity_id)
        for de in disruption_events
        if de.entity_id is not None and str(de.entity_id).isdigit()
    }
    if disrupted_entity_ids:
        active_ids = {it.id for it in items}
        missing_ids = disrupted_entity_ids - active_ids
        if missing_ids:
            extra = db.query(models.ItineraryItem).filter(
                models.ItineraryItem.trip_id == trip_id,
                models.ItineraryItem.id.in_(list(missing_ids))
            ).all()
            items = list(items) + list(extra)

    G = build_dependency_graph(items)

    if not disruption_events:
        empty_res = ImpactEngine.propagate_impact(G, {"trip_id": trip_id})
        result_dict = empty_res.model_dump()
        # If trip has historical resolved disruptions, set journey_status to RECOVERED
        resolved_count = db.query(models.DisruptionEvent).filter(
            models.DisruptionEvent.trip_id == trip_id,
            models.DisruptionEvent.status == "RESOLVED"
        ).count()
        if resolved_count > 0:
            result_dict["journey_status"] = "RECOVERED"
        else:
            result_dict["journey_status"] = "NORMAL"
        # No active disruptions → fingerprint is empty string
        result_dict["disruption_fingerprint"] = ""
        result_dict["disruption_ids"] = []
        return result_dict

    event_dicts = [
        {
            "id": de.id,
            "disruption_id": de.id,
            "trip_id": trip_id,
            "entity_id": de.entity_id,
            "affected_node_id": de.entity_id,
            "event_type": de.event_type,
            "event_metadata": de.event_metadata or {}
        }
        for de in disruption_events
    ]

    result = ImpactEngine.propagate_impact(G, event_dicts)
    result_dict = result.model_dump()
    # ── Authoritative fingerprint: sorted active disruption IDs joined by "_" ──
    # Frontend uses this directly — no independent fingerprint computation needed.
    active_ids = sorted([de.id for de in disruption_events])
    result_dict["disruption_fingerprint"] = "_".join(str(i) for i in active_ids)
    result_dict["disruption_ids"] = active_ids
    return result_dict

@app.get("/api/trips/{trip_id}/impact")
def get_trip_impact(trip_id: int, db: Session = Depends(get_db)):
    """Fetch active impact result for a trip."""
    return analyze_trip_impact(trip_id=trip_id, payload={}, db=db)

# ============================================================================
# PART 4: RECOVERY ENGINE ENDPOINTS
# ============================================================================
def _get_known_unavailable_for_trip(db: Session, trip_id: int) -> List[Dict[str, Any]]:
    """Helper to assemble precise resource-level known_unavailable entries for a trip."""
    known = []

    # 1. DisruptionEvents
    disruptions = db.query(models.DisruptionEvent).filter(
        models.DisruptionEvent.trip_id == trip_id
    ).all()
    for de in disruptions:
        meta = de.event_metadata or {}
        booking_id = meta.get("booking_id") or meta.get("pnr")
        flight_num = meta.get("flight_number") or meta.get("train_number")
        res_id = meta.get("resource_id")
        provider_name = meta.get("provider") or meta.get("airline")

        if de.entity_id:
            item = db.query(models.ItineraryItem).filter(models.ItineraryItem.id == de.entity_id).first()
            if item:
                item_meta = item.item_metadata or {}
                if not booking_id:
                    booking_id = item.booking_id or item_meta.get("pnr") or item_meta.get("booking_reference")
                if not flight_num:
                    flight_num = item_meta.get("flight_number") or item_meta.get("train_number")
                if not res_id:
                    res_id = item_meta.get("resource_id")
                if not provider_name:
                    provider_name = item.provider

        entry = {
            "node_id": str(de.entity_id) if de.entity_id else None,
            "booking_id": booking_id,
            "flight_number": flight_num,
            "resource_id": res_id,
            "provider": provider_name,
            "reason": f"DISRUPTION_{de.status}"
        }
        if any(entry.values()):
            known.append(entry)

    # 2. Replaced or cancelled items
    replaced = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.trip_id == trip_id,
        models.ItineraryItem.status.in_(["REPLACED", "CANCELLED", "RESTORED_DEMO"])
    ).all()
    for it in replaced:
        item_meta = it.item_metadata or {}
        entry = {
            "node_id": str(it.id),
            "booking_id": it.booking_id or item_meta.get("pnr") or item_meta.get("booking_reference"),
            "flight_number": item_meta.get("flight_number") or item_meta.get("train_number"),
            "resource_id": item_meta.get("resource_id"),
            "provider": it.provider,
            "reason": it.status
        }
        if any(entry.values()):
            known.append(entry)

    # 3. RecoveryExecutions history
    execs = db.query(models.RecoveryExecution).filter(
        models.RecoveryExecution.trip_id == trip_id,
        models.RecoveryExecution.status.in_(["COMPLETED", "PARTIALLY_COMPLETED"])
    ).all()
    for er in execs:
        er_meta = er.execution_metadata or {}
        hist = er_meta.get("recovery_history") or []
        for h in hist:
            if isinstance(h, dict):
                known.append({
                    "booking_id": h.get("disrupted_booking_id"),
                    "node_id": str(h.get("disrupted_node_id")) if h.get("disrupted_node_id") else None,
                    "provider": h.get("disrupted_provider"),
                    "reason": "RECOVERY_HISTORY"
                })

    return known


LATEST_PART4_RECOVERY: Dict[int, Any] = {}

@app.post("/api/trips/{trip_id}/recovery/analyze")
def analyze_part4_recovery_endpoint(
    trip_id: int,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db)
):
    """
    Generates Part 4 Recovery Plans consuming the latest Part 3 ImpactResult.
    Does NOT mutate original itinerary or execute bookings.
    """
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Get active items
    items = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.trip_id == trip_id,
        models.ItineraryItem.status.notin_(["CANCELLED", "REPLACED", "RESTORED_DEMO"])
    ).order_by(models.ItineraryItem.start_time.asc()).all()

    # Mirror impact analysis: include disrupted entities even if REPLACED/RESTORED
    # so recovery can map BROKEN/NEEDS_CHANGE nodes and generate options.
    active_disruptions_preview = db.query(models.DisruptionEvent).filter(
        models.DisruptionEvent.trip_id == trip_id,
        models.DisruptionEvent.status == "ACTIVE"
    ).all()
    disrupted_entity_ids = {
        int(de.entity_id)
        for de in active_disruptions_preview
        if de.entity_id is not None and str(de.entity_id).isdigit()
    }
    if disrupted_entity_ids:
        active_ids = {it.id for it in items}
        missing_ids = disrupted_entity_ids - active_ids
        if missing_ids:
            extra = db.query(models.ItineraryItem).filter(
                models.ItineraryItem.trip_id == trip_id,
                models.ItineraryItem.id.in_(list(missing_ids))
            ).all()
            items = list(items) + list(extra)
            items.sort(key=lambda x: x.start_time or datetime.min)

    journey = {
        "id": trip.id,
        "title": trip.title,
        "nodes": [
            {
                "id": it.id,
                "backendId": it.id,
                "type": it.type,
                "title": f"{it.provider or it.type} ({it.origin or ''} → {it.destination or it.location or ''})".strip(),
                "provider": it.provider,
                "origin": it.origin,
                "destination": it.destination,
                "location": it.location,
                "start_time": it.start_time.isoformat() if it.start_time else None,
                "end_time": it.end_time.isoformat() if it.end_time else None,
                "cost": it.cost,
                "currency": it.currency,
                "priority": it.priority or "HIGH",
                "flexibility": it.flexibility,
                "status": it.status,
                "booking_id": it.booking_id,
                "flight_number": (it.item_metadata or {}).get("flight_number") if isinstance(it.item_metadata, dict) else None,
                "resource_id": (it.item_metadata or {}).get("resource_id") if isinstance(it.item_metadata, dict) else it.booking_id,
                "item_metadata": it.item_metadata or {},
            }
            for it in items
        ]
    }

    # Fetch Part 3 ImpactResult
    impact_res_dict = analyze_trip_impact(trip_id=trip_id, payload=payload, db=db)

    # Fetch active disruptions
    disruptions = db.query(models.DisruptionEvent).filter(
        models.DisruptionEvent.trip_id == trip_id,
        models.DisruptionEvent.status == "ACTIVE"
    ).all()
    disruption_dicts = [
        {
            "id": d.id,
            "disruption_id": d.id,
            "event_type": d.event_type,
            "entity_id": d.entity_id,
            "event_metadata": d.event_metadata or {}
        }
        for d in disruptions
    ]

    preference = payload.get("preference", "PRESERVE_PRIORITIES")
    max_budget = payload.get("max_budget")

    known_unavailable = _get_known_unavailable_for_trip(db, trip_id)

    recovery_res = analyze_part4_recovery(
        journey=journey,
        impact_result=impact_res_dict,
        disruptions=disruption_dicts,
        preference=preference,
        max_budget=max_budget,
        known_unavailable=known_unavailable
    )

    # ── B: Attach disruption versioning so frontend can detect stale selected plans ──
    # disruption_ids are the IDs of the active DisruptionEvent rows used as input.
    # disruption_fingerprint is the authoritative sorted key — frontend uses this,
    # not its own computed value from history.
    active_disruption_ids = sorted([d["id"] for d in disruption_dicts])
    fp = "_".join(str(i) for i in active_disruption_ids)
    recovery_res.disruption_ids = active_disruption_ids
    recovery_res.disruption_fingerprint = fp


    res_dump = recovery_res.model_dump()
    if fp and "plans" in res_dump:
        for p in res_dump["plans"]:
            p["disruption_fingerprint"] = fp
    LATEST_PART4_RECOVERY[trip_id] = res_dump
    return res_dump

@app.get("/api/trips/{trip_id}/recovery")
def get_part4_recovery(trip_id: int, db: Session = Depends(get_db)):
    """Fetch latest Part 4 Recovery Result for a trip."""
    if trip_id in LATEST_PART4_RECOVERY:
        return LATEST_PART4_RECOVERY[trip_id]
    return analyze_part4_recovery_endpoint(trip_id=trip_id, payload={}, db=db)


@app.post("/api/trips/{trip_id}/recovery/options")
def get_recovery_options_endpoint(
    trip_id: int,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db)
):
    """Endpoint alias for fetching recovery candidate options for a trip."""
    res = analyze_part4_recovery_endpoint(trip_id=trip_id, payload=payload, db=db)
    plans = res.get("plans", [])
    return {"options": plans, "plans": plans, **res}


def _resolve_all_whatsapp_plans(trip_id: int, db: Session = None) -> List[Dict[str, Any]]:
    cached = LATEST_PART4_RECOVERY.get(trip_id) or {}
    plans = cached.get("plans") or []
    fp = cached.get("disruption_fingerprint")
    if not plans and db is not None:
        try:
            res = analyze_part4_recovery_endpoint(trip_id=trip_id, payload={}, db=db)
            plans = res.get("plans") or []
            fp = res.get("disruption_fingerprint")
        except Exception:
            pass
    if plans and fp:
        for p in plans:
            if "disruption_fingerprint" not in p:
                p["disruption_fingerprint"] = fp
    return plans


def _resolve_whatsapp_plan(trip_id: int, db: Session = None) -> Optional[Dict[str, Any]]:
    plans = _resolve_all_whatsapp_plans(trip_id, db=db)
    if not plans:
        return None
    selected = next((p for p in plans if p.get("is_recommended")), plans[0])
    return selected


@app.post("/api/trips/{trip_id}/notifications/whatsapp")
def send_whatsapp_recovery_notification(
    trip_id: int,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
):
    """Send the current recovery plan(s) through the shared WhatsApp notification channel."""
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    plans = payload.get("plans") or _resolve_all_whatsapp_plans(trip_id, db=db)
    plan = payload.get("plan") or (plans[0] if plans else None)
    if not plan and not plans:
        raise HTTPException(status_code=404, detail="Recovery plan not found")
    active_disruptions = db.query(models.DisruptionEvent).filter(
        models.DisruptionEvent.trip_id == trip_id,
        models.DisruptionEvent.status == "ACTIVE"
    ).all()
    disruption_id = (
        payload.get("disruption_id")
        or ((plan or plans[0]).get("disruption_ids") or [None])[0]
        or (active_disruptions[-1].id if active_disruptions else None)
    )
    result = NotificationService().send_recovery_notification(
        db=db,
        channel=NotificationChannel.WHATSAPP,
        trip_id=trip_id,
        plan=plan or plans[0],
        disruption_id=disruption_id,
        plans=plans,
    )
    return {
        "success": result.success,
        "channel": result.channel.value,
        "status": result.status,
        "provider_message_id": result.provider_message_id,
        "error": result.error,
    }


@app.get("/webhooks/whatsapp")
def verify_whatsapp_webhook(
    hub_mode: Optional[str] = Query(default=None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(default=None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(default=None, alias="hub.challenge"),
):
    settings = WhatsAppSettings.from_env()
    if (
        hub_mode != "subscribe"
        or not hub_challenge
        or not settings.verify_token
        or hub_verify_token != settings.verify_token
    ):
        raise HTTPException(status_code=403, detail="Webhook verification failed")
    return int(hub_challenge)


@app.post("/webhooks/whatsapp")
async def receive_whatsapp_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Meta webhook messages without exposing provider credentials or business logic."""
    raw_body = await request.body()
    settings = WhatsAppSettings.from_env()
    signature = request.headers.get("X-Hub-Signature-256")
    if settings.app_secret:
        expected = "sha256=" + hmac.new(
            settings.app_secret.encode("utf-8"), raw_body, hashlib.sha256
        ).hexdigest()
        if not signature or not hmac.compare_digest(signature, expected):
            raise HTTPException(status_code=403, detail="Webhook signature validation failed")
    try:
        payload = __import__("json").loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="Malformed WhatsApp webhook payload")
    try:
        value = payload["entry"][0]["changes"][0]["value"]
        
        # Meta sends status updates too; we only want to process messages
        if "messages" not in value or not value["messages"]:
            return {"status": "ignored"}
            
        message = value["messages"][0]
        sender = message["from"]
        text = message["text"]["body"]
        phone_number_id = value["metadata"]["phone_number_id"]
    except (KeyError, IndexError, TypeError):
        raise HTTPException(status_code=400, detail="Malformed WhatsApp webhook payload")

    if phone_number_id != settings.phone_number_id:
        logger.warning(f"Received webhook for unknown phone_number_id: {phone_number_id}")
        return {"status": "ignored"}

    handler = WhatsAppWebhookHandler(
        client=MetaWhatsAppClient(settings=settings),
        plan_resolver=lambda tid: _resolve_whatsapp_plan(tid, db=db),
        plans_resolver=lambda tid: _resolve_all_whatsapp_plans(tid, db=db),
    )
    
    try:
        handler.handle(
            db=db,
            sender=sender,
            text=text,
            message_id=message.get("id"),
        )
    except Exception as exc:
        logger.exception("Error during WhatsApp webhook handling")
        
    return {"status": "ok"}

# ============================================================================
# PART 5: BOOKING & EXECUTION ENGINE ENDPOINTS
# ============================================================================
@app.post("/api/trips/{trip_id}/recovery/revalidate")
def revalidate_recovery_endpoint(
    trip_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    """
    Revalidates a proposed Part 4 Recovery Plan before execution.
    """
    plan = payload.get("selectedPlan") or payload.get("plan") or payload.get("option") or {}
    fp = payload.get("disruption_fingerprint") or payload.get("fingerprint") or ""
    try:
        val = revalidate_plan(db, trip_id, plan, fp)
        return val
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Revalidation error: {str(e)}")


@app.post("/api/trips/{trip_id}/recovery/execute")
def execute_recovery_endpoint(
    trip_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_optional_user)
):
    """
    Executes booking replacements through provider abstraction after explicit user confirmation.
    Enforces idempotency and stale plan protection. Updates itinerary DB upon success.
    """
    trip_rec = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip_rec:
        raise HTTPException(status_code=404, detail="Trip not found")
    if isinstance(current_user, models.User) and trip_rec.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this trip")

    selected_plan = payload.get("selectedPlan") or payload.get("plan") or payload.get("option") or {}
    disruption_fp = payload.get("disruption_fingerprint") or payload.get("fingerprint") or ""
    execution_id = payload.get("execution_id")

    if not selected_plan:
        raise HTTPException(status_code=400, detail="selectedPlan is required for execution")

    try:
        exec_res = execute_plan(
            db=db,
            trip_id=trip_id,
            plan=selected_plan,
            disruption_fingerprint=disruption_fp,
            execution_id=execution_id
        )
        # Persist view_mode=RECOVERED on the trip so subsequent GETs reflect the new state
        trip_rec = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
        if trip_rec and hasattr(trip_rec, "view_mode"):
            trip_rec.view_mode = "RECOVERED"
            db.commit()

        # Send WhatsApp Notification
        try:
            NotificationService().send_recovery_notification(
                db=db,
                channel=NotificationChannel.WHATSAPP,
                trip_id=trip_id,
                plan=selected_plan,
                disruption_id=(selected_plan.get("disruption_ids") or [None])[0],
            )
        except Exception as exc:
            logger.warning(
                "Recovery WhatsApp alert failed: %s",
                type(exc).__name__,
            )

        # Send SMS Notification - fresh session state after WhatsApp path
        try:
            try:
                db.rollback()  # Safety: ensure clean session state before SMS commit
            except Exception:
                pass
            NotificationService().send_recovery_notification(
                db=db,
                channel=NotificationChannel.SMS,
                trip_id=trip_id,
                plan=selected_plan,
                disruption_id=(selected_plan.get("disruption_ids") or [None])[0],
            )
        except Exception as exc:
            logger.warning(
                "Recovery SMS queueing failed: %s",
                type(exc).__name__,
            )


        # Fetch complete updated journey details to return complete state payload
        trip_details = get_trip_details(trip_id, db)
        exec_res["originalJourney"] = {
            "id": trip_id,
            "title": trip_details.get("title"),
            "items": trip_details.get("original_items"),
            "nodes": trip_details.get("original_items")
        }
        exec_res["currentRecoveredJourney"] = {
            "id": trip_id,
            "title": trip_details.get("title"),
            "items": trip_details.get("items"),
            "nodes": trip_details.get("items")
        }
        exec_res["activeJourney"] = {
            "id": trip_id,
            "title": trip_details.get("title"),
            "items": trip_details.get("items"),
            "nodes": trip_details.get("items")
        }
        exec_res["viewMode"] = "RECOVERED"
        exec_res["recoveryHistory"] = trip_details.get("recovery_history")
        exec_res["activeDisruptions"] = trip_details.get("active_disruptions")
        return exec_res
    except Exception as e:
        print(f"ERROR in execute_recovery_endpoint: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Booking execution error: {str(e)}")


@app.get("/api/trips/{trip_id}/recovery/execution")
def get_latest_execution_endpoint(
    trip_id: int,
    db: Session = Depends(get_db)
):
    """Fetches status and details of the latest Part 5 recovery execution for a trip."""
    res = get_execution_by_id(db=db, trip_id=trip_id)
    if not res or res.get("status") == "NOT_FOUND":
        return {"status": "NOT_FOUND", "message": "No execution record found"}
    return res


@app.get("/api/trips/{trip_id}/recovery/execution/{execution_id}")
def get_execution_status_endpoint(
    trip_id: int,
    execution_id: str,
    db: Session = Depends(get_db)
):
    """Fetches status and details of a Part 5 recovery execution by execution_id."""
    res = get_execution_by_id(db=db, execution_id=execution_id, trip_id=trip_id)
    if not res or res.get("status") == "NOT_FOUND":
        raise HTTPException(status_code=404, detail="Execution record not found")
    return res


@app.post("/api/trips/{trip_id}/recovery/restore")
def restore_original_journey_endpoint(
    trip_id: int,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db)
):
    """
    Demo/testing endpoint to restore simulated active journey state to pre-Part-5 snapshot.
    Preserves historical execution logs, PNRs, and ticket records.
    """
    execution_id = payload.get("execution_id")
    try:
        res = restore_original_journey(db=db, trip_id=trip_id, execution_id=execution_id)
        if res.get("status") in ["RESTORED", "ALREADY_RESTORED"]:
            # Evict cached Part 4 recovery option so stale recovery plans are invalidated
            LATEST_PART4_RECOVERY.pop(trip_id, None)
        return res
    except Exception as e:
        print(f"ERROR in restore_original_journey_endpoint: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Restore journey error: {str(e)}")


@app.post("/api/trips/{trip_id}/recovery/activate-recovered")
def activate_recovered_journey_endpoint(
    trip_id: int,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db)
):
    """
    Endpoint to activate the recovered journey state for a trip (flipping back from Original to Recovered view).
    """
    execution_id = payload.get("execution_id")
    try:
        res = activate_recovered_journey(db=db, trip_id=trip_id, execution_id=execution_id)
        return res
    except Exception as e:
        print(f"ERROR in activate_recovered_journey_endpoint: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Activate recovered journey error: {str(e)}")


# ============================================================================
# PHASE 2: DISRUPTION SIMULATOR PRESETS
# ============================================================================
@app.post("/api/trips/{trip_id}/simulate")
def simulate_scenario(
    trip_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    items = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.trip_id == trip_id,
        models.ItineraryItem.status != "CANCELLED"
    ).order_by(models.ItineraryItem.start_time.asc()).all()

    if not items:
        raise HTTPException(status_code=400, detail="No active items in trip to disrupt")

    scenario_type = payload.get("scenario_type", "FLIGHT_DELAY_4H")
    explicit_item_id = payload.get("item_id")

    # Select target item according to scenario or explicit ID
    target_item = items[0]
    if explicit_item_id is not None:
        matched = next((it for it in items if it.id == explicit_item_id), None)
        if matched:
            target_item = matched
    elif scenario_type in ["TRANSFER_FAILURE", "TRANSFER_DELAY"]:
        matched = next((it for it in items if it.type in ["TRANSFER", "CAB", "CAR"]), None)
        if matched:
            target_item = matched
    elif scenario_type in ["HOTEL_UNAVAILABLE", "CHECKIN_MISSED"]:
        matched = next((it for it in items if it.type in ["HOTEL", "ACCOMMODATION", "LODGING"]), None)
        if matched:
            target_item = matched
    elif scenario_type in ["ACTIVITY_CANCELLED", "ACTIVITY_MISSED"]:
        matched = next((it for it in items if it.type in ["EVENT", "ACTIVITY"]), None)
        if matched:
            target_item = matched
    elif scenario_type in ["TRAIN_CANCEL", "TRAIN_DELAY", "TRAIN_DELAY_3H"]:
        matched = next((it for it in items if it.type in ["TRAIN", "RAIL"]), None)
        if matched:
            target_item = matched

    item_dict = {
        "id": target_item.id,
        "type": target_item.type,
        "provider": target_item.provider,
        "start_time": target_item.start_time,
        "end_time": target_item.end_time,
        "status": target_item.status
    }

    if scenario_type == "FLIGHT_CANCEL":
        ev = EventManager.create_cancellation_event(
            trip_id=trip_id,
            item_id=target_item.id,
            current_item=item_dict,
            reason="Severe fog and technical aircraft grounding"
        )
    elif scenario_type == "TRAIN_CANCEL":
        ev = {
            "trip_id": trip_id,
            "event_type": "TRAIN_CANCEL",
            "entity_id": target_item.id,
            "severity": "CRITICAL",
            "old_state": {"status": target_item.status},
            "new_state": {"status": "CANCELLED"},
            "event_metadata": {"reason": "Overhead traction wire failure and track closure"}
        }
    elif scenario_type == "HOTEL_UNAVAILABLE":
        ev = {
            "trip_id": trip_id,
            "event_type": "HOTEL_UNAVAILABLE",
            "entity_id": target_item.id,
            "severity": "HIGH",
            "old_state": {"status": target_item.status},
            "new_state": {"status": "CANCELLED"},
            "event_metadata": {"reason": "Burst pipe emergency and room overbooking"}
        }
    elif scenario_type == "TRANSFER_FAILURE":
        ev = {
            "trip_id": trip_id,
            "event_type": "TRANSFER_FAILURE",
            "entity_id": target_item.id,
            "severity": "HIGH",
            "old_state": {"status": target_item.status},
            "new_state": {"status": "CANCELLED"},
            "event_metadata": {"reason": "Express rail power outage & highway gridlock"}
        }
    elif scenario_type == "ACTIVITY_CANCELLED":
        ev = {
            "trip_id": trip_id,
            "event_type": "ACTIVITY_CANCELLED",
            "entity_id": target_item.id,
            "severity": "MEDIUM",
            "old_state": {"status": target_item.status},
            "new_state": {"status": "CANCELLED"},
            "event_metadata": {"reason": "Venue maintenance closure"}
        }
    elif scenario_type == "USER_REQUEST_ADVANCE":
        ev = EventManager.create_user_requested_change_event(
            trip_id=trip_id,
            item_id=target_item.id,
            requested_changes={"advance_hours": 24, "reason": "Traveler requested 1 day earlier departure"},
            reason="Traveler requested early departure"
        )
    else: # Default 4h delay
        ev = EventManager.create_delay_event(
            trip_id=trip_id,
            item_id=target_item.id,
            delay_minutes=240,
            current_item=item_dict,
            reason="Air Traffic Control holding delay at Mumbai Airport (BOM)"
        )

    return trigger_disruption(trip_id=trip_id, event_payload=ev, db=db)

@app.post("/api/trips/{trip_id}/user-request")
def process_user_request(
    trip_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    request_text = payload.get("request", "")
    if not request_text:
        raise HTTPException(status_code=400, detail="Missing user request text in payload")

    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    parsed_intent = UserRequestParser.parse_request(request_text)

    # Active items in trip
    active_items = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.trip_id == trip_id,
        models.ItineraryItem.status != "CANCELLED"
    ).order_by(models.ItineraryItem.start_time.asc()).all()

    if not active_items:
        raise HTTPException(status_code=400, detail="No active items in trip to adjust")

    target_item = active_items[0]
    item_dict = {
        "id": target_item.id,
        "type": target_item.type,
        "provider": target_item.provider,
        "start_time": target_item.start_time,
        "end_time": target_item.end_time,
        "status": target_item.status
    }

    event_type = parsed_intent.get("event_type", "USER_REQUESTED_CHANGE")
    if event_type == "CANCELLATION":
        ev = EventManager.create_cancellation_event(
            trip_id=trip_id,
            item_id=target_item.id,
            current_item=item_dict,
            reason=parsed_intent.get("description", "User-requested cancellation")
        )
    else:
        ev = EventManager.create_user_requested_change_event(
            trip_id=trip_id,
            item_id=target_item.id,
            requested_changes=parsed_intent.get("event_metadata", {}),
            reason=parsed_intent.get("description", "User-requested schedule adjustment")
        )

    disruption_res = trigger_disruption(trip_id=trip_id, event_payload=ev, db=db)

    # Generate recovery plans using parsed intent preferences
    prefs_payload = payload.get("preferences", {})
    if "preferences_override" in parsed_intent:
        prefs_payload.update(parsed_intent["preferences_override"])

    recovery_res = plan_recovery(
        trip_id=trip_id,
        payload={
            "preferences": prefs_payload,
            "event": {
                "event_type": ev["event_type"],
                "entity_id": ev["entity_id"],
                "event_metadata": ev.get("event_metadata", {})
            }
        },
        db=db
    )

    return {
        "status": "success",
        "parsed_intent": parsed_intent,
        "assessment": disruption_res["assessment"],
        "event_id": disruption_res["event_id"],
        "plans": recovery_res["plans"]
    }


# ============================================================================
# PHASE 2: RECOVERY STRATEGY GENERATION, OPTIMIZATION & EXPLANATION
# ============================================================================
@app.post("/api/trips/{trip_id}/recover")
def plan_recovery(
    trip_id: int,
    payload: Dict[str, Any] = Body(default_factory=dict),
    db: Session = Depends(get_db)
):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    items = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.trip_id == trip_id,
        models.ItineraryItem.status != "CANCELLED"
    ).order_by(models.ItineraryItem.start_time.asc()).all()

    items_data = []
    for it in items:
        d = {c.name: getattr(it, c.name) for c in it.__table__.columns}
        d.pop("_sa_instance_state", None)
        items_data.append(d)

    # Preferences
    pref_data = payload.get("preferences", {})
    preferences = TravelerPreferences(
        time_weight=pref_data.get("time_weight", 0.5),
        cost_weight=pref_data.get("cost_weight", 0.2),
        comfort_weight=pref_data.get("comfort_weight", 0.2),
        directness_weight=pref_data.get("directness_weight", 0.1)
    )

    # Event context
    event_info = payload.get("event", {})
    if not event_info:
        # Check if recent active disruption exists in DB
        last_ev = db.query(models.DisruptionEvent).filter(
            models.DisruptionEvent.trip_id == trip_id,
            models.DisruptionEvent.status == "ACTIVE"
        ).order_by(models.DisruptionEvent.timestamp.desc()).first()
        if last_ev:
            event_info = {
                "event_type": last_ev.event_type,
                "entity_id": last_ev.entity_id,
                "event_metadata": last_ev.event_metadata or {}
            }
        else:
            # Default simulated 4-hour delay on first flight
            event_info = {
                "event_type": "DELAY",
                "entity_id": items_data[0]["id"] if items_data else 1,
                "event_metadata": {"delay_minutes": 240}
            }

    # Run End-to-End Recovery Engine
    ranked_plans = RecoveryEngine.generate_and_rank_recovery_plans(
        original_items=items_data,
        event=event_info,
        preferences=preferences,
        source_itinerary_version=trip.version or 1,
        trip_id=trip_id
    )

    return {
        "trip_id": trip_id,
        "trip_version": trip.version or 1,
        "event_analyzed": event_info,
        "preferences_used": preferences.model_dump(),
        "total_candidate_plans": len(ranked_plans),
        "feasible_count": len([p for p in ranked_plans if p.feasibility]),
        "plans": [p.model_dump() for p in ranked_plans]
    }

# ============================================================================
# PHASE 2: EXECUTION ENGINE (VERSIONING & CASCADING RECOVERY)
# ============================================================================
@app.post("/api/trips/{trip_id}/recover/execute")
def execute_legacy_phase2_plan(
    trip_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    plan_dict = payload.get("plan")
    if not plan_dict:
        raise HTTPException(status_code=400, detail="Missing recovery plan in payload")

    plan_model = RecoveryPlanModel(**plan_dict)

    try:
        result = ExecutionEngine.execute_recovery_plan(
            db=db,
            trip_id=trip_id,
            plan=plan_model,
            event_type=payload.get("event_type", "DISRUPTION")
        )
        return result
    except ExecutionError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ============================================================================
# PHASE 2: RECOVERY HISTORY & VERSIONING
# ============================================================================
@app.get("/api/trips/{trip_id}/history")
def get_trip_recovery_history(trip_id: int, db: Session = Depends(get_db)):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    histories = db.query(models.RecoveryHistory).filter(
        models.RecoveryHistory.trip_id == trip_id
    ).order_by(models.RecoveryHistory.timestamp.asc()).all()

    return {
        "trip_id": trip_id,
        "current_version": trip.version or 1,
        "history": [
            {
                "id": h.id,
                "recovery_id": h.recovery_id,
                "previous_version": h.previous_version,
                "new_version": h.new_version,
                "event_type": h.event_type,
                "selected_plan_id": h.selected_plan_id,
                "plan_title": h.plan_title,
                "net_cost": h.net_cost,
                "additional_delay_minutes": h.additional_delay_minutes,
                "changes": h.changes,
                "timestamp": h.timestamp.isoformat() if h.timestamp else None
            }
            for h in histories
        ]
    }

@app.get("/api/trips/{trip_id}/compare")
def compare_trip_versions(
    trip_id: int,
    v1: int = 1,
    v2: int = 2,
    db: Session = Depends(get_db)
):
    try:
        diff = VersionComparisonEngine.compare_versions(db, trip_id, v1, v2)
        return diff
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============================================================================
# PHASE 2: ML ADVISORY PREDICTIONS
# ============================================================================
@app.get("/api/trips/{trip_id}/ml-risk")
def get_ml_risk_predictions(trip_id: int, db: Session = Depends(get_db)):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    items = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.trip_id == trip_id,
        models.ItineraryItem.status != "CANCELLED"
    ).all()

    item_predictions = []
    for it in items:
        item_dict = {"id": it.id, "start_time": it.start_time, "destination": it.destination, "origin": it.origin}
        pred = ml_disruption_model.predict_item_risk(item_dict)
        pred["provider"] = it.provider
        pred["type"] = it.type
        item_predictions.append(pred)

    downstream = DownstreamRiskModel.predict_downstream_risks(
        item_delay_minutes=240,
        downstream_items=[],
        connection_buffers={"min_buffer_minutes": 120.0, "event_buffer_minutes": 720.0}
    )

    return {
        "trip_id": trip_id,
        "item_predictions": item_predictions,
        "downstream_cascade_predictions": downstream,
        "advisory_disclaimer": "ML predictions are advisory only and do not dictate hard constraint feasibility."
    }
# ============================================================================
# PART 1: SMS GATEWAY API
# ============================================================================

@app.get("/api/sms-gateway/jobs", response_model=List[schemas.SmsJobResponse])
def get_sms_jobs(
    status: str = "PENDING",
    limit: int = 50,
    claim: bool = False,
    device_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.SmsJob).filter(models.SmsJob.status == status).order_by(models.SmsJob.created_at.asc()).limit(limit)
    jobs = query.all()
    
    if claim and jobs:
        import uuid
        claim_token = f"{device_id or 'unknown'}_{uuid.uuid4().hex}"
        db.query(models.SmsJob).filter(
            models.SmsJob.id.in_([j.id for j in jobs]),
            models.SmsJob.status == status
        ).update({
            models.SmsJob.status: "SENDING",
            models.SmsJob.claimed_at: datetime.utcnow(),
            models.SmsJob.gateway_device_id: claim_token
        }, synchronize_session=False)
        db.commit()
        
        # Return only the jobs this request successfully claimed
        jobs = db.query(models.SmsJob).filter(models.SmsJob.gateway_device_id == claim_token).all()
        
    return jobs

@app.post("/api/sms-gateway/jobs/{job_id}/status", response_model=schemas.SmsJobResponse)
def update_sms_job_status(
    job_id: str,
    payload: schemas.SmsStatusUpdate,
    db: Session = Depends(get_db)
):
    job = db.query(models.SmsJob).filter(models.SmsJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="SMS job not found")
        
    allowed_transitions = {
        "PENDING": ["SENDING", "SENT", "FAILED"],
        "SENDING": ["SENT", "FAILED"],
        "SENT": [],
        "FAILED": []
    }
    
    if payload.status != job.status and payload.status not in allowed_transitions.get(job.status, []):
        raise HTTPException(status_code=400, detail=f"Invalid transition from {job.status} to {payload.status}")
        
    job.status = payload.status
    if payload.error_message is not None:
        job.error_message = payload.error_message
    if payload.gateway_device_id is not None:
        job.gateway_device_id = payload.gateway_device_id
        
    if payload.status == "SENT":
        job.sent_at = datetime.utcnow()
        
    db.commit()
    db.refresh(job)
    return job

@app.get("/api/sms-gateway/stats")
def get_sms_gateway_stats(db: Session = Depends(get_db)):
    pending = db.query(models.SmsJob).filter(models.SmsJob.status == "PENDING").count()
    sending = db.query(models.SmsJob).filter(models.SmsJob.status == "SENDING").count()
    sent = db.query(models.SmsJob).filter(models.SmsJob.status == "SENT").count()
    failed = db.query(models.SmsJob).filter(models.SmsJob.status == "FAILED").count()
    total = db.query(models.SmsJob).count()
    return {
        "pending": pending,
        "claimed": sending,
        "sending": sending,
        "sent": sent,
        "failed": failed,
        "total": total
    }

