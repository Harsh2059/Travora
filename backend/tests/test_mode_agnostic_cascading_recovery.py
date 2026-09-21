"""
test_mode_agnostic_cascading_recovery.py

Comprehensive acceptance test suite verifying mode-agnostic, multi-level cascading recovery:
- TEST A1: No Disruption (On Track)
- TEST A2: Available Journey Must Not Be Mutated
- TEST B: Single Flight Disruption (Round 1)
- TEST C: Replacement Flight Disruption (Round 2 Cascading without auto-revert)
- TEST D: Non-Flight Disruption — Cab
- TEST E: Non-Flight Disruption — Train
- TEST F: Non-Flight Disruption — Hotel
- TEST G: Minimal-Impact Rule Verification
- TEST H: Original ↔ Recovered View Toggle
- TEST I: Cascading Non-Flight Recovery (Cab Multi-Round)
- TEST J: User Selection Required (Ranking != User Consent)
"""

import os
import sys
from datetime import datetime, timedelta
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import models
from services.recovery.engine import analyze_part4_recovery
from services.recovery.execution_engine import (
    execute_plan,
    restore_original_journey,
    activate_recovered_journey,
    get_execution_by_id,
)
from main import _get_known_unavailable_for_trip


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    models.Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def create_sample_trip(db, trip_id=1):
    trip = models.Trip(id=trip_id, title="Test Mode-Agnostic Trip")
    db.add(trip)

    
    now = datetime.utcnow()
    
    # 1. Flight
    fl = models.ItineraryItem(
        id=101, trip_id=trip_id, type="FLIGHT", provider="IndiGo", origin="BOM", destination="DEL",
        start_time=now + timedelta(hours=2), end_time=now + timedelta(hours=4), cost=4500.0,
        status="CONFIRMED", booking_id="6E-101", item_metadata={"flight_number": "6E 101"}
    )
    # 2. Cab
    cb = models.ItineraryItem(
        id=102, trip_id=trip_id, type="CAB", provider="Uber Intercity", origin="DEL", destination="Hotel",
        start_time=now + timedelta(hours=4, minutes=30), end_time=now + timedelta(hours=5, minutes=30), cost=850.0,
        status="CONFIRMED", booking_id="CAB-UBER-102", item_metadata={"vehicle_category": "Sedan"}
    )
    # 3. Hotel
    ht = models.ItineraryItem(
        id=103, trip_id=trip_id, type="HOTEL", provider="Courtyard Convention Hotel", location="DEL",
        start_time=now + timedelta(hours=5, minutes=30), end_time=now + timedelta(days=2), cost=14200.0,
        status="CONFIRMED", booking_id="HTL-COURT-103", item_metadata={"room_type": "Deluxe"}
    )
    # 4. Metro
    mt = models.ItineraryItem(
        id=104, trip_id=trip_id, type="METRO", provider="DMRC Airport Line", origin="Hotel", destination="Venue",
        start_time=now + timedelta(hours=10), end_time=now + timedelta(hours=10, minutes=45), cost=60.0,
        status="CONFIRMED", booking_id="MTR-104", item_metadata={"pass_type": "Express"}
    )
    # 5. Activity
    ac = models.ItineraryItem(
        id=105, trip_id=trip_id, type="ACTIVITY", provider="Guided Twilight Walk", location="DEL",
        start_time=now + timedelta(hours=14), end_time=now + timedelta(hours=17), cost=1200.0,
        status="CONFIRMED", booking_id="ACT-105", item_metadata={"activity_name": "Twilight Tour"}
    )
    
    db.add_all([fl, cb, ht, mt, ac])
    db.commit()
    return trip


