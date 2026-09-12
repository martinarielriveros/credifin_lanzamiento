import sqlite3
import os
import json
from typing import List, Dict, Any, Optional

DB_DIR = os.path.join(os.path.dirname(__file__), "data")
DB_PATH = os.path.join(DB_DIR, "routes.db")

def init_db():
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grupo TEXT NOT NULL,
        ciudad1 TEXT NOT NULL,
        provincia1 TEXT,
        ciudad2 TEXT NOT NULL,
        lat1 REAL NOT NULL,
        lon1 REAL NOT NULL,
        lat2 REAL NOT NULL,
        lon2 REAL NOT NULL,
        distance_km REAL DEFAULT 0,
        geometry_json TEXT,
        total_packages INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Migration: ensure total_packages exists in existing table
    cursor.execute("PRAGMA table_info(routes)")
    columns = [row[1] for row in cursor.fetchall()]
    if "total_packages" not in columns:
        cursor.execute("ALTER TABLE routes ADD COLUMN total_packages INTEGER DEFAULT 0")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS geocache (
        query TEXT PRIMARY KEY,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        display_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS route_geometry_cache (
        cache_key TEXT PRIMARY KEY,
        distance_km REAL NOT NULL,
        geometry_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    conn.close()

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def insert_routes_bulk(routes: List[Dict[str, Any]]) -> int:
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    
    inserted = 0
    for r in routes:
        geometry_str = json.dumps(r.get("geometry", []))
        total_pkgs = int(r.get("total_packages", 0) or 0)
        cursor.execute("""
        INSERT INTO routes (grupo, ciudad1, provincia1, ciudad2, lat1, lon1, lat2, lon2, distance_km, geometry_json, total_packages)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            r.get("grupo", "General").strip(),
            r.get("ciudad1", "").strip(),
            r.get("provincia1", "").strip(),
            r.get("ciudad2", "").strip(),
            float(r.get("lat1", 0)),
            float(r.get("lon1", 0)),
            float(r.get("lat2", 0)),
            float(r.get("lon2", 0)),
            round(float(r.get("distance_km", 0)), 1),
            geometry_str,
            total_pkgs
        ))
        inserted += 1
        
    conn.commit()
    conn.close()
    return inserted

def get_routes(grupo: Optional[str] = None) -> List[Dict[str, Any]]:
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    
    if grupo and grupo.strip().lower() != "all":
        cursor.execute("SELECT * FROM routes WHERE grupo = ? ORDER BY id DESC", (grupo.strip(),))
    else:
        cursor.execute("SELECT * FROM routes ORDER BY id DESC")
        
    rows = cursor.fetchall()
    result = []
    for row in rows:
        item = dict(row)
        if item.get("geometry_json"):
            try:
                item["geometry"] = json.loads(item["geometry_json"])
            except Exception:
                item["geometry"] = []
        else:
            item["geometry"] = []
        del item["geometry_json"]
        result.append(item)
        
    conn.close()
    return result

def get_groups() -> List[Dict[str, Any]]:
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT grupo, COUNT(*) as count, COALESCE(SUM(total_packages), 0) as total_packages
    FROM routes 
    GROUP BY grupo 
    ORDER BY count DESC, grupo ASC
    """)
    groups = [{"grupo": row["grupo"], "count": row["count"], "total_packages": row["total_packages"]} for row in cursor.fetchall()]
    conn.close()
    return groups

def get_stats() -> Dict[str, Any]:
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM routes")
    total_routes = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(DISTINCT grupo) FROM routes")
    total_groups = cursor.fetchone()[0]
    
    cursor.execute("""
    SELECT COUNT(DISTINCT city) FROM (
        SELECT LOWER(TRIM(ciudad1)) AS city FROM routes
        UNION
        SELECT LOWER(TRIM(ciudad2)) AS city FROM routes
    )
    """)
    total_cities = cursor.fetchone()[0]
    
    cursor.execute("SELECT COALESCE(SUM(distance_km), 0) FROM routes")
    total_km = round(cursor.fetchone()[0], 1)

    cursor.execute("SELECT COALESCE(SUM(total_packages), 0) FROM routes")
    total_packages = int(cursor.fetchone()[0])
    
    conn.close()
    return {
        "total_routes": total_routes,
        "total_groups": total_groups,
        "total_cities": total_cities,
        "total_km": total_km,
        "total_packages": total_packages
    }

def get_cached_route(lat1: float, lon1: float, lat2: float, lon2: float) -> Optional[tuple]:
    k1 = f"{round(lat1, 4):.4f},{round(lon1, 4):.4f}_{round(lat2, 4):.4f},{round(lon2, 4):.4f}"
    k_rev = f"{round(lat2, 4):.4f},{round(lon2, 4):.4f}_{round(lat1, 4):.4f},{round(lon1, 4):.4f}"
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT distance_km, geometry_json FROM route_geometry_cache WHERE cache_key = ?", (k1,))
    row = cursor.fetchone()
    if row:
        conn.close()
        try:
            return row["distance_km"], json.loads(row["geometry_json"])
        except Exception:
            pass
    cursor.execute("SELECT distance_km, geometry_json FROM route_geometry_cache WHERE cache_key = ?", (k_rev,))
    row_rev = cursor.fetchone()
    conn.close()
    if row_rev:
        try:
            coords = json.loads(row_rev["geometry_json"])
            return row_rev["distance_km"], list(reversed(coords))
        except Exception:
            pass
    return None

def save_cached_route(lat1: float, lon1: float, lat2: float, lon2: float, distance_km: float, geometry: list):
    k1 = f"{round(lat1, 4):.4f},{round(lon1, 4):.4f}_{round(lat2, 4):.4f},{round(lon2, 4):.4f}"
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT OR REPLACE INTO route_geometry_cache (cache_key, distance_km, geometry_json)
    VALUES (?, ?, ?)
    """, (k1, distance_km, json.dumps(geometry)))
    conn.commit()
    conn.close()

def clear_routes():
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM routes")
    conn.commit()
    conn.close()

def get_cached_geo(query: str) -> Optional[Dict[str, Any]]:
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT lat, lon, display_name FROM geocache WHERE LOWER(query) = LOWER(?)", (query.strip(),))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"lat": row["lat"], "lon": row["lon"], "display_name": row["display_name"]}
    return None

def save_cached_geo(query: str, lat: float, lon: float, display_name: str = ""):
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT OR REPLACE INTO geocache (query, lat, lon, display_name)
    VALUES (?, ?, ?, ?)
    """, (query.strip().lower(), lat, lon, display_name))
    conn.commit()
    conn.close()
