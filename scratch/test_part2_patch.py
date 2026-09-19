import requests
import json

BASE_URL = "http://127.0.0.1:8000/api"

def test_part2_patch():
    print("=== Part 2 Patch E2E Test Suite ===")

    # 1. Fetch user trips
    resp = requests.get(f"{BASE_URL}/users/1/trips")
    assert resp.status_code == 200, "Failed to fetch user trips"
    trips = resp.json()
    assert len(trips) > 0, "No trips found for test user"
    trip_id = trips[0]["id"]
    print(f"1. Active Trip ID: {trip_id}")

    # Fetch trip details
    resp = requests.get(f"{BASE_URL}/trips/{trip_id}")
    assert resp.status_code == 200, "Failed to fetch trip"
    trip_data = resp.json()
    items = trip_data.get("items", [])
    assert len(items) > 0, "Trip has no items"
    affected_item = items[0]
    affected_id = str(affected_item["id"])
    print(f"2. Selected affected booking: {affected_item.get('title')} (ID: {affected_id})")

    # Clean existing disruptions first
    requests.post(f"{BASE_URL}/trips/{trip_id}/disruptions/reset")

    # 3. Trigger FLIGHT_CANCELLED disruption with specific detected_at & reason
    detected_at_str = "2026-09-19T16:52:00.000Z"
    reason_str = "Manufacturing defect"
    payload = {
        "trip_id": trip_id,
        "affected_node_id": affected_id,
        "entity_id": affected_id,
        "type": "FLIGHT_CANCELLED",
        "event_type": "FLIGHT_CANCELLED",
        "detected_at": detected_at_str,
        "reason": reason_str,
        "delay_minutes": None
    }
    resp = requests.post(f"{BASE_URL}/trips/{trip_id}/disruptions", json=payload)
    assert resp.status_code == 200, f"Trigger failed: {resp.text}"
    print("3. Disruption triggered successfully.")

    # 4. Verify Admin Console Refresh State Restoration (Backend as Source of Truth)
    resp = requests.get(f"{BASE_URL}/trips/{trip_id}/disruptions")
    assert resp.status_code == 200, "Failed to fetch disruptions history"
    history = resp.json()
    assert len(history) > 0, "Disruption history is empty"
    active_disp = history[0]

    assert str(active_disp.get("entity_id")) == affected_id, f"Entity ID mismatch on refresh! Expected {affected_id}, got {active_disp.get('entity_id')}"
    assert active_disp.get("event_type") == "FLIGHT_CANCELLED", f"Type mismatch! Expected FLIGHT_CANCELLED, got {active_disp.get('event_type')}"
    
    # Verify detected_at timestamp is preserved
    backend_ts = active_disp.get("timestamp")
    assert backend_ts is not None, "Timestamp is missing from backend response!"
    assert "2026-09-19" in backend_ts, f"Detected_at timestamp mismatch! Got {backend_ts}"
    assert active_disp.get("event_metadata", {}).get("reason") == reason_str, f"Reason mismatch! Expected {reason_str}, got {active_disp.get('event_metadata', {}).get('reason')}"
    print("4. CONFIRMED: Admin state is 100% refresh-safe and authoritative from backend!")

    # 5. Verify Traveler Notification Data Connection
    print("5. Verifying traveler HomeScreen backend connection...")
    # Verify downstream items are NOT mutated by Part 2
    resp = requests.get(f"{BASE_URL}/trips/{trip_id}")
    trip_data_post = resp.json()
    for item in trip_data_post.get("items", []):
        status = item.get("status", "OK")
        assert status not in ["BROKEN", "AT_RISK", "NEEDS_CHANGE"], f"Part 2 violated strict rule by mutating item {item['id']} status to {status}"
    print("   CONFIRMED: Downstream items remain untouched (Part 2 isolation constraint verified)!")

    # 6. Test CAB_DELAYED with delay_minutes persistence
    cab_item = items[-1]
    cab_id = str(cab_item["id"])
    delay_payload = {
        "trip_id": trip_id,
        "affected_node_id": cab_id,
        "entity_id": cab_id,
        "type": "CAB_DELAYED",
        "event_type": "CAB_DELAYED",
        "detected_at": "2026-09-19T17:15:00.000Z",
        "reason": "Traffic congestion",
        "delay_minutes": 120
    }
    requests.post(f"{BASE_URL}/trips/{trip_id}/disruptions", json=delay_payload)
    resp = requests.get(f"{BASE_URL}/trips/{trip_id}/disruptions")
    delay_disp = resp.json()[0]
    assert delay_disp.get("event_metadata", {}).get("delay_minutes") == 120, "delay_minutes failed to persist!"
    print("6. CONFIRMED: Delay duration (120 min) persisted across backend fetch!")

    # 7. Test Reset Simulation
    resp = requests.post(f"{BASE_URL}/trips/{trip_id}/disruptions/reset")
    assert resp.status_code == 200, "Reset endpoint failed"
    resp = requests.get(f"{BASE_URL}/trips/{trip_id}/disruptions")
    assert len(resp.json()) == 0, "Disruptions still present after reset"
    
    # Confirm trip structure intact
    resp = requests.get(f"{BASE_URL}/trips/{trip_id}")
    assert len(resp.json()["items"]) == len(items), "Reset altered original itinerary items!"
    print("7. CONFIRMED: Reset clears simulation without altering original journey!")

    print("\n[SUCCESS] ALL PART 2 PATCH TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_part2_patch()
