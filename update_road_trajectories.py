import sqlite3
import json
import time
from concurrent.futures import ThreadPoolExecutor
from services.routing import calculate_route

def update_all_routes():
    conn = sqlite3.connect('data/routes.db')
    cursor = conn.cursor()
    
    routes = cursor.execute("SELECT id, grupo, ciudad1, ciudad2, lat1, lon1, lat2, lon2, geometry_json FROM routes").fetchall()
    print(f"Total routes in database: {len(routes)}")
    
    # Collect unique coordinate pairs to minimize routing calls
    unique_pairs = {}
    for r in routes:
        rid, grupo, c1, c2, lat1, lon1, lat2, lon2, gjson = r
        key = (round(lat1, 4), round(lon1, 4), round(lat2, 4), round(lon2, 4))
        if key not in unique_pairs:
            unique_pairs[key] = (lat1, lon1, lat2, lon2, c1, c2)
            
    print(f"Unique coordinate pairs to resolve: {len(unique_pairs)}")
    
    resolved_pairs = {}
    
    def process_pair(item):
        key, (lat1, lon1, lat2, lon2, c1, c2) = item
        try:
            dist_km, geom = calculate_route(lat1, lon1, lat2, lon2)
            return key, dist_km, geom, f"{c1} -> {c2}"
        except Exception as e:
            print(f"Error resolving {c1} -> {c2}: {e}")
            return key, 0, [], f"{c1} -> {c2}"

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=5) as executor:
        for idx, (key, dist_km, geom, label) in enumerate(executor.map(process_pair, unique_pairs.items()), 1):
            resolved_pairs[key] = (dist_km, geom)
            if idx % 10 == 0 or idx == len(unique_pairs):
                print(f"  Processed {idx}/{len(unique_pairs)} pairs ({round(time.time() - t0, 1)}s) - last: {label} ({len(geom)} road points)")

    # Update database
    updated_count = 0
    for r in routes:
        rid, grupo, c1, c2, lat1, lon1, lat2, lon2, gjson = r
        key = (round(lat1, 4), round(lon1, 4), round(lat2, 4), round(lon2, 4))
        if key in resolved_pairs:
            dist_km, geom = resolved_pairs[key]
            if geom and len(geom) > 1:
                cursor.execute("""
                UPDATE routes
                SET distance_km = ?, geometry_json = ?
                WHERE id = ?
                """, (dist_km, json.dumps(geom), rid))
                updated_count += 1

    conn.commit()
    conn.close()
    print(f"\nSuccessfully updated {updated_count} routes with real road trajectories in {round(time.time() - t0, 1)}s!")

if __name__ == "__main__":
    update_all_routes()
