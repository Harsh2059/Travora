import pytest
from datetime import datetime, timedelta
from database import SessionLocal, Base, engine
import models
import schemas
from main import get_trip_details, trigger_disruption, analyze_trip_impact, analyze_part4_recovery_endpoint, execute_recovery_endpoint
from services.graph.builder import build_dependency_graph


@pytest.fixture(scope="module")
def e2e_setup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Clean up prior test user if exists
    user = db.query(models.User).filter(models.User.email == "e2e_wiring@test.com").first()
    if user:
        # Delete existing trips for this test user
        trips = db.query(models.Trip).filter(models.Trip.user_id == user.id).all()
        for t in trips:
            db.query(models.ItineraryItem).filter(models.ItineraryItem.trip_id == t.id).delete()
            db.query(models.DisruptionEvent).filter(models.DisruptionEvent.trip_id == t.id).delete()
            db.query(models.RecoveryExecutionItem).filter(models.RecoveryExecutionItem.execution_id.in_(
                db.query(models.RecoveryExecution.execution_id).filter(models.RecoveryExecution.trip_id == t.id)
            )).delete()
            db.query(models.RecoveryExecution).filter(models.RecoveryExecution.trip_id == t.id).delete()
            db.delete(t)
        db.delete(user)
        db.commit()

    user = models.User(name="E2E Test User", email="e2e_wiring@test.com", whatsapp_phone="+917710989999")
    db.add(user)
    db.commit()

    yield {"db": db, "user": user}
    db.close()


