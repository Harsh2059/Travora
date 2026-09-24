import sqlite3
conn = sqlite3.connect('backend/travel_engine.db')
cur = conn.cursor()

# Show disruption events per trip
cur.execute("SELECT id, trip_id, event_type, status FROM disruption_events ORDER BY trip_id, id")
print('Disruptions:', cur.fetchall())

# Reset all ACTIVE disruptions for Trip 1 (stale test data)
cur.execute("UPDATE disruption_events SET status='RESET' WHERE trip_id=1 AND status='ACTIVE'")
print('Reset rows:', cur.rowcount)

# Also reset items in trip 1 back to CONFIRMED (the REPLACED one)
cur.execute("UPDATE itinerary_items SET status='CONFIRMED' WHERE trip_id=1 AND status='REPLACED'")
print('Reset REPLACED items:', cur.rowcount)

conn.commit()

# Verify
cur.execute("SELECT id, trip_id, event_type, status FROM disruption_events ORDER BY trip_id, id")
print('After reset disruptions:', cur.fetchall())

cur.execute("SELECT id, trip_id, provider, status FROM itinerary_items WHERE trip_id=1")
print('Trip 1 items after reset:', cur.fetchall())

conn.close()
print('Done.')
