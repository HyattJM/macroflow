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
    print("🚀 Starting Nuclear Sync (Pagination Mode)...")
    
    # Wipe the slate clean ONE time before looping
    Exercise.objects.all().delete()
    MuscleGroup.objects.all().delete()
    print("🧹 Cleaned old database records.")

    offset = 0
    limit = 100  # Chunk size the API will actually accept
    total_synced = 0

    while True:
        # Dynamic URL that shifts the offset every loop
        url = f"https://exercisedb.p.rapidapi.com/exercises?limit={limit}&offset={offset}"
        print(f"📡 Fetching offset {offset}...")
        
        try:
            response = requests.get(url, headers=HEADERS, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                # If the API returns an empty list, we've grabbed everything
                if not data:
                    print("🏁 Reached the end of the database.")
                    break
                    
                for item in data:
                    bp_name = item.get('bodyPart', 'Other').title()
                    muscle_group, _ = MuscleGroup.objects.get_or_create(name=bp_name)
                    
                    Exercise.objects.create(
                        name=item['name'].title(),
                        muscle_group=muscle_group,
                        gif_url=item.get('gifUrl', '')
                    )
                    total_synced += 1
                    
                # Increase offset for the next loop
                offset += limit
                
                # Sleep for 0.5 seconds so RapidAPI doesn't think we are a DDoS attack
                time.sleep(0.5)
                
            else:
                print(f"❌ Failed at offset {offset}: {response.status_code}")
                print(response.text)
                break
                
        except Exception as e:
            print(f"💥 Script Error: {e}")
            break

    print(f"\n🏆 MISSION ACCOMPLISHED! {total_synced} total exercises synced with official GIFs.")

if __name__ == "__main__":
    paginated_nuclear_sync()