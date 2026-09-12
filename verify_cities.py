import sqlite3

conn = sqlite3.connect('data/routes.db')
c = conn.cursor()

routes = c.execute('SELECT DISTINCT grupo, ciudad1, provincia1, ciudad2 FROM routes').fetchall()
print(f"Total distinct routes: {len(routes)}")

cities1 = set(c.execute('SELECT DISTINCT ciudad1, provincia1 FROM routes').fetchall())
print("\n--- CIUDADES 1 (con provincia) ---")
for city, prov in sorted(cities1):
    print(f"  {city} ({prov})")

cities2 = set(r[0] for r in c.execute('SELECT DISTINCT ciudad2 FROM routes').fetchall())
print("\n--- CIUDADES 2 (destino) ---")
for city in sorted(cities2):
    print(f"  {city}")
