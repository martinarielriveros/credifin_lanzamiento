import sqlite3

conn = sqlite3.connect('data/routes.db')
c = conn.cursor()

# Find San Jorge in routes
routes = c.execute("SELECT id, grupo, ciudad1, provincia1, ciudad2, lat1, lon1, lat2, lon2, distance_km FROM routes WHERE LOWER(ciudad1) LIKE '%san jorge%' OR LOWER(ciudad2) LIKE '%san jorge%'").fetchall()
print(f"Found {len(routes)} routes with San Jorge in routes table:")
for r in routes:
    print(" ", r)

# Geocache
geos = c.execute("SELECT * FROM geocache WHERE LOWER(query) LIKE '%san jorge%'").fetchall()
print(f"\nFound {len(geos)} entries in geocache:")
for g in geos:
    print(" ", g)

# Groups to delete
groups_to_delete = ['Litoral', 'Zona Centro', 'Corredor Atlantico', 'Cuyo Express', 'Cuyo Epress', 'Norte Conectado']
group_placeholders = ','.join('?' for _ in groups_to_delete)
routes_to_del = c.execute(f"SELECT id, grupo, ciudad1, ciudad2 FROM routes WHERE grupo IN ({group_placeholders})", groups_to_delete).fetchall()
print(f"\nFound {len(routes_to_del)} routes belonging to groups to eliminate:")
for r in routes_to_del[:10]:
    print(" ", r)
print(f"  ... total {len(routes_to_del)}")

conn.close()
