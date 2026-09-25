import requests
import json

base_url = "https://travora-dqgn.onrender.com/api"
trip_id = 1

print("--- POST /api/trips/1/disruptions/reset ---")
requests.post(f"{base_url}/trips/{trip_id}/disruptions/reset")

print("\n--- POST /api/trips/1/disruptions ---")
payload = {
  "type": "FLIGHT_CANCELLED",
  "affected_node_id": 7,
  "reason": "Test flight cancellation"
}
r1 = requests.post(f"{base_url}/trips/{trip_id}/disruptions", json=payload)
print(json.dumps(r1.json(), indent=2))

print("\n--- GET /api/trips/1/impact ---")
r2 = requests.get(f"{base_url}/trips/{trip_id}/impact")
print(json.dumps(r2.json(), indent=2))

print("\n--- POST /api/trips/1/recovery/options ---")
r3 = requests.post(f"{base_url}/trips/{trip_id}/recovery/options", json={})
print(json.dumps(r3.json(), indent=2))
