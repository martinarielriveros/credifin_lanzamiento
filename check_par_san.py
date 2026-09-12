import sqlite3

conn = sqlite3.connect("data/routes.db")
c = conn.cursor()

routes = c.execute("""
    SELECT id, grupo, ciudad1, provincia1, ciudad2, total_packages, lat1, lon1, lat2, lon2 
    FROM routes 
    WHERE (LOWER(ciudad1) LIKE 'par%' AND LOWER(ciudad2) LIKE 'san%') 
       OR (LOWER(ciudad1) LIKE 'san%' AND LOWER(ciudad2) LIKE 'par%')
""").fetchall()

print(f"Total matching routes: {len(routes)}")
for r in routes:
    print(f"ID #{r[0]} | Grupo: {r[1]} | {r[2]} ({r[3]}) -> {r[4]} | Total: {r[5]}")

conn.close()