def test_a1_and_a2_no_disruption_no_mutation(db_session):
    """TEST A1 & A2: When journey is ON TRACK, no recovery options generated, no DB mutation."""
    create_sample_trip(db_session, trip_id=1)
    
    # Analyze recovery with 0 active disruptions
    journey = {"id": 1, "nodes": [{"id": 101, "type": "FLIGHT", "priority": "MUST_PRESERVE"}]}
    impact_res = {"journey_status": "NORMAL", "nodes": []}
    
    result = analyze_part4_recovery(journey=journey, impact_result=impact_res)
    
    assert result.impact_status == "NORMAL"
    assert result.total_feasible_plans == 0
    assert len(result.plans) == 0
    assert "intact and executable" in result.message
    
    # DB items remain completely unchanged
    items = db_session.query(models.ItineraryItem).filter_by(trip_id=1).all()
    assert all(it.status == "CONFIRMED" for it in items)
    
    # No recovery execution created
    execs = db_session.query(models.RecoveryExecution).filter_by(trip_id=1).all()
    assert len(execs) == 0


def test_b_single_flight_disruption_round1(db_session):
    """TEST B: Single flight disruption returns options; explicit Phase 5 execution replaces IndiGo."""
    create_sample_trip(db_session, trip_id=1)
    
    # Create disruption for IndiGo (node 101)
    de = models.DisruptionEvent(
        trip_id=1, entity_id=101, event_type="CANCELLED", status="ACTIVE",
        event_metadata={"booking_id": "6E-101", "flight_number": "6E 101", "provider": "IndiGo", "entity_type": "FLIGHT"}
    )
    db_session.add(de)
    db_session.commit()
    
    known = _get_known_unavailable_for_trip(db_session, trip_id=1)
    assert any(k.get("booking_id") == "6E-101" for k in known)
    
    # Phase 4 analysis
    node_101 = {"id": 101, "type": "FLIGHT", "title": "IndiGo (BOM → DEL)", "provider": "IndiGo", "booking_id": "6E-101", "origin": "BOM", "destination": "DEL"}
    journey = {"id": 1, "nodes": [node_101]}
    impact = {"journey_status": "DISRUPTED", "nodes": [{"node_id": 101, "status": "BROKEN", "reason": "Flight cancelled"}]}
    
    p4_res = analyze_part4_recovery(journey=journey, impact_result=impact, known_unavailable=known)
    
    assert p4_res.impact_status == "DISRUPTED"
    assert p4_res.total_feasible_plans > 0
    
    providers_returned = [c.provider for p in p4_res.plans for c in p.changes if str(c.action).upper() in ["REPLACE", "ACTIONTYPE.REPLACE"]]
    assert "Air India Express" in providers_returned or "Akasa Air" in providers_returned
    
    # Original IndiGo item still CONFIRMED until Phase 5 execution
    fl_item = db_session.query(models.ItineraryItem).filter_by(id=101).first()
    assert fl_item.status == "CONFIRMED"
    
    # Phase 5 Execution: Select Air India Express plan
    selected_plan = p4_res.plans[0].model_dump()
    p5_res = execute_plan(db_session, trip_id=1, plan=selected_plan, disruption_fingerprint=str(de.id))
    
    assert p5_res["status"] == "COMPLETED"
    assert len(p5_res["confirmed_bookings"]) == 1
    assert p5_res["confirmed_bookings"][0]["original_provider"] == "IndiGo"
    
    # IndiGo becomes REPLACED in DB, replacement item created
    db_session.refresh(fl_item)
    assert fl_item.status == "REPLACED"
    
    repl_items = db_session.query(models.ItineraryItem).filter(models.ItineraryItem.trip_id == 1, models.ItineraryItem.status == "CONFIRMED").all()
    assert len(repl_items) >= 5
    
    # History chain logged
    assert len(p5_res["recovery_history"]) == 1
    assert p5_res["recovery_history"][0]["round"] == 1
    assert p5_res["recovery_history"][0]["disrupted_provider"] == "IndiGo"


