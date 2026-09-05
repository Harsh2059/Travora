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

@app.get("/api/trips/{trip_id}", response_model=schemas.Trip)
def get_trip_details(trip_id: int, db: Session = Depends(get_db)):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip

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

    event_type = event_payload.get("event_type", "DELAY")
    entity_id = event_payload.get("entity_id")
    event_metadata = event_payload.get("event_metadata", {})

    # Save disruption event in DB
    disruption_record = models.DisruptionEvent(
        trip_id=trip_id,
        event_type=event_type,
        entity_id=entity_id,
        severity=event_payload.get("severity", "HIGH"),
        old_state=event_payload.get("old_state", {}),
        new_state=event_payload.get("new_state", {}),
        event_metadata=event_metadata,
        timestamp=datetime.utcnow()
    )
    db.add(disruption_record)
    db.commit()
    db.refresh(disruption_record)

    # Fetch active items and construct digital twin
    active_items = db.query(models.ItineraryItem).filter(
        models.ItineraryItem.trip_id == trip_id,
        models.ItineraryItem.status != "CANCELLED"
    ).order_by(models.ItineraryItem.start_time.asc()).all()

    G = build_dependency_graph(active_items)

    # Propagate impact through network graph
    assessment = ImpactEngine.propagate_impact(G, {
        "trip_id": trip_id,
        "event_type": event_type,
        "entity_id": entity_id,
        "event_metadata": event_metadata
    })

    return {
        "event_id": disruption_record.id,
        "trip_id": trip_id,
        "assessment": assessment.model_dump()
    }

# ============================================================================
# PHASE 2: DISRUPTION SIMULATOR PRESETS
# ============================================================================
@app.post("/api/trips/{trip_id}/simulate")
def simulate_scenario(
    trip_id: int,
    scenario_type: str = Body(..., embed=True), # FLIGHT_DELAY_4H, FLIGHT_CANCEL, USER_REQUEST_ADVANCE
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

    target_item = items[0] # Default to first flight leg (e.g. Flight A Mumbai -> Delhi)

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
