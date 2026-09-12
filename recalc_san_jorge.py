import sqlite3
import json
from services.routing import calculate_route

conn = sqlite3.connect("data/routes.db")
cursor = conn.cursor()

routes = cursor.execute("""
    SELECT id, ciudad1, ciudad2, lat1, lon1, lat2, lon2 
    FROM routes 
    WHERE LOWER(ciudad1) = 'san jorge' OR LOWER(ciudad2) = 'san jorge'
""").fetchall()

print(f"Recalculating road geometry for {len(routes)} San Jorge routes...")
for rid, c1, c2, lat1, lon1, lat2, lon2 in routes:
    dist_km, geom = calculate_route(lat1, lon1, lat2, lon2)
    cursor.execute("""
        UPDATE routes 
        SET distance_km = ?, geometry_json = ? 
        WHERE id = ?
    """, (dist_km, json.dumps(geom), rid))
    print(f"  Updated #{rid} {c1} -> {c2}: {dist_km} km ({len(geom)} road points)")

conn.commit()
conn.close()
print("San Jorge road trajectories updated successfully!")
