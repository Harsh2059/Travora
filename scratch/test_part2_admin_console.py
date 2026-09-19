import requests

BASE_URL = "http://localhost:8000/api"

def test_part2_backend():
    print("1. Fetching user trips...")
    trips_res = requests.get(f"{BASE_URL}/users/1/trips")
    assert trips_res.status_code == 200
    trips = trips_res.json()
    assert len(trips) > 0, "No trips found for user 1"
    
    trip_id = trips[0]["id"]
    print(f"   Selected trip ID: {trip_id}")

    print("2. Fetching trip details...")
    trip_res = requests.get(f"{BASE_URL}/trips/{trip_id}")
    assert trip_res.status_code == 200
    trip = trip_res.json()
    items = trip.get("items", [])
    assert len(items) > 0, "No items found in trip"
    
    affected_item = items[0]
    affected_id = affected_item["id"]
    print(f"   Selected booking: {affected_item['provider']} (ID: {affected_id})")

    print("3. Triggering FLIGHT_CANCELLED disruption event...")
    disruption_payload = {
        "trip_id": trip_id,
        "affected_node_id": affected_id,
        "type": "FLIGHT_CANCELLED",
        "detected_at": "2026-09-20T10:15:00",
        "reason": "Operational disruption",
        "delay_minutes": None
    }
    trigger_res = requests.post(f"{BASE_URL}/trips/{trip_id}/disruptions", json=disruption_payload)
    print(f"   Trigger status: {trigger_res.status_code}")
    assert trigger_res.status_code == 200
    trigger_data = trigger_res.json()
    assert trigger_data["event_type"] == "FLIGHT_CANCELLED"
    assert trigger_data["entity_id"] == affected_id
    assert trigger_data["event_metadata"]["reason"] == "Operational disruption"

    print("4. Verifying NO downstream item mutation (Part 2 strict rule)...")
    post_disruption_trip = requests.get(f"{BASE_URL}/trips/{trip_id}").json()
    for item in post_disruption_trip["items"]:
        # Direct items should still have status CONFIRMED in DB
        assert item["status"] == "CONFIRMED", f"Item {item['id']} status was mutated to {item['status']}!"
    print("   Confirmed: No downstream items mutated in Part 2!")

    print("5. Fetching disruption history...")
    history_res = requests.get(f"{BASE_URL}/trips/{trip_id}/disruptions")
    assert history_res.status_code == 200
    history = history_res.json()
    assert len(history) > 0
    print(f"   Disruption history count: {len(history)}")

    print("6. Resetting simulation state...")
    reset_res = requests.post(f"{BASE_URL}/trips/{trip_id}/disruptions/reset")
    assert reset_res.status_code == 200
    assert reset_res.json()["status"] == "reset"

    print("7. Verifying history cleared and trip intact...")
    cleared_history = requests.get(f"{BASE_URL}/trips/{trip_id}/disruptions").json()
    assert len(cleared_history) == 0, "Disruption history was not cleared"
    
    post_reset_trip = requests.get(f"{BASE_URL}/trips/{trip_id}").json()
    assert len(post_reset_trip["items"]) == len(items), "Original items were modified or deleted"
    print("   Confirmed: Trip items completely intact after reset!")

    print("\n[SUCCESS] All Part 2 Admin Console API & Architecture tests passed successfully!")

if __name__ == "__main__":
    test_part2_backend()