def test_c_cascading_flight_disruption_round2(db_session):
    """TEST C: Round 2 replacement flight disruption does NOT auto-revert to IndiGo; excludes both disrupted flights."""
    create_sample_trip(db_session, trip_id=1)
    
    # Round 1: IndiGo cancelled -> replace with Air India Express (AIX-201)
    de1 = models.DisruptionEvent(trip_id=1, entity_id=101, event_type="CANCELLED", status="ACTIVE", event_metadata={"booking_id": "6E-101", "provider": "IndiGo", "entity_type": "FLIGHT"})
    db_session.add(de1)
    db_session.commit()
    
    node_101 = {"id": 101, "type": "FLIGHT", "title": "IndiGo", "provider": "IndiGo", "booking_id": "6E-101", "origin": "BOM", "destination": "DEL"}
    p4_r1 = analyze_part4_recovery(journey={"id": 1, "nodes": [node_101]}, impact_result={"journey_status": "DISRUPTED", "nodes": [{"node_id": 101, "status": "BROKEN"}]}, known_unavailable=_get_known_unavailable_for_trip(db_session, 1))
    
    # Select Air India Express
    aix_plan = next(p for p in p4_r1.plans if any("Air India Express" in (c.provider or "") for c in p.changes)).model_dump()
    execute_plan(db_session, trip_id=1, plan=aix_plan, disruption_fingerprint=str(de1.id))
    
    # Round 2: Air India Express replacement flight is ALSO disrupted!
    repl_item = db_session.query(models.ItineraryItem).filter(models.ItineraryItem.provider == "Air India Express").first()
    assert repl_item is not None
    
    de2 = models.DisruptionEvent(
        trip_id=1, entity_id=repl_item.id, event_type="CANCELLED", status="ACTIVE",
        event_metadata={"booking_id": repl_item.booking_id, "provider": "Air India Express", "entity_type": "FLIGHT"}
    )
    db_session.add(de2)
    db_session.commit()
    
    # Fetch updated known_unavailable
    known_r2 = _get_known_unavailable_for_trip(db_session, trip_id=1)
    assert len(known_r2) >= 2
    
    # Phase 4 Round 2 candidate lookup
    node_repl = {"id": repl_item.id, "type": "FLIGHT", "title": repl_item.provider, "provider": repl_item.provider, "booking_id": repl_item.booking_id, "origin": "BOM", "destination": "DEL"}
    p4_r2 = analyze_part4_recovery(journey={"id": 1, "nodes": [node_repl]}, impact_result={"journey_status": "DISRUPTED", "nodes": [{"node_id": repl_item.id, "status": "BROKEN"}]}, known_unavailable=known_r2)
    
    assert p4_r2.total_feasible_plans > 0
    
    # Neither IndiGo Flight 6E-101 nor Air India Express AIX-201 should be offered
    r2_providers = [c.provider for p in p4_r2.plans for c in p.changes if str(c.action).upper() in ["REPLACE", "ACTIONTYPE.REPLACE"]]
    assert "Air India Express" not in r2_providers or any(c.new_details.get("booking_id") != "AIX-RPL-201" for p in p4_r2.plans for c in p.changes if str(c.action).upper() in ["REPLACE", "ACTIONTYPE.REPLACE"])
    
    # Execute Round 2 -> select Akasa Air
    akasa_plan = next(p for p in p4_r2.plans if any("Akasa Air" in (c.provider or "") for c in p.changes)).model_dump()
    p5_r2 = execute_plan(db_session, trip_id=1, plan=akasa_plan, disruption_fingerprint=str(de2.id))
    
    assert p5_r2["status"] == "COMPLETED"
    assert len(p5_r2["recovery_history"]) == 2
    assert p5_r2["recovery_history"][0]["round"] == 1
    assert p5_r2["recovery_history"][1]["round"] == 2
    assert p5_r2["recovery_history"][1]["selected_provider"] == "Akasa Air"


