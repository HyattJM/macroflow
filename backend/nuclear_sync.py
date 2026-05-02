import os
import django
import requests
import time

# Initialize Django environment to allow script to interact with models
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from macroflow_api.models import Exercise, MuscleGroup

# The RapidAPI authentication key used for both fetching data and authorizing image streams
API_KEY = "fbe6c90e9emsh058e413ec1bd7fap1f3ee8jsnca9b975c8d4c"
HEADERS = {
    "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
    "X-RapidAPI-Key": API_KEY,
    "Content-Type": "application/json"
}

def paginated_nuclear_sync():
    """
    Performs a full wipe and repopulation of the Exercise database using ExerciseDB (RapidAPI).
    
    Logic & Rationale:
    1. Database Purge: Deletes all existing Exercise and MuscleGroup records to ensure 
       consistency and remove any stale image URLs.
    2. Pagination: Iterates through the entire ExerciseDB catalog in batches of 100.
    3. URL Synthesis: 
       - Standard ExerciseDB API responses contain static GIF URLs which often expire 
         or require specific authentication headers that are difficult to pass in 
         standard mobile <img> tags.
       - This script synthesizes a "Live Image Service URL" using the endpoint:
         https://exercisedb.p.rapidapi.com/image?exerciseId={id}&resolution=360&rapidapi-key={key}
       - By embedding the API key and setting a resolution (360px), we ensure the 
         mobile app can stream form-guide GIFs directly without custom header injection 
         logic on the frontend.
    """
    print("🚀 Starting Nuclear Sync (Image Service Patch)...")
    
    Exercise.objects.all().delete()
    MuscleGroup.objects.all().delete()
    print("🧹 Cleaned old database records.")

    offset = 0
    limit = 100 
    total_synced = 0

    while True:
        url = f"https://exercisedb.p.rapidapi.com/exercises?limit={limit}&offset={offset}"
        print(f"📡 Fetching offset {offset}...")
        
        try:
            response = requests.get(url, headers=HEADERS, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                if not data:
                    print("🏁 Reached the end of the database.")
                    break
                    
                for item in data:
                    # Categorize by the bodyPart returned from API
                    bp_name = item.get('bodyPart', 'Other').title()
                    muscle_group, _ = MuscleGroup.objects.get_or_create(name=bp_name)
                    
                    # Synthesize the new Live Image Service URL
                    # This URL is accessible via standard HTTPS GET and allows for resolution optimization.
                    exercise_id = item.get('id')
                    live_gif_url = f"https://exercisedb.p.rapidapi.com/image?exerciseId={exercise_id}&resolution=360&rapidapi-key={API_KEY}"
                    
                    Exercise.objects.create(
                        name=item['name'].title(),
                        muscle_group=muscle_group,
                        gif_url=live_gif_url
                    )
                    total_synced += 1
                    
                offset += limit
                # Prevent rate-limiting from RapidAPI
                time.sleep(0.5)
                
            else:
                print(f"❌ Failed at offset {offset}: {response.status_code}")
                print(response.text)
                break
                
        except Exception as e:
            print(f"💥 Script Error: {e}")
            break

    print(f"\n🏆 MISSION ACCOMPLISHED! {total_synced} exercises synced with Live Image URLs.")

if __name__ == "__main__":
    paginated_nuclear_sync()