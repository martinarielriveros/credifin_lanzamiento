import sqlite3
import csv
import io
import requests
import unicodedata
import re

def norm(s):
    if not s:
        return ""
    s = unicodedata.normalize('NFKD', str(s)).encode('ASCII', 'ignore').decode('utf-8')
    s = s.lower()
    s = re.sub(r'[^\w\s]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def run_update():
    # 1. Download sheet data
    url = "https://docs.google.com/spreadsheets/d/10jzm2zFFNseYA6xBD9b2wRB06Iu4xLJrMHAlD9FB4jM/export?format=csv&gid=0"
    print("Fetching Google Sheet data from:", url)
    resp = requests.get(url)
    resp.raise_for_status()
    
    reader = list(csv.DictReader(io.StringIO(resp.text)))
    print(f"Read {len(reader)} rows from Google Sheet.")
    
    # Map of (norm(Origen), norm(Destino)) -> int(Total)
    sheet_data = {}
    for r in reader:
        o = norm(r.get("Origen", ""))
        d = norm(r.get("Destino", ""))
        tot_raw = r.get("Total", "0")
        try:
            tot = int(float(tot_raw.strip())) if tot_raw.strip() else 0
        except ValueError:
            tot = 0
        sheet_data[(o, d)] = tot

    print(f"Indexed {len(sheet_data)} unique (Origen, Destino) pairs from Google Sheet.")

    # 2. Connect to DB
    conn = sqlite3.connect("data/routes.db")
    cursor = conn.cursor()

    # 3. Add column total_packages if not exists
    cursor.execute("PRAGMA table_info(routes)")
    columns = [row[1] for row in cursor.fetchall()]
    if "total_packages" not in columns:
        print("Adding column 'total_packages' to routes table...")
        cursor.execute("ALTER TABLE routes ADD COLUMN total_packages INTEGER DEFAULT 0")
        conn.commit()
    else:
        print("Column 'total_packages' already exists.")

    # 4. Eliminate the sample groups: Litoral, Zona Centro, Corredor Atlantico, Cuyo Express, Norte Conectado
    groups_to_delete = [
        "Litoral", "Zona Centro", "Corredor Atlantico", "Corredor Atlántico",
        "Cuyo Express", "Cuyo Epress", "Norte Conectado"
    ]
    placeholders = ",".join("?" for _ in groups_to_delete)
    cursor.execute(f"DELETE FROM routes WHERE LOWER(TRIM(grupo)) IN ({','.join('LOWER(?)' for _ in groups_to_delete)})", groups_to_delete)
    deleted_groups = cursor.rowcount
    print(f"Deleted {deleted_groups} routes from sample groups ({', '.join(groups_to_delete)}).")
    conn.commit()

    # 5. Correct San Jorge: All San Jorge is from Santa Fe (-31.8967, -61.8603)
    # Origin = San Jorge
    cursor.execute("""
        UPDATE routes 
        SET provincia1 = 'Santa Fe', lat1 = -31.8967, lon1 = -61.8603
        WHERE LOWER(TRIM(ciudad1)) = 'san jorge'
    """)
    updated_sj_orig = cursor.rowcount

    # Destino = San Jorge
    cursor.execute("""
        UPDATE routes 
        SET lat2 = -31.8967, lon2 = -61.8603
        WHERE LOWER(TRIM(ciudad2)) = 'san jorge'
    """)
    updated_sj_dest = cursor.rowcount
    print(f"Updated San Jorge coordinates (Santa Fe -31.8967, -61.8603): {updated_sj_orig} as origin, {updated_sj_dest} as destination.")
    conn.commit()

    # 6. Update total_packages for every route in DB
    routes = cursor.execute("SELECT id, ciudad1, ciudad2, grupo FROM routes").fetchall()
    matched = 0
    unmatched = 0

    for rid, c1, c2, grp in routes:
        key = (norm(c1), norm(c2))
        if key in sheet_data:
            val = sheet_data[key]
            cursor.execute("UPDATE routes SET total_packages = ? WHERE id = ?", (val, rid))
            matched += 1
        else:
            # Check fuzzy or partial
            found = False
            for (so, sd), val in sheet_data.items():
                if (so in norm(c1) or norm(c1) in so) and (sd in norm(c2) or norm(c2) in sd):
                    cursor.execute("UPDATE routes SET total_packages = ? WHERE id = ?", (val, rid))
                    matched += 1
                    found = True
                    break
            if not found:
                cursor.execute("UPDATE routes SET total_packages = 0 WHERE id = ?", (rid,))
                unmatched += 1
                print(f"  Unmatched route: {c1} -> {c2} ({grp})")

    conn.commit()
    print(f"\nFinished updating packages: {matched} routes matched, {unmatched} unmatched.")

    # 7. Print summary statistics
    cursor.execute("SELECT COUNT(*), SUM(total_packages), COUNT(DISTINCT grupo), COUNT(DISTINCT ciudad1) FROM routes")
    tot_routes, tot_pkgs, tot_grp, tot_c1 = cursor.fetchone()
    print(f"\nFinal DB State:")
    print(f"  Total routes: {tot_routes}")
    print(f"  Total packages across routes: {tot_pkgs}")
    print(f"  Active groups: {tot_grp}")

    groups_summary = cursor.execute("SELECT grupo, COUNT(*), SUM(total_packages) FROM routes GROUP BY grupo ORDER BY grupo").fetchall()
    print("\nGroups summary:")
    for g, cnt, pkgs in groups_summary:
        print(f"  {g}: {cnt} routes, {pkgs} packages")

    # Sample routes with San Jorge
    sj_routes = cursor.execute("SELECT id, grupo, ciudad1, provincia1, ciudad2, lat1, lon1, lat2, lon2, total_packages FROM routes WHERE LOWER(ciudad1) = 'san jorge' OR LOWER(ciudad2) = 'san jorge' LIMIT 5").fetchall()
    print("\nSan Jorge routes sample:")
    for r in sj_routes:
        print(f"  #{r[0]} {r[1]}: {r[2]} ({r[3]}) -> {r[4]} | Coords: ({r[5]}, {r[6]}) -> ({r[7]}, {r[8]}) | Packages: {r[9]}")

    conn.close()

if __name__ == "__main__":
    run_update()
