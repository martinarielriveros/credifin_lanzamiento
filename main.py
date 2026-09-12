import io
import csv
import os
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, File, UploadFile, Query, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

import database
from services.geocoding import geocode_location, check_city_province_exact
from services.routing import calculate_route, haversine_distance

app = FastAPI(title="Credifin Routes Visualizer", version="1.1.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Initialize database on startup
database.init_db()

def clean_key(k: str) -> str:
    if not k:
        return ""
    import unicodedata
    norm = unicodedata.normalize('NFKD', str(k)).encode('ASCII', 'ignore').decode('utf-8').lower()
    return re.sub(r'[^a-z0-9]', '', norm)

def find_matched_key(row_dict: dict, candidates: list) -> Optional[str]:
    cleaned_map = {clean_key(k): k for k in row_dict.keys() if k}
    for c in candidates:
        clean_c = clean_key(c)
        if clean_c in cleaned_map:
            return cleaned_map[clean_c]
        for ck, orig_k in cleaned_map.items():
            if clean_c in ck or ck in clean_c:
                return orig_k
    return None

def preview_csv_content(content_str: str) -> Dict[str, Any]:
    """
    Parses CSV content and generates an inspection preview.
    Explicitly evaluates whether the EXACT combination of (Provincia-Ciudad1, Ciudad1) has been found.
    """
    if not content_str or not content_str.strip():
        return {"rows": [], "summary": {}}

    # Strip BOM
    content_str = content_str.lstrip('\ufeff').strip()
    
    # Detect delimiter
    first_line = content_str.split("\n")[0] if "\n" in content_str else content_str
    delimiter = ","
    if ";" in first_line and first_line.count(";") > first_line.count(","):
        delimiter = ";"
    elif "\t" in first_line and first_line.count("\t") > first_line.count(","):
        delimiter = "\t"
    elif "|" in first_line and first_line.count("|") > first_line.count(","):
        delimiter = "|"

    reader = csv.DictReader(io.StringIO(content_str), delimiter=delimiter)
    preview_rows = []
    
    exact_count = 0
    partial_count = 0
    not_found_count = 0
    groups_set = set()
    cities_set = set()

    for idx, row in enumerate(reader, start=1):
        clean_row = {k.strip(): (v.strip() if v else "") for k, v in row.items() if k is not None}
        if not any(clean_row.values()):
            continue

        key_grupo = find_matched_key(clean_row, ["grupo", "group", "categoria", "zona"])
        key_c1 = find_matched_key(clean_row, ["ciudad 1", "ciudad1", "origen", "city 1", "desde"])
        key_p1 = find_matched_key(clean_row, ["provincia-ciudad1", "provinciaciudad1", "provincia 1", "provincia", "prov"])
        key_c2 = find_matched_key(clean_row, ["ciudad2", "ciudad 2", "destino", "city 2", "hasta"])

        key_lat1 = find_matched_key(clean_row, ["lat1", "latitude1", "lat_origen", "latorigen"])
        key_lon1 = find_matched_key(clean_row, ["lon1", "longitude1", "lng1", "lon_origen", "lng_origen"])
        key_lat2 = find_matched_key(clean_row, ["lat2", "latitude2", "lat_destino", "latdestino"])
        key_lon2 = find_matched_key(clean_row, ["lon2", "longitude2", "lng2", "lon_destino", "lngdestino"])
        key_total = find_matched_key(clean_row, ["total", "bultos", "paquetes", "cantidad", "packages"])

        grupo = (clean_row.get(key_grupo) if key_grupo else "") or "General"
        ciudad1 = (clean_row.get(key_c1) if key_c1 else "").strip()
        provincia1 = (clean_row.get(key_p1) if key_p1 else "").strip()
        ciudad2 = (clean_row.get(key_c2) if key_c2 else "").strip()

        total_packages = 0
        if key_total and clean_row.get(key_total):
            try:
                total_packages = int(float(clean_row[key_total]))
            except ValueError:
                total_packages = 0

        # Fallback to positional if headers were unmapped
        if not ciudad1 or not ciudad2:
            vals = list(clean_row.values())
            if len(vals) >= 4:
                grupo = vals[0] or "General"
                ciudad1 = vals[1]
                provincia1 = vals[2]
                ciudad2 = vals[3]
            elif len(vals) == 3:
                grupo = "General"
                ciudad1 = vals[0]
                provincia1 = vals[1]
                ciudad2 = vals[2]

        if not ciudad1 or not ciudad2:
            continue

        groups_set.add(grupo)
        cities_set.add(ciudad1)
        cities_set.add(ciudad2)

        # Check exact combination of Provincia-Ciudad1 and Ciudad1
        exact_eval = check_city_province_exact(ciudad1, provincia1)
        lat1 = exact_eval["lat"]
        lon1 = exact_eval["lon"]

        # If user explicitly supplied coordinates in CSV, preserve them
        if key_lat1 and key_lon1 and clean_row.get(key_lat1) and clean_row.get(key_lon1):
            try:
                lat1 = float(clean_row[key_lat1])
                lon1 = float(clean_row[key_lon1])
            except ValueError:
                pass

        # Destination Ciudad 2
        lat2, lon2, disp2 = geocode_location(ciudad2)
        if key_lat2 and key_lon2 and clean_row.get(key_lat2) and clean_row.get(key_lon2):
            try:
                lat2 = float(clean_row[key_lat2])
                lon2 = float(clean_row[key_lon2])
            except ValueError:
                pass

        is_exact = exact_eval["exact_found"]
        match_type = exact_eval["match_type"]

        if is_exact:
            exact_count += 1
            status_badge = "exact"
        elif match_type in ("CITY_ONLY", "PROVINCE_MISMATCH"):
            partial_count += 1
            status_badge = "partial"
        else:
            not_found_count += 1
            status_badge = "error"

        # Fast direct/road distance estimate for preview
        dist_km = round(haversine_distance(lat1, lon1, lat2, lon2) * 1.18, 1)

        preview_rows.append({
            "row_index": idx,
            "grupo": grupo,
            "ciudad1": ciudad1,
            "provincia1": provincia1,
            "ciudad2": ciudad2,
            "total_packages": total_packages,
            "exact_combination_found": is_exact,
            "match_type": match_type,
            "match_details": exact_eval["details"],
            "status_badge": status_badge,
            "lat1": round(lat1, 5),
            "lon1": round(lon1, 5),
            "lat2": round(lat2, 5),
            "lon2": round(lon2, 5),
            "distance_km": dist_km
        })

    total = len(preview_rows)
    pct = round((exact_count / total * 100), 1) if total > 0 else 0.0

    return {
        "rows": preview_rows,
        "summary": {
            "total_rows": total,
            "exact_matches_count": exact_count,
            "partial_matches_count": partial_count,
            "not_found_count": not_found_count,
            "exact_percentage": pct,
            "groups": sorted(list(groups_set)),
            "cities_count": len(cities_set)
        }
    }

def process_csv_content(content_str: str) -> list:
    if not content_str or not content_str.strip():
        return []

    content_str = content_str.lstrip('\ufeff').strip()
    first_line = content_str.split("\n")[0] if "\n" in content_str else content_str
    delimiter = ","
    if ";" in first_line and first_line.count(";") > first_line.count(","):
        delimiter = ";"
    elif "\t" in first_line and first_line.count("\t") > first_line.count(","):
        delimiter = "\t"
    elif "|" in first_line and first_line.count("|") > first_line.count(","):
        delimiter = "|"

    reader = csv.DictReader(io.StringIO(content_str), delimiter=delimiter)
    raw_items = []

    for row in reader:
        clean_row = {k.strip(): (v.strip() if v else "") for k, v in row.items() if k is not None}
        if not any(clean_row.values()):
            continue

        key_grupo = find_matched_key(clean_row, ["grupo", "group", "categoria", "zona"])
        key_c1 = find_matched_key(clean_row, ["ciudad 1", "ciudad1", "origen", "city 1", "desde"])
        key_p1 = find_matched_key(clean_row, ["provincia-ciudad1", "provinciaciudad1", "provincia 1", "provincia", "prov"])
        key_c2 = find_matched_key(clean_row, ["ciudad2", "ciudad 2", "destino", "city 2", "hasta"])

        key_lat1 = find_matched_key(clean_row, ["lat1", "latitude1", "lat_origen", "latorigen"])
        key_lon1 = find_matched_key(clean_row, ["lon1", "longitude1", "lng1", "lon_origen", "lng_origen"])
        key_lat2 = find_matched_key(clean_row, ["lat2", "latitude2", "lat_destino", "latdestino"])
        key_lon2 = find_matched_key(clean_row, ["lon2", "longitude2", "lng2", "lon_destino", "lngdestino"])
        key_total = find_matched_key(clean_row, ["total", "bultos", "paquetes", "cantidad", "packages"])

        grupo = (clean_row.get(key_grupo) if key_grupo else "") or "General"
        ciudad1 = (clean_row.get(key_c1) if key_c1 else "").strip()
        provincia1 = (clean_row.get(key_p1) if key_p1 else "").strip()
        ciudad2 = (clean_row.get(key_c2) if key_c2 else "").strip()

        total_packages = 0
        if key_total and clean_row.get(key_total):
            try:
                total_packages = int(float(clean_row[key_total]))
            except ValueError:
                total_packages = 0

        if not ciudad1 or not ciudad2:
            vals = list(clean_row.values())
            if len(vals) >= 4:
                grupo = vals[0] or "General"
                ciudad1 = vals[1]
                provincia1 = vals[2]
                ciudad2 = vals[3]
            elif len(vals) == 3:
                grupo = "General"
                ciudad1 = vals[0]
                provincia1 = vals[1]
                ciudad2 = vals[2]

        if not ciudad1 or not ciudad2:
            continue

        lat1, lon1 = None, None
        lat2, lon2 = None, None

        if key_lat1 and key_lon1 and clean_row.get(key_lat1) and clean_row.get(key_lon1):
            try:
                lat1 = float(clean_row[key_lat1])
                lon1 = float(clean_row[key_lon1])
            except ValueError:
                pass

        if key_lat2 and key_lon2 and clean_row.get(key_lat2) and clean_row.get(key_lon2):
            try:
                lat2 = float(clean_row[key_lat2])
                lon2 = float(clean_row[key_lon2])
            except ValueError:
                pass

        # Check exact combination or geocode
        if lat1 is None or lon1 is None:
            exact_res = check_city_province_exact(ciudad1, provincia1)
            lat1, lon1 = exact_res["lat"], exact_res["lon"]

        if lat2 is None or lon2 is None:
            lat2, lon2, _ = geocode_location(ciudad2)

        raw_items.append({
            "grupo": grupo,
            "ciudad1": ciudad1,
            "provincia1": provincia1,
            "ciudad2": ciudad2,
            "lat1": lat1,
            "lon1": lon1,
            "lat2": lat2,
            "lon2": lon2,
            "total_packages": total_packages
        })

    def resolve_item(item):
        dist_km, geometry = calculate_route(item["lat1"], item["lon1"], item["lat2"], item["lon2"])
        return {
            "grupo": item["grupo"],
            "ciudad1": item["ciudad1"],
            "provincia1": item["provincia1"],
            "ciudad2": item["ciudad2"],
            "lat1": item["lat1"],
            "lon1": item["lon1"],
            "lat2": item["lat2"],
            "lon2": item["lon2"],
            "distance_km": dist_km,
            "geometry": geometry,
            "total_packages": item.get("total_packages", 0)
        }

    with ThreadPoolExecutor(max_workers=6) as executor:
        processed_routes = list(executor.map(resolve_item, raw_items))

    return processed_routes

@app.post("/api/preview")
async def preview_csv(file: UploadFile = File(...)):
    """
    Parses CSV and returns a rich preview for user inspection BEFORE pinpointing/inserting into map.
    Includes exact match verification for (Provincia-Ciudad1, Ciudad1).
    """
    try:
        raw_bytes = await file.read()
        try:
            content_str = raw_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            try:
                content_str = raw_bytes.decode("latin-1")
            except UnicodeDecodeError:
                content_str = raw_bytes.decode("cp1252", errors="replace")

        result = preview_csv_content(content_str)
        if not result["rows"]:
            raise HTTPException(
                status_code=400,
                detail="No se encontraron rutas válidas en el CSV. Verifica que contenga las columnas: Grupo, Ciudad 1, Provincia-Ciudad1, Ciudad2."
            )

        return {
            "success": True,
            "filename": file.filename,
            "rows": result["rows"],
            "summary": result["summary"]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar la previsualización del CSV: {str(e)}")

@app.get("/api/routes")
def get_routes(grupo: Optional[str] = Query(None)):
    routes = database.get_routes(grupo)
    return {"routes": routes, "count": len(routes)}

@app.get("/api/groups")
def get_groups():
    groups = database.get_groups()
    return {"groups": groups}

@app.get("/api/stats")
def get_stats():
    stats = database.get_stats()
    return stats

@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...), mode: Optional[str] = Query("replace")):
    try:
        raw_bytes = await file.read()
        try:
            content_str = raw_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            try:
                content_str = raw_bytes.decode("latin-1")
            except UnicodeDecodeError:
                content_str = raw_bytes.decode("cp1252", errors="replace")

        routes = process_csv_content(content_str)
        if not routes:
            raise HTTPException(
                status_code=400,
                detail="No se encontraron rutas válidas. Verifica que el CSV contenga las columnas: Grupo, Ciudad 1, Provincia-Ciudad1, Ciudad2."
            )

        if mode == "replace":
            database.clear_routes()

        inserted_count = database.insert_routes_bulk(routes)
        stats = database.get_stats()
        groups = database.get_groups()

        return {
            "success": True,
            "message": f"Se importaron {inserted_count} rutas exitosamente.",
            "inserted": inserted_count,
            "stats": stats,
            "groups": groups
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar el archivo: {str(e)}")

@app.post("/api/sample")
def load_sample():
    sample_path = os.path.join(os.path.dirname(__file__), "sample_routes.csv")
    if not os.path.exists(sample_path):
        raise HTTPException(status_code=404, detail="Archivo de muestra no encontrado.")

    with open(sample_path, "r", encoding="utf-8") as f:
        content = f.read()

    routes = process_csv_content(content)
    inserted = database.insert_routes_bulk(routes)
    return {
        "success": True,
        "message": f"Se cargaron {inserted} rutas de ejemplo.",
        "inserted": inserted,
        "stats": database.get_stats(),
        "groups": database.get_groups()
    }

@app.delete("/api/routes")
def clear_all_routes():
    database.clear_routes()
    return {"success": True, "message": "Todas las rutas han sido eliminadas."}

@app.get("/api/download-template")
def download_template():
    sample_path = os.path.join(os.path.dirname(__file__), "sample_routes.csv")
    return FileResponse(
        sample_path,
        media_type="text/csv",
        filename="plantilla_rutas_credifin.csv"
    )

@app.post("/api/sync-google-sheet")
def sync_google_sheet(sheet_url: Optional[str] = Query(None)):
    """
    Downloads Google Sheet ("Desagregado" tab), extracts 'Total' (column G / packages),
    and updates each matching pair (ciudad1, ciudad2) in SQLite.
    """
    import requests
    import unicodedata

    url = sheet_url or "https://docs.google.com/spreadsheets/d/10jzm2zFFNseYA6xBD9b2wRB06Iu4xLJrMHAlD9FB4jM/export?format=csv&gid=0"
    if "/edit" in url:
        match = re.search(r"/d/([a-zA-Z0-9-_]+)", url)
        if match:
            sheet_id = match.group(1)
            gid_match = re.search(r"gid=([0-9]+)", url)
            gid = gid_match.group(1) if gid_match else "0"
            url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"

    try:
        resp = requests.get(url, timeout=12)
        resp.raise_for_status()

        def nrm(s):
            if not s:
                return ""
            norm_str = unicodedata.normalize('NFKD', str(s)).encode('ASCII', 'ignore').decode('utf-8').lower()
            norm_str = re.sub(r'[^\w\s]', ' ', norm_str)
            return re.sub(r'\s+', ' ', norm_str).strip()

        reader = list(csv.DictReader(io.StringIO(resp.text)))
        sheet_data = {}
        for r in reader:
            o = nrm(r.get("Origen") or r.get("Ciudad 1") or r.get("Ciudad1") or "")
            d = nrm(r.get("Destino") or r.get("Ciudad2") or r.get("Ciudad 2") or "")
            tot_raw = r.get("Total") or r.get("total") or r.get("Bultos") or "0"
            try:
                tot = int(float(str(tot_raw).strip())) if str(tot_raw).strip() else 0
            except ValueError:
                tot = 0
            if o and d:
                sheet_data[(o, d)] = tot

        conn = database.get_db()
        cursor = conn.cursor()
        routes = cursor.execute("SELECT id, ciudad1, ciudad2 FROM routes").fetchall()
        updated_count = 0
        for r in routes:
            rid = r["id"]
            c1 = nrm(r["ciudad1"])
            c2 = nrm(r["ciudad2"])
            if (c1, c2) in sheet_data:
                cursor.execute("UPDATE routes SET total_packages = ? WHERE id = ?", (sheet_data[(c1, c2)], rid))
                updated_count += 1
            else:
                for (so, sd), val in sheet_data.items():
                    if (so in c1 or c1 in so) and (sd in c2 or c2 in sd):
                        cursor.execute("UPDATE routes SET total_packages = ? WHERE id = ?", (val, rid))
                        updated_count += 1
                        break

        conn.commit()
        conn.close()

        stats = database.get_stats()
        groups = database.get_groups()

        return {
            "success": True,
            "message": f"Se sincronizaron los valores de {updated_count} rutas desde la planilla Google Drive.",
            "updated_count": updated_count,
            "stats": stats,
            "groups": groups
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al sincronizar planilla: {str(e)}")

# Mount static folder
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def serve_index():
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "Credifin Routes Visualizer API is active. Frontend static files pending."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
