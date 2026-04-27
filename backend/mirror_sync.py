import os
import django
import requests

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from macroflow_api.models import Exercise, MuscleGroup

def final_mirror_sync():
    # This is a verified active mirror as of today
    url = "https://raw.githubusercontent.com/h-abbasi/exercise-db/master/dist/exercises.json"
    
    print("🚀 Attempting Final Sync from Abbasi mirror...")
    
    try:
        # Adding a User-Agent so GitHub doesn't think we're a bot and block us
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers)
        
        if response.status_code != 200:
            print(f"❌ Failed to reach mirror. Status: {response.status_code}")
            return

        data = response.json()
        
        print(f"📦 Found {len(data)} exercises. Starting population...")

        Exercise.objects.all().delete()
        MuscleGroup.objects.all().delete()

        count = 0
        for item in data:
            name = item.get('name', '').title()
            body_part = item.get('bodyPart', 'Other').title()
            gif = item.get('gifUrl', '')

            if name and gif:
                muscle_group, _ = MuscleGroup.objects.get_or_create(name=body_part)
                Exercise.objects.create(
                    name=name,
                    muscle_group=muscle_group,
                    gif_url=gif
                )
                count += 1
                # Print every 50th so we know it's working without flooding the screen
                if count % 50 == 0:
                    print(f"  ✅ Synced {count} exercises...")

        print(f"\n🏆 VICTORY! {count} exercises with GIFs are now in your database.")
        
    except Exception as e:
        print(f"💥 Fatal Error: {e}")

if __name__ == "__main__":
    final_mirror_sync()