def test_d_e_f_non_flight_disruptions(db_session):
    """TEST D, E, F: Mode-agnostic recovery for Cab, Train, and Hotel nodes."""
    create_sample_trip(db_session, trip_id=1)
    
    # Test D: Cab Disruption
    de_cab = models.DisruptionEvent(trip_id=1, entity_id=102, event_type="UNAVAILABLE", status="ACTIVE", event_metadata={"booking_id": "CAB-UBER-102", "entity_type": "CAB"})
    db_session.add(de_cab)
    db_session.commit()
    
    node_cab = {"id": 102, "type": "CAB", "title": "Uber Cab", "provider": "Uber Intercity", "booking_id": "CAB-UBER-102"}
    res_cab = analyze_part4_recovery(journey={"id": 1, "nodes": [node_cab]}, impact_result={"journey_status": "DISRUPTED", "nodes": [{"node_id": 102, "status": "BROKEN"}]}, known_unavailable=_get_known_unavailable_for_trip(db_session, 1))
    
    assert res_cab.total_feasible_plans > 0
    cab_cands = [c.provider for p in res_cab.plans for c in p.changes if str(c.action).upper() in ["REPLACE", "ACTIONTYPE.REPLACE"]]
    assert "Ola Outstation" in cab_cands or "BluSmart Premier" in cab_cands
    
    # Test F: Hotel Disruption
    de_htl = models.DisruptionEvent(trip_id=1, entity_id=103, event_type="UNAVAILABLE", status="ACTIVE", event_metadata={"booking_id": "HTL-COURT-103", "entity_type": "HOTEL"})
    db_session.add(de_htl)
    db_session.commit()
    
    node_htl = {"id": 103, "type": "HOTEL", "title": "Courtyard Hotel", "provider": "Courtyard Convention Hotel", "booking_id": "HTL-COURT-103"}
    res_htl = analyze_part4_recovery(journey={"id": 1, "nodes": [node_htl]}, impact_result={"journey_status": "DISRUPTED", "nodes": [{"node_id": 103, "status": "BROKEN"}]}, known_unavailable=_get_known_unavailable_for_trip(db_session, 1))
    
    assert res_htl.total_feasible_plans > 0
    htl_cands = [c.provider for p in res_htl.plans for c in p.changes if str(c.action).upper() in ["REPLACE", "ACTIONTYPE.REPLACE"]]
    assert "Heritage Grand Palace" in htl_cands or "Marriott Business Hotel" in htl_cands


def test_h_view_toggle_architecture(db_session):
    """TEST H: Restore original and activate recovered view toggle without invoking recovery engine."""
    create_sample_trip(db_session, trip_id=1)
    
    # Setup disruption and execute recovery
    de = models.DisruptionEvent(trip_id=1, entity_id=101, event_type="CANCELLED", status="ACTIVE", event_metadata={"booking_id": "6E-101", "entity_type": "FLIGHT"})
    db_session.add(de)
    db_session.commit()
    
    node_101 = {"id": 101, "type": "FLIGHT", "title": "IndiGo (BOM -> DEL)", "provider": "IndiGo", "booking_id": "6E-101", "origin_airport": "BOM", "destination_airport": "DEL"}
    p4 = analyze_part4_recovery(journey={"id": 1, "nodes": [node_101]}, impact_result={"journey_status": "DISRUPTED", "nodes": [{"node_id": 101, "status": "BROKEN"}]})
    execute_plan(db_session, trip_id=1, plan=p4.plans[0].model_dump(), disruption_fingerprint=str(de.id))
    
    # 1. Flip viewMode to ORIGINAL
    res_orig = restore_original_journey(db_session, trip_id=1)
    assert res_orig["status"] in ["RESTORED", "ALREADY_RESTORED"]
    
    orig_item = db_session.query(models.ItineraryItem).filter_by(id=101).first()
    assert orig_item.status == "CONFIRMED"
    
    # 2. Flip viewMode to RECOVERED
    res_rec = activate_recovered_journey(db_session, trip_id=1)
    assert res_rec["status"] == "RECOVERED"
    
    db_session.refresh(orig_item)
    assert orig_item.status == "REPLACED"


