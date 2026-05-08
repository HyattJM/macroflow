import requests
BASE_URL = 'http://127.0.0.1:8000/api/'
try:
    # Test latest weight
    r = requests.get(f'{BASE_URL}latest-weight/')
    print(f"Latest Weight Status: {r.status_code}")
    print(f"Latest Weight Response: {r.text}")

    # Test weight history (router)
    r = requests.get(f'{BASE_URL}bodyweights/')
    print(f"History Status: {r.status_code}")
    print(f"History Response: {r.text}")
except Exception as e:
    print(f"Error: {e}")
