import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from macroflow_api.models import Exercise, MuscleGroup

def local_sync():
    file_path = "exercises_dump.json"
    
    if not os.path.exists(file_path):
        print(f"❌ Error: {file_path} not found! Make sure you created the file.")
        return

    print(f"🚀 Syncing from local file: {file_path}...")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
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

        print(f"\n🏆 OFFLINE VICTORY! {count} exercises with GIFs are now in your database.")
        
    except Exception as e:
        print(f"💥 Fatal Error: {e}")

if __name__ == "__main__":
    local_sync()