import os
import django
import requests
import time

# Boot up Django's ORM so we can talk to the database
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from macroflow_api.models import Exercise

API_KEY = "c8fe2825c2msh01b9292333693d4p1369b8jsn2c942e5e0439"
HEADERS = {
    "x-api-host": "exercisedb.p.rapidapi.com",
    "x-api-key": API_KEY
}

# Find all exercises that are missing a GIF
missing = Exercise.objects.filter(gif_url__isnull=True) | Exercise.objects.filter(gif_url="")

print(f"\n🚀 Starting Fuzzy Matcher for {missing.count()} missing exercises...\n")

for ex in missing:
    # We try the exact name first. If that fails, we strip it down to the last two words (the core movement)
    search_terms = [
        ex.name.lower(),
        " ".join(ex.name.lower().replace("-", " ").split()[-2:]) 
    ]

    found = False
    for term in search_terms:
        if found: 
            break

        print(f"Searching RapidAPI for: '{term}' (Original: {ex.name})")
        url = f"https://exercisedb.p.rapidapi.com/exercises/name/{term.replace(' ', '%20')}?limit=10"

        response = requests.get(url, headers=HEADERS)

        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                # Grab the very first GIF from the fuzzy search results
                best_match = data[0]['gifUrl']
                ex.gif_url = best_match
                ex.save()
                print(f"  ✅ MATCHED & SAVED! -> {best_match}")
                found = True
        elif response.status_code == 429:
            print("  ⚠️ Rate Limit Hit! Sleeping for 60 seconds...")
            time.sleep(60)

        # Sleep for 1.5 seconds between calls to avoid pissing off the RapidAPI rate limiter
        time.sleep(1.5)

    if not found:
        print(f"  ❌ Completely failed to find any match for: {ex.name}")

print("\n🏁 Fuzzy fetching complete! Refresh your Django Admin.")