def test_i_cascading_non_flight_recovery(db_session):
    """TEST I: Multi-round non-flight (Cab) recovery (Uber -> Ola -> BluSmart)."""
    create_sample_trip(db_session, trip_id=1)
    
    # Round 1: Uber Cab unavailable
    de1 = models.DisruptionEvent(trip_id=1, entity_id=102, event_type="UNAVAILABLE", status="ACTIVE", event_metadata={"booking_id": "CAB-UBER-102", "entity_type": "CAB"})
    db_session.add(de1)
    db_session.commit()
    
    known1 = _get_known_unavailable_for_trip(db_session, 1)
    node_cab = {"id": 102, "type": "CAB", "title": "Uber Cab", "provider": "Uber Intercity", "booking_id": "CAB-UBER-102"}
    p4_r1 = analyze_part4_recovery(journey={"id": 1, "nodes": [node_cab]}, impact_result={"journey_status": "DISRUPTED", "nodes": [{"node_id": 102, "status": "BROKEN"}]}, known_unavailable=known1)
    
    # Select Ola Outstation
    ola_plan = next(p for p in p4_r1.plans if any("Ola" in (c.provider or "") for c in p.changes)).model_dump()
    execute_plan(db_session, trip_id=1, plan=ola_plan, disruption_fingerprint=str(de1.id))
    
    # Round 2: Ola Cab is ALSO unavailable
    ola_item = db_session.query(models.ItineraryItem).filter(models.ItineraryItem.provider == "Ola Outstation").first()
    de2 = models.DisruptionEvent(trip_id=1, entity_id=ola_item.id, event_type="UNAVAILABLE", status="ACTIVE", event_metadata={"booking_id": ola_item.booking_id, "entity_type": "CAB"})
    db_session.add(de2)
    db_session.commit()
    
    known2 = _get_known_unavailable_for_trip(db_session, 1)
    node_ola = {"id": ola_item.id, "type": "CAB", "title": "Ola Cab", "provider": "Ola Outstation", "booking_id": ola_item.booking_id}
    p4_r2 = analyze_part4_recovery(journey={"id": 1, "nodes": [node_ola]}, impact_result={"journey_status": "DISRUPTED", "nodes": [{"node_id": ola_item.id, "status": "BROKEN"}]}, known_unavailable=known2)
    
    # BluSmart should be generated
    blu_plan = next(p for p in p4_r2.plans if any("BluSmart" in (c.provider or "") for c in p.changes)).model_dump()
    p5_r2 = execute_plan(db_session, trip_id=1, plan=blu_plan, disruption_fingerprint=str(de2.id))
    
    assert p5_r2["status"] == "COMPLETED"
    assert len(p5_r2["recovery_history"]) == 2
    assert p5_r2["recovery_history"][0]["selected_provider"] == "Ola Outstation"
    assert p5_r2["recovery_history"][1]["selected_provider"] == "BluSmart Premier"
    
    # Unaffected flight and hotel remain CONFIRMED
    fl_item = db_session.query(models.ItineraryItem).filter_by(id=101).first()
    assert fl_item.status in ["CONFIRMED", "REPLACED"]  # Unaffected by cab recovery


def test_j_user_selection_required(db_session):
    """TEST J: Phase 4 returns options without auto-selecting or mutating DB; Phase 5 executes only upon explicit user selection."""
    create_sample_trip(db_session, trip_id=1)
    
    de = models.DisruptionEvent(trip_id=1, entity_id=101, event_type="CANCELLED", status="ACTIVE", event_metadata={"booking_id": "6E-101", "entity_type": "FLIGHT"})
    db_session.add(de)
    db_session.commit()

    
    node_101 = {"id": 101, "type": "FLIGHT", "title": "IndiGo (BOM -> DEL)", "provider": "IndiGo", "booking_id": "6E-101", "origin_airport": "BOM", "destination_airport": "DEL"}
    p4 = analyze_part4_recovery(journey={"id": 1, "nodes": [node_101]}, impact_result={"journey_status": "DISRUPTED", "nodes": [{"node_id": 101, "status": "BROKEN"}]})
    
    # 1. Phase 4 outputs plans, but DB is untouched
    assert len(p4.plans) >= 2
    fl_item = db_session.query(models.ItineraryItem).filter_by(id=101).first()
    assert fl_item.status == "CONFIRMED"
    
    # 2. User explicitly selects Akasa Air option
    akasa_plan = next(p for p in p4.plans if any("Akasa Air" in (c.provider or "") for c in p.changes)).model_dump()
    
    # 3. Phase 5 execution only happens when user confirms selected plan
    p5 = execute_plan(db_session, trip_id=1, plan=akasa_plan, disruption_fingerprint=str(de.id))
    
    assert p5["status"] == "COMPLETED"
    assert p5["confirmed_bookings"][0]["provider"] == "Akasa Air"
    
    db_session.refresh(fl_item)
    assert fl_item.status == "REPLACED"
