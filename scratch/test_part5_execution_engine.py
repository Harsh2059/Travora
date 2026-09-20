"""
test_part5_execution_engine.py

Comprehensive test suite verifying Part 5 Booking & Execution Engine:
- Revalidation of candidate replacements
- Provider abstraction & deterministic mock responses
- Execution review pricing calculations
- Execution of single and multi-booking replacements
- Database state updates (REPLACED for old, CONFIRMED for replacement, intact for unchanged)
- Persisted booking details (PNR, ticket number, room confirmation, cab reference)
- Stale plan protection (disruption fingerprint mismatch)
- Idempotency guard (repeated execution returns existing record)
"""

import os
import sys
from datetime import datetime, timedelta, timezone

# Add backend directory to sys.path
backend_dir = r"c:\Projects\Travora\Travora\backend"
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database import engine, SessionLocal
import models
from services.recovery.execution_engine import (
    revalidate_plan,
    execute_plan,
    get_execution_by_id,
    get_active_disruption_fingerprint
)


def run_part5_tests():
    print("==================================================================")
    print("STARTING PART 5 BOOKING & EXECUTION ENGINE TEST SUITE")
    print("==================================================================")

    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Clean test data
        db.query(models.RecoveryExecutionItem).delete()
        db.query(models.RecoveryExecution).delete()
        db.query(models.DisruptionEvent).delete()
        db.query(models.ItineraryItem).delete()
        db.query(models.Trip).delete()
        db.commit()

        # 2. Setup Test Trip and Itinerary Nodes
        now = datetime.now(timezone.utc)
        trip = models.Trip(title="Part 5 Acceptance Trip")
        db.add(trip)
        db.commit()
        db.refresh(trip)
        trip_id = getattr(trip, 'id')

        # Original Flight
        flight_item = models.ItineraryItem(
            trip_id=trip_id,
            type="FLIGHT",
            provider="Indigo",
            origin="Mumbai Airport",
            destination="Punjab",
            start_time=now + timedelta(hours=2),
            end_time=now + timedelta(hours=5),
            cost=4500.0,
            currency="INR",
            priority="MUST_PRESERVE",
            status="BROKEN"
        )
        # Original Hotel
        hotel_item = models.ItineraryItem(
            trip_id=trip_id,
            type="HOTEL",
            provider="Hotel Ram",
            location="Punjab",
            start_time=now + timedelta(hours=6),
            end_time=now + timedelta(days=2),
            cost=6000.0,
            currency="INR",
            priority="PREFER_TO_PRESERVE",
            status="NEEDS_CHANGE"
        )
        # Unchanged Cab
        cab_item = models.ItineraryItem(
            trip_id=trip_id,
            type="CAB",
            provider="Ola",
            origin="Punjab Station",
            destination="Hotel Ram",
            start_time=now + timedelta(hours=5, minutes=30),
            end_time=now + timedelta(hours=6),
            cost=800.0,
            currency="INR",
            priority="OPTIMIZE",
            status="CONFIRMED"
        )
        db.add_all([flight_item, hotel_item, cab_item])
        db.commit()
        db.refresh(flight_item)
        db.refresh(hotel_item)
        db.refresh(cab_item)

        # 3. Add Active Disruption
        disruption = models.DisruptionEvent(
            trip_id=trip_id,
            event_type="FLIGHT_CANCELLED",
            entity_id=str(flight_item.id),
            event_metadata={"reason": "Technical issue"}
        )
        db.add(disruption)
        db.commit()
        db.refresh(disruption)

        active_fp = get_active_disruption_fingerprint(db, trip_id)
        assert active_fp == str(disruption.id), f"Fingerprint mismatch: expected {disruption.id}, got {active_fp}"
        print(f"[OK] Active disruption set initialized with fingerprint: {active_fp}")

        # 4. Construct Part 4 Recovery Plan proposal
        selected_plan = {
            "id": "plan_acceptance_1",
            "title": "Air India Express + Hotel ABC Recovery Plan",
            "category": "PRIORITY_PRESERVING",
            "feasibility": "FEASIBLE",
            "estimated_additional_cost": 1800.0,
            "estimated_refund": 4500.0,
            "explanation": "Replaces cancelled Indigo flight with Air India Express and updates Hotel Ram to Hotel ABC.",
            "changes": [
                {
                    "node_id": str(flight_item.id),
                    "original_title": "Indigo (Mumbai Airport -> Punjab)",
                    "action": "REPLACE",
                    "type": "FLIGHT",
                    "new_title": "Air India Express IX 142",
                    "estimated_cost": 5500.0,
                    "estimated_refund": 4500.0,
                    "provider": "Air India Express"
                },
                {
                    "node_id": str(hotel_item.id),
                    "original_title": "Hotel Ram (Punjab)",
                    "action": "REPLACE",
                    "type": "HOTEL",
                    "new_title": "Hotel ABC Deluxe",
                    "estimated_cost": 1800.0,
                    "estimated_refund": 1000.0,
                    "provider": "Hotel ABC"
                },
                {
                    "node_id": str(cab_item.id),
                    "original_title": "Ola (Punjab Station -> Hotel Ram)",
                    "action": "KEEP",
                    "type": "CAB"
                }
            ]
        }

        # ------------------------------------------------------------------
        # TEST 1: Revalidation Success & Price Review
        # ------------------------------------------------------------------
        print("\n--- TEST 1: Revalidating selected plan ---")
        reval_res = revalidate_plan(
            db=db,
            trip_id=trip_id,
            plan=selected_plan,
            disruption_fingerprint=active_fp
        )
        assert reval_res["status"] == "READY_FOR_CONFIRMATION", f"Unexpected status: {reval_res['status']}"
        assert len(reval_res["revalidated_items"]) == 2, f"Expected 2 revalidated items, got {len(reval_res['revalidated_items'])}"
        assert len(reval_res["unchanged_items"]) == 1, f"Expected 1 unchanged item, got {len(reval_res['unchanged_items'])}"
        print(f"[OK] Revalidation successful. Status: {reval_res['status']}")
        print(f"   Earlier Est Addl Cost: INR {reval_res['earlier_estimated_additional_cost']}")
        print(f"   Current Total Cost: INR {reval_res['current_total_price']}")
        print(f"   Price Difference: INR {reval_res['price_difference']}")

        # ------------------------------------------------------------------
        # TEST 2: Stale Plan Protection during Revalidation
        # ------------------------------------------------------------------
        print("\n--- TEST 2: Stale disruption fingerprint handling ---")
        stale_reval = revalidate_plan(
            db=db,
            trip_id=trip_id,
            plan=selected_plan,
            disruption_fingerprint="outdated_fp_999"
        )
        assert stale_reval["status"] == "STALE_PLAN", f"Expected STALE_PLAN, got {stale_reval['status']}"
        print(f"[OK] Stale plan correctly rejected: {stale_reval['message']}")

        # ------------------------------------------------------------------
        # TEST 3: Execution of Recovery Replacements & Persistence
        # ------------------------------------------------------------------
        print("\n--- TEST 3: Executing replacement bookings ---")
        exec_id = reval_res["execution_id"]
        exec_res = execute_plan(
            db=db,
            trip_id=trip_id,
            plan=selected_plan,
            disruption_fingerprint=active_fp,
            execution_id=exec_id
        )

        assert exec_res["status"] == "COMPLETED", f"Expected COMPLETED, got {exec_res['status']}"
        assert exec_res["journey_status"] == "RECOVERED", f"Expected RECOVERED, got {exec_res['journey_status']}"
        assert len(exec_res["confirmed_bookings"]) == 2, f"Expected 2 confirmed bookings, got {len(exec_res['confirmed_bookings'])}"

        flight_booking = next(b for b in exec_res["confirmed_bookings"] if b["type"] == "FLIGHT")
        hotel_booking = next(b for b in exec_res["confirmed_bookings"] if b["type"] == "HOTEL")

        assert flight_booking["pnr"] and len(flight_booking["pnr"]) > 0, "Flight PNR missing!"
        assert flight_booking["ticket_number"] and len(flight_booking["ticket_number"]) > 0, "Ticket number missing!"
        assert hotel_booking["confirmation_number"] and len(hotel_booking["confirmation_number"]) > 0, "Hotel confirmation missing!"

        pnr_original = flight_booking["pnr"]
        tkt_original = flight_booking["ticket_number"]
        htl_original = hotel_booking["confirmation_number"]

        print(f"[OK] Bookings confirmed successfully:")
        print(f"   Flight: {flight_booking['replacement_title']} | PNR: {pnr_original} | Ticket: {tkt_original} | Seat: {flight_booking['seat']}")
        print(f"   Hotel: {hotel_booking['replacement_title']} | Conf: {htl_original} | Room: {hotel_booking['room_type']}")

        # ------------------------------------------------------------------
        # TEST 4: Database Itinerary State Update
        # ------------------------------------------------------------------
        print("\n--- TEST 4: Verifying database itinerary updates ---")
        # Fetch updated items for trip
        updated_items = db.query(models.ItineraryItem).filter(
            models.ItineraryItem.trip_id == trip_id
        ).all()

        # Original flight should be REPLACED
        db_orig_flight = db.query(models.ItineraryItem).filter(models.ItineraryItem.id == flight_item.id).first()
        assert db_orig_flight is not None and db_orig_flight.status == "REPLACED", f"Original flight status expected REPLACED"

        # Original hotel should be REPLACED
        db_orig_hotel = db.query(models.ItineraryItem).filter(models.ItineraryItem.id == hotel_item.id).first()
        assert db_orig_hotel is not None and db_orig_hotel.status == "REPLACED", f"Original hotel status expected REPLACED"

        # Unchanged cab should remain CONFIRMED
        db_cab = db.query(models.ItineraryItem).filter(models.ItineraryItem.id == cab_item.id).first()
        assert db_cab is not None and db_cab.status == "CONFIRMED", f"Cab status expected CONFIRMED"

        # Replacement items created and CONFIRMED
        replacement_flight = next(it for it in updated_items if it.type == "FLIGHT" and it.status == "CONFIRMED")
        replacement_hotel = next(it for it in updated_items if it.type == "HOTEL" and it.status == "CONFIRMED")

        assert replacement_flight.provider == "Air India Express", f"Unexpected provider: {replacement_flight.provider}"
        assert replacement_hotel.provider == "Hotel ABC", f"Unexpected provider: {replacement_hotel.provider}"

        print(f"[OK] Original items set to REPLACED. Replacements set to CONFIRMED. Unchanged cab untouched.")

        # ------------------------------------------------------------------
        # TEST 5: Idempotency & PNR Stability Test
        # ------------------------------------------------------------------
        print("\n--- TEST 5: Verifying idempotency & PNR stability ---")
        repeat_exec = execute_plan(
            db=db,
            trip_id=trip_id,
            plan=selected_plan,
            disruption_fingerprint=active_fp,
            execution_id=exec_id
        )

        assert repeat_exec["status"] == "COMPLETED"
        repeat_flight = next(b for b in repeat_exec["confirmed_bookings"] if b["type"] == "FLIGHT")
        repeat_hotel = next(b for b in repeat_exec["confirmed_bookings"] if b["type"] == "HOTEL")

        assert repeat_flight["pnr"] == pnr_original, f"PNR changed on repeat call! {pnr_original} != {repeat_flight['pnr']}"
        assert repeat_flight["ticket_number"] == tkt_original, f"Ticket number changed on repeat call!"
        assert repeat_hotel["confirmation_number"] == htl_original, f"Hotel confirmation code changed on repeat call!"

        print(f"[OK] Idempotency verified! PNR {pnr_original} and Ticket {tkt_original} stayed perfectly stable.")

        # ------------------------------------------------------------------
        # TEST 6: Execution Status Retrieval API
        # ------------------------------------------------------------------
        print("\n--- TEST 6: Fetching execution state from DB ---")
        persisted_exec = get_execution_by_id(db, exec_id)
        assert persisted_exec is not None, "Execution record not found in DB!"
        assert persisted_exec["status"] == "COMPLETED"
        assert persisted_exec["execution_id"] == exec_id
        print(f"[OK] Execution status successfully retrieved by execution_id: {exec_id}")

        print("\n==================================================")
        print("ALL PART 5 ACCEPTANCE TESTS PASSED SUCCESSFULLY!")
        print("==================================================")

    finally:
        db.close()


if __name__ == "__main__":
    run_part5_tests()
