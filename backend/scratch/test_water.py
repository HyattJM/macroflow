import requests
BASE_URL = 'http://127.0.0.1:8000/api/'
try:
    # Test today's water
    r = requests.get(f'{BASE_URL}water/today/')
    print(f"Today Water Status: {r.status_code}")
    print(f"Today Water Response: {r.text}")

    # Test adding water
    r = requests.post(f'{BASE_URL}water/add/', json={'amount': 8})
    print(f"Add Water Status: {r.status_code}")
    print(f"Add Water Response: {r.text}")
except Exception as e:
    print(f"Error: {e}")
