import sqlite3
conn = sqlite3.connect('backend/travel_engine.db')
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
print('Tables:', cur.fetchall())
cur.execute("SELECT id, trip_id, provider, type, status FROM itinerary_items ORDER BY trip_id, id")
items = cur.fetchall()
print('ITEMS count by trip:')
from collections import Counter
c = Counter(i[1] for i in items)
print(c)
for item in items:
    print(item)
conn.close()
