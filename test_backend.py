import database
import main

database.init_db()
print("Testing sample load...")
res = main.load_sample()
print("Sample result:", res["message"])
routes = database.get_routes()
print(f"Total routes in DB: {len(routes)}")
if routes:
    r0 = routes[0]
    print(f"Route sample: {r0['grupo']} | {r0['ciudad1']} ({r0['provincia1']}) -> {r0['ciudad2']}")
    print(f"Coords: ({r0['lat1']}, {r0['lon1']}) -> ({r0['lat2']}, {r0['lon2']}) | Dist: {r0['distance_km']} km")
    print(f"Geometry points count: {len(r0['geometry'])}")

stats = database.get_stats()
print("Stats:", stats)
groups = database.get_groups()
print("Groups:", groups)
