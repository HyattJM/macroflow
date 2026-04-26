import os
import django
import requests
import time
import urllib.parse
from dotenv import load_dotenv

# Initialize Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from macroflow_api.models import Exercise

# Load the RapidAPI key from your .env
load_dotenv()
API_KEY = os.environ.get('EXERCISE_DB_API_KEY')

HEADERS = {
    "X-RapidAPI-Key": API_KEY,
    "X-RapidAPI-Host": "exercisedb.p.rapidapi.com"
}

def run():
    print("🚀 Booting up ExerciseDB Fetcher...")
    exercises = Exercise.objects.all()
    
    for ex in exercises:
        # Skip if we already fetched a GIF for this exercise
        if ex.gif_url:
            continue
            
        print(f"Searching for: {ex.name}...")
        
        # Clean the name and encode it for the URL (e.g., "Barbell Curl" -> "barbell%20curl")
        search_query = urllib.parse.quote(ex.name.lower())
        url = f"https://exercisedb.p.rapidapi.com/exercises/name/{search_query}"
        
        try:
            response = requests.get(url, headers=HEADERS)
            
            if response.status_code == 200:
                data = response.json()
                
                if data and len(data) > 0:
                    # Grab the very first match's GIF URL
                    gif_link = data[0].get('gifUrl')
                    if gif_link:
                        ex.gif_url = gif_link
                        ex.save()
                        print(f"  ✅ Saved GIF: {gif_link}")
                else:
                    print(f"  ❌ No exact match found in ExerciseDB for '{ex.name}'")
            else:
                print(f"  ⚠️ API Error {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"  🚨 Request failed: {e}")
            
        # Sleep for 1.5 seconds to avoid RapidAPI rate limits (Free tier is usually strict)
        time.sleep(1.5)
        
    print("🏁 Fetch complete!")

if __name__ == '__main__':
    run()