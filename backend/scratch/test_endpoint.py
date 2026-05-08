import requests
try:
    r = requests.post('http://127.0.0.1:8000/api/weight-log/', json={'weight': 180})
    print(f"Status: {r.status_code}")
    print(f"Response: {r.text}")
except Exception as e:
    print(f"Error: {e}")
