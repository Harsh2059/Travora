import requests

BASE_URL = "http://localhost:8000/api"

def test_api():
    print("Testing GET /api/users/1/trips...")
    res = requests.get(f"{BASE_URL}/users/1/trips")
    print(f"User trips: {res.status_code}, {res.json()}")
    
    if not res.json():
        print("Creating trip...")
        res = requests.post(f"{BASE_URL}/users/1/trips", json={"title": "Test Journey"})
        trip_id = res.json()["id"]
    else:
        trip_id = res.json()[0]["id"]

    print(f"Active trip ID: {trip_id}")

    # Test adding item with optional start_time/end_time (e.g. Hotel)
    print("Testing POST item without start_time/end_time...")
    post_res = requests.post(
        f"{BASE_URL}/trips/{trip_id}/items",
        json={
            "type": "HOTEL",
            "provider": "Test Hotel Anand",
            "location": "Delhi",
            "start_time": None,
            "end_time": None,
            "priority": "MUST_PRESERVE"
        }
    )
    print(f"POST item status: {post_res.status_code}")
    assert post_res.status_code == 200, f"Failed: {post_res.text}"
    item_data = post_res.json()
    item_id = item_data["id"]
    print(f"Created item ID: {item_id}, start_time: {item_data['start_time']}")

    # Test PUT item
    print(f"Testing PUT item {item_id}...")
    put_res = requests.put(
        f"{BASE_URL}/trips/{trip_id}/items/{item_id}",
        json={
            "provider": "Updated Test Hotel Anand",
            "location": "New Delhi"
        }
    )
    print(f"PUT item status: {put_res.status_code}")
    assert put_res.status_code == 200, f"Failed: {put_res.text}"
    print(f"Updated item: {put_res.json()['provider']}, location: {put_res.json()['location']}")

    # Test DELETE item
    print(f"Testing DELETE item {item_id}...")
    del_res = requests.delete(f"{BASE_URL}/trips/{trip_id}/items/{item_id}")
    print(f"DELETE item status: {del_res.status_code}")
    assert del_res.status_code == 200, f"Failed: {del_res.text}"

    print("✅ All backend API edit-mode tests passed successfully!")

if __name__ == "__main__":
    test_api()
