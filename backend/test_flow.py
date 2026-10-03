import requests
import json
import time

BASE_URL = "http://localhost:8000/api"

# 1. Login
login_data = {"email": "shubham@example.com", "password": "password"}
try:
    res = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    res.raise_for_status()
    token = res.json()["access_token"]
    print("[SUCCESS] Login successful")
except Exception as e:
    # try registering if login fails
    print("Login failed, attempting to register...")
    res = requests.post(f"{BASE_URL}/auth/register", json={"name": "Test User", "email": "shubham@example.com", "password": "password", "phone_number": "1234567890"})
    token = res.json()["access_token"]
    print("[SUCCESS] Registration successful")

headers = {"Authorization": f"Bearer {token}"}

# 2. Get user info to get user_id
res = requests.get(f"{BASE_URL}/auth/me", headers=headers)
user_id = res.json()["id"]

# 3. Create a trip
trip_res = requests.post(f"{BASE_URL}/users/{user_id}/trips", json={"title": "Test Journey"}, headers=headers)
trip_id = trip_res.json()["id"]
print(f"[SUCCESS] Created Trip ID: {trip_id}")

# 4. Add an item
item_payload = {
    "type": "FLIGHT",
    "provider": "Indigo",
    "departure_airport": "MUM",
    "arrival_airport": "DEL",
    "flight_number": "6E-123",
    "start_time": "2026-09-27T10:00:00+05:30",
    "end_time": "2026-09-27T12:00:00+05:30",
    "status": "CONFIRMED"
}
item_res = requests.post(f"{BASE_URL}/trips/{trip_id}/items", json=item_payload, headers=headers)
item_id = item_res.json()["id"]
print(f"[SUCCESS] Added Flight Item ID: {item_id}")

# 5. Trigger Disruption
disruption_payload = {
    "item_id": item_id,
    "disruption_type": "FLIGHT_CANCELLED",
    "detected_at": "2026-09-26T12:00:00Z",
    "reason": "Operational",
    "delay_minutes": 0
}
disruption_res = requests.post(f"{BASE_URL}/trips/{trip_id}/disruptions", json=disruption_payload, headers=headers)
disruption_data = disruption_res.json()
print(f"[SUCCESS] Triggered Disruption, result length: {len(disruption_data)}")

# 6. Check Impact
impact_res = requests.get(f"{BASE_URL}/trips/{trip_id}/impact", headers=headers)
impact_data = impact_res.json()
print(f"[SUCCESS] Impact Analysis complete: {impact_data.get('overall_status')}")

# 7. Analyze Recovery
recovery_res = requests.post(f"{BASE_URL}/trips/{trip_id}/recovery/analyze", headers=headers)
recovery_data = recovery_res.json()
print(f"[SUCCESS] Recovery Analysis complete: {len(recovery_data.get('options', []))} options generated")
