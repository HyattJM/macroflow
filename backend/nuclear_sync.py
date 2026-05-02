import os
import django
import requests
import time

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from macroflow_api.models import Exercise, MuscleGroup

# The golden key
API_KEY = "fbe6c90e9emsh058e413ec1bd7fap1f3ee8jsnca9b975c8d4c"
HEADERS = {
    "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
    "X-RapidAPI-Key": API_KEY,
    "Content-Type": "application/json"
}

def paginated_nuclear_sync():
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
                    bp_name = item.get('bodyPart', 'Other').title()
                    muscle_group, _ = MuscleGroup.objects.get_or_create(name=bp_name)
                    
                    # Synthesize the new Live Image Service URL
                    exercise_id = item.get('id')
                    live_gif_url = f"https://exercisedb.p.rapidapi.com/image?exerciseId={exercise_id}&resolution=360&rapidapi-key={API_KEY}"
                    
                    Exercise.objects.create(
                        name=item['name'].title(),
                        muscle_group=muscle_group,
                        gif_url=live_gif_url
                    )
                    total_synced += 1
                    
                offset += limit
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