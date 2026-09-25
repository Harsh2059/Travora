import requests
import json

base_url = "https://travora-dqgn.onrender.com/api"
user_id = 1

try:
    # Get all trips
    r = requests.get(f"{base_url}/users/{user_id}/trips")
    trips = r.json()
    for trip in trips:
        trip_id = trip['id']
        print(f"Checking trip {trip_id}: {trip['title']}")
        
        # Reset disruptions for this trip
        r_reset = requests.post(f"{base_url}/trips/{trip_id}/disruptions/reset")
        if r_reset.status_code == 200:
            print(f" -> Cleared disruptions for trip {trip_id}")
        else:
            print(f" -> Failed to clear disruptions for trip {trip_id}: {r_reset.status_code}")
except Exception as e:
    print(f"Error: {e}")