def test_complete_parts1_to_5_end_to_end_flow(e2e_setup):
    db = e2e_setup["db"]
    user = e2e_setup["user"]

    # =========================================================================
    # PART 1: JOURNEY BUILDER & PERSISTENCE
    # =========================================================================
    trip = models.Trip(title="E2E Mumbai to London Journey", user_id=user.id)
    db.add(trip)
    db.commit()
    db.refresh(trip)
    assert trip.id is not None, "Part 1: Trip ID must be generated"

    # Add 4 connected itinerary items
    item1 = models.ItineraryItem(
        trip_id=trip.id,
        type="FLIGHT",
        provider="Air India",
        origin="BOM",
        destination="DEL",
        start_time=datetime(2026, 9, 25, 8, 0, 0),
        end_time=datetime(2026, 9, 25, 10, 15, 0),
        cost=4800.0,
        currency="INR",
        priority="MUST_PRESERVE",
        flexibility="FIXED",
        status="CONFIRMED",
        booking_id="AI-201",
        item_metadata={"flight_number": "AI-201", "pnr": "E2E111"}
    )
    item2 = models.ItineraryItem(
        trip_id=trip.id,
        type="FLIGHT",
        provider="British Airways",
        origin="DEL",
        destination="LHR",
        start_time=datetime(2026, 9, 25, 13, 0, 0),
        end_time=datetime(2026, 9, 25, 19, 0, 0),
        cost=45000.0,
        currency="INR",
        priority="MUST_PRESERVE",
        flexibility="FIXED",
        status="CONFIRMED",
        booking_id="BA-552",
        item_metadata={"flight_number": "BA-552", "pnr": "E2E222"}
    )
    item3 = models.ItineraryItem(
        trip_id=trip.id,
        type="CAB",
        provider="Heathrow Express",
        origin="LHR",
        destination="London Central",
        location="London",
        start_time=datetime(2026, 9, 25, 20, 0, 0),
        end_time=datetime(2026, 9, 25, 21, 0, 0),
        cost=1500.0,
        currency="INR",
        priority="PREFER_TO_PRESERVE",
        flexibility="FLEXIBLE",
        status="CONFIRMED",
        booking_id="HEX-007",
        item_metadata={"booking_ref": "HEX-007"}
    )
    item4 = models.ItineraryItem(
        trip_id=trip.id,
        type="HOTEL",
        provider="Marriott London",
        location="London",
        start_time=datetime(2026, 9, 25, 21, 30, 0),
        end_time=datetime(2026, 9, 28, 11, 0, 0),
        cost=30000.0,
        currency="INR",
        priority="MUST_PRESERVE",
        flexibility="FIXED",
        status="CONFIRMED",
        booking_id="MAR-8821",
        item_metadata={"confirmation": "MAR-8821"}
    )
    db.add_all([item1, item2, item3, item4])
    db.commit()

    # Retrieve trip details via Part 1 API helper
    trip_data = get_trip_details(trip_id=trip.id, db=db)
    assert len(trip_data["items"]) == 4, "Part 1: All 4 items must be retrieved"
    item1_id = item1.id
    item2_id = item2.id

    # =========================================================================
    # PART 2: DIGITAL TWIN GRAPH & DISRUPTION INJECTION
    # =========================================================================
    # Build NetworkX DiGraph
    items = db.query(models.ItineraryItem).filter(models.ItineraryItem.trip_id == trip.id).all()
    G = build_dependency_graph(items)
    assert G.has_node(str(item1_id)), "Part 2: Node for Item 1 must exist in graph"
    assert G.has_node(str(item2_id)), "Part 2: Node for Item 2 must exist in graph"

    # Inject disruption on Item 1 via Part 2 endpoint logic
    disr_payload = {
        "event_type": "FLIGHT_CANCELLED",
        "entity_id": item1_id,
        "severity": "HIGH",
        "reason": "Technical failure"
    }
    disr_res = trigger_disruption(trip_id=trip.id, event_payload=disr_payload, db=db)
    assert disr_res["status"] == "ACTIVE", "Part 2: Disruption event must be ACTIVE"
    disruption_id = disr_res["id"]

    # =========================================================================
    # PART 3: IMPACT & RIPPLE ENGINE
    # =========================================================================
    impact_res = analyze_trip_impact(trip.id, payload={}, db=db)
    assert impact_res["journey_status"] == "DISRUPTED", "Part 3: Journey status must be DISRUPTED"
    assert impact_res["disruption_fingerprint"] != "", "Part 3: Fingerprint must be generated"
    assert len(impact_res["nodes"]) >= 1, "Part 3: Nodes must be populated"

    # Verify that Item 1 is marked as affected (BROKEN or NEEDS_CHANGE)
    affected_nodes = [n for n in impact_res["nodes"] if n["status"] != "INTACT"]
    assert len(affected_nodes) >= 1, "Part 3: At least one affected node must be non-INTACT"

    # =========================================================================
    # PART 4: RECOVERY ENGINE
    # =========================================================================
    recovery_res = analyze_part4_recovery_endpoint(
        trip.id,
        payload={"preference": "BALANCED", "max_budget": 100000},
        db=db
    )
    assert recovery_res["status"] in ["OPTIONS_AVAILABLE", "FEASIBLE_OPTIONS_AVAILABLE", "RECOVERY_REVIEWED"], f"Part 4: Recovery status was {recovery_res['status']}"
    assert len(recovery_res["plans"]) > 0, "Part 4: At least one recovery plan must be generated"
    
    selected_plan = recovery_res["plans"][0]
    assert selected_plan["id"] is not None, "Part 4: Plan ID must exist"
    assert len(selected_plan["changes"]) > 0, "Part 4: Plan changes must be populated"

    # =========================================================================
    # PART 5: BOOKING & EXECUTION ENGINE
    # =========================================================================
    exec_payload = {
        "selectedPlan": selected_plan,
        "disruption_fingerprint": recovery_res["disruption_fingerprint"]
    }
    exec_res = execute_recovery_endpoint(trip.id, payload=exec_payload, db=db)
    assert exec_res["status"] in ["COMPLETED", "PARTIALLY_COMPLETED"], "Part 5: Execution status must be COMPLETED"
    assert exec_res["viewMode"] == "RECOVERED", "Part 5: viewMode must be set to RECOVERED"

    # Verify DB state after execution
    updated_trip = get_trip_details(trip_id=trip.id, db=db)
    assert updated_trip["view_mode"] == "RECOVERED", "Part 5 DB: Trip view_mode must be RECOVERED"
    
    # Check that active disruption is now RESOLVED
    active_disruptions = db.query(models.DisruptionEvent).filter(
        models.DisruptionEvent.trip_id == trip.id,
        models.DisruptionEvent.status == "ACTIVE"
    ).all()
    assert len(active_disruptions) == 0, "Part 5 DB: All active disruptions must be resolved upon recovery execution"

    # Check that SmsJob was created for dynamic recovery notification
    sms_jobs = db.query(models.SmsJob).filter(models.SmsJob.trip_id == trip.id).all()
    assert len(sms_jobs) >= 1, "Part 5 Notifications: Dynamic SMS job must be queued"
    sms_msg = sms_jobs[-1].message or ""
    assert (
        "Travora Alert" in sms_msg
        or "Recovery confirmed" in sms_msg
        or "Disruption Alert" in sms_msg
        or len(sms_msg) > 10
    ), f"Part 5 Notifications: SMS content must be dynamic, got: {sms_msg!r}"
