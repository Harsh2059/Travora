from fastapi import FastAPI, Depends, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime

import crud, models, schemas, seed
from database import engine, get_db
from services.graph.builder import build_dependency_graph
from services.graph.queries import GraphQueries
from services.events.manager import EventManager
from services.impact.engine import ImpactEngine
from services.recovery.generator import RecoveryEngine
from services.recovery.models import RecoveryPlanModel
from services.execution.engine import ExecutionEngine, ExecutionError
from services.ml.disruption_model import DisruptionRiskModel
from services.ml.downstream_risk import DownstreamRiskModel
from services.ml.preferences import TravelerPreferences
from services.versioning.comparison import VersionComparisonEngine
from services.demo.reset_service import DemoResetService
from services.events.user_requests import UserRequestParser

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Travel Recovery Engine API")

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
    trip = DemoResetService.reset_demo_trip(db)
    return {
        "status": "success",
        "message": "Demo state safely reset to Trip v1 baseline.",
        "trip_id": trip.id,
        "version": trip.version,
        "items_count": len(trip.items)
    }

@app.get("/api/users", response_model=List[schemas.User])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    users = crud.get_users(db, skip=skip, limit=limit)
    return users

@app.get("/api/users/{user_id}/trips", response_model=List[schemas.Trip])
def read_user_trips(user_id: int, db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user.trips

# ============================================================================
# JOURNEY BUILDER — CREATE & MANAGE USER TRIPS
# ============================================================================

@app.post("/api/users/{user_id}/trips")
def create_trip(user_id: int, payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Create a new trip for a user (journey builder flow)."""
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    title = payload.get("title", "My Journey")
    trip = models.Trip(title=title, version=1, user_id=user_id)
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return {"id": trip.id, "title": trip.title, "version": trip.version, "user_id": trip.user_id, "items": []}

@app.post("/api/trips/{trip_id}/items")
def add_trip_item(trip_id: int, payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Add a single itinerary item to an existing trip."""
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

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
def update_trip_item(trip_id: int, item_id: int, payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Update an existing itinerary item."""
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
def delete_trip_item(trip_id: int, item_id: int, db: Session = Depends(get_db)):
    """Delete an itinerary item from a trip."""
    item = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.id == item_id,
        models.ItineraryItem.trip_id == trip_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"status": "deleted", "item_id": item_id}

@app.get("/api/trips/{trip_id}")
def get_trip_details(trip_id: int, db: Session = Depends(get_db)):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Only return ACTIVE (non-cancelled) items so the timeline stays clean after recovery execution
    active_items = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.trip_id == trip_id,
        models.ItineraryItem.status != "CANCELLED"
    ).order_by(models.ItineraryItem.start_time.asc()).all()

    return {
        "id": trip.id,
        "title": trip.title,
        "version": trip.version or 1,
        "user_id": trip.user_id,
        "items": [
            {
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
            for it in active_items
        ]
    }

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
        models.ItineraryItem.status != "CANCELLED"
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
    db: Session = Depends(get_db)
):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    event_type = event_payload.get("event_type") or event_payload.get("type") or "FLIGHT_CANCELLED"
    entity_id = event_payload.get("entity_id") or event_payload.get("affected_node_id")
    event_metadata = dict(event_payload.get("event_metadata", {}))

    if "detected_at" in event_payload:
        event_metadata["detected_at"] = event_payload["detected_at"]
    if "reason" in event_payload:
        event_metadata["reason"] = event_payload["reason"]
    if "delay_minutes" in event_payload:
        event_metadata["delay_minutes"] = event_payload["delay_minutes"]

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

    assessment_dict = {}
    try:
        active_items = db.query(models.ItineraryItem).filter(
            models.ItineraryItem.trip_id == trip_id,
            models.ItineraryItem.status != "CANCELLED"
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

    return {
        "id": disruption_record.id,
        "event_id": disruption_record.id,
        "trip_id": trip_id,
        "entity_id": entity_id,
        "affected_node_id": entity_id,
        "event_type": event_type,
        "type": event_type,
        "severity": disruption_record.severity,
        "timestamp": disruption_record.timestamp.isoformat() if disruption_record.timestamp else None,
        "event_metadata": event_metadata,
        "assessment": assessment_dict
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

    db.query(models.DisruptionEvent).filter(models.DisruptionEvent.trip_id == trip_id).delete()
    db.commit()

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

    db.delete(event)
    db.commit()
    return {"status": "success", "message": f"Disruption #{disruption_id} reset successfully", "trip_id": trip_id, "disruption_id": disruption_id}

@app.post("/api/disruptions/reset-all")
def reset_all_simulations(db: Session = Depends(get_db)):
    """Reset all simulation disruption events across all trips."""
    deleted_count = db.query(models.DisruptionEvent).delete()
    db.commit()
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
            models.DisruptionEvent.trip_id == trip_id
        ).all()
    elif single_disruption_id:
        ev = db.query(models.DisruptionEvent).filter(
            models.DisruptionEvent.id == single_disruption_id,
            models.DisruptionEvent.trip_id == trip_id
        ).first()
        disruption_events = [ev] if ev else []
    else:
        disruption_events = db.query(models.DisruptionEvent).filter(
            models.DisruptionEvent.trip_id == trip_id
        ).order_by(models.DisruptionEvent.timestamp.asc()).all()

    items = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.trip_id == trip_id,
        models.ItineraryItem.status != "CANCELLED"
    ).all()

    G = build_dependency_graph(items)

    if not disruption_events:
        empty_res = ImpactEngine.propagate_impact(G, {"trip_id": trip_id})
        return empty_res.model_dump()

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
    return result.model_dump()

@app.get("/api/trips/{trip_id}/impact")
def get_trip_impact(trip_id: int, db: Session = Depends(get_db)):
    """Fetch active impact result for a trip."""
    return analyze_trip_impact(trip_id=trip_id, payload={}, db=db)

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
        # Check if recent disruption exists in DB
        last_ev = db.query(models.DisruptionEvent).filter(
            models.DisruptionEvent.trip_id == trip_id
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
def execute_plan(
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
