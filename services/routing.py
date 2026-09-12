import math
import time
import requests
from typing import Tuple, List, Optional
import database

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates in kilometers using Haversine formula."""
    R = 6371.0  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 1)

def generate_curved_geometry(lat1: float, lon1: float, lat2: float, lon2: float, points_count: int = 30) -> List[List[float]]:
    """Generate a subtle curved line between two coordinates (only used as last-resort fallback)."""
    coords = []
    mid_lat = (lat1 + lat2) / 2
    mid_lon = (lon1 + lon2) / 2
    dx = lon2 - lon1
    dy = lat2 - lat1
    offset_scale = 0.08
    norm = math.sqrt(dx * dx + dy * dy)
    
    if norm > 0.001:
        curve_lat = mid_lat - (dx / norm) * offset_scale * norm * 0.2
        curve_lon = mid_lon + (dy / norm) * offset_scale * norm * 0.2
    else:
        curve_lat, curve_lon = mid_lat, mid_lon

    for i in range(points_count + 1):
        t = i / float(points_count)
        lat = (1 - t) ** 2 * lat1 + 2 * (1 - t) * t * curve_lat + t ** 2 * lat2
        lon = (1 - t) ** 2 * lon1 + 2 * (1 - t) * t * curve_lon + t ** 2 * lon2
        coords.append([round(lat, 5), round(lon, 5)])
        
    return coords

def fetch_osrm_road_trajectory(lat1: float, lon1: float, lat2: float, lon2: float, retries: int = 2) -> Optional[Tuple[float, List[List[float]]]]:
    """
    Fetch exact driving road geometry from OSRM with overview=full.
    Returns (distance_km, [[lat, lon], ...]) or None if failed.
    """
    url = f"https://router.project-osrm.org/route/v1/driving/{lon1:.5f},{lat1:.5f};{lon2:.5f},{lat2:.5f}?overview=full&geometries=geojson"
    headers = {
        "User-Agent": "CredifinRoutesVisualizer/1.1 (contacto@credifin.com)",
        "Accept": "application/json"
    }

    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=headers, timeout=6.0)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok" and data.get("routes"):
                    route = data["routes"][0]
                    distance_km = round(route["distance"] / 1000.0, 1)
                    geojson_coords = route["geometry"]["coordinates"]
                    leaflet_coords = [[round(pt[1], 5), round(pt[0], 5)] for pt in geojson_coords]
                    if len(leaflet_coords) >= 2:
                        return distance_km, leaflet_coords
        except Exception:
            if attempt < retries - 1:
                time.sleep(0.4)
            pass

    return None

def calculate_route(lat1: float, lon1: float, lat2: float, lon2: float) -> Tuple[float, List[List[float]]]:
    """
    Calculate route distance and coordinates along real roads.
    1. Checks local persistent SQLite route cache (instant).
    2. If not cached, fetches exact road geometry from OSRM driving engine.
    3. Saves to cache for future requests.
    4. Last-resort fallback to direct estimate with curved geometry if network is unreachable.
    """
    # 1. Check cache first
    cached = database.get_cached_route(lat1, lon1, lat2, lon2)
    if cached:
        dist_km, geom = cached
        if geom and len(geom) >= 2:
            return dist_km, geom

    # 2. Fetch road trajectory via OSRM
    road_res = fetch_osrm_road_trajectory(lat1, lon1, lat2, lon2)
    if road_res:
        dist_km, leaflet_coords = road_res
        database.save_cached_route(lat1, lon1, lat2, lon2, dist_km, leaflet_coords)
        return dist_km, leaflet_coords

    # 3. Fallback if offline
    direct_dist = haversine_distance(lat1, lon1, lat2, lon2)
    road_dist_est = round(direct_dist * 1.18, 1)
    curve_coords = generate_curved_geometry(lat1, lon1, lat2, lon2)
    return road_dist_est, curve_coords
