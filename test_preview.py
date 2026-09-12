import requests

print("Testing /api/preview with sample_routes.csv...")
with open("sample_routes.csv", "rb") as f:
    files = {"file": ("sample_routes.csv", f, "text/csv")}
    resp = requests.post("http://127.0.0.1:8000/api/preview", files=files)
    print("Status code:", resp.status_code)
    data = resp.json()
    print("Summary:", data.get("summary"))
    rows = data.get("rows", [])
    print(f"Total preview rows: {len(rows)}")
    if rows:
        print("\nFirst 3 rows:")
        for r in rows[:3]:
            print(f"  #{r['row_index']} {r['grupo']} | {r['ciudad1']} ({r['provincia1']}) -> {r['ciudad2']} | Exact: {r['exact_combination_found']} ({r['match_type']}) | Dist: {r['distance_km']} km")

# Test custom CSV with mismatched province and unknown city
custom_csv = """Grupo,Ciudad 1,Provincia-Ciudad1,Ciudad2
TestGroup,Rosario,Cordoba,Santa Fe
TestGroup,Cordoba,Cordoba,Rosario
TestGroup,CiudadInexistente123,ProvinciaFicticia,Cordoba
"""

print("\nTesting /api/preview with custom CSV (including mismatched province & ficticious city)...")
files2 = {"file": ("test_custom.csv", custom_csv.encode("utf-8"), "text/csv")}
resp2 = requests.post("http://127.0.0.1:8000/api/preview", files=files2)
print("Status code:", resp2.status_code)
data2 = resp2.json()
print("Custom Summary:", data2.get("summary"))
for r in data2.get("rows", []):
    print(f"  #{r['row_index']} {r['ciudad1']} ({r['provincia1']}) -> Exact: {r['exact_combination_found']} | Badge: {r['status_badge']} | Details: {r['match_details']}")
