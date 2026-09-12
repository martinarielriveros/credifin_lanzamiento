import requests

# Test 1: Upload sample_routes.csv
with open("sample_routes.csv", "rb") as f:
    files = {"file": ("sample_routes.csv", f, "text/csv")}
    resp = requests.post("http://127.0.0.1:8000/api/upload?mode=replace", files=files)
    print("Upload Response Code:", resp.status_code)
    print("Upload Response JSON:", resp.json())

# Test 2: Upload CSV with different column formatting and uppercase .CSV
custom_csv = """GRUPO;Ciudad 1;Provincia-Ciudad1;Ciudad2
Zona Austral;Ushuaia;Tierra del Fuego;Rio Gallegos
Zona Austral;Rio Gallegos;Santa Cruz;Comodoro Rivadavia
"""
files2 = {"file": ("CUSTOM_ROUTES.CSV", custom_csv.encode("utf-8"), "text/csv")}
resp2 = requests.post("http://127.0.0.1:8000/api/upload?mode=append", files=files2)
print("\nCustom Semicolon CSV Response Code:", resp2.status_code)
print("Custom Semicolon CSV Response JSON:", resp2.json())

# Check total routes in DB now
routes_resp = requests.get("http://127.0.0.1:8000/api/routes")
print("\nTotal Routes in DB:", routes_resp.json().get("count"))
