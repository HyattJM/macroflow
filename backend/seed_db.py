import os
import django
import sys

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from macroflow_api.models import MuscleGroup, Exercise, User

def seed_data():
    print("Seeding database...")
    
    # Create default user if none exists
    if not User.objects.filter(id=1).exists():
        user = User.objects.create_user(username='testuser', password='password')
        user.height = 175.0
        user.daily_calorie_goal = 2500
        user.daily_protein_goal = 180
        user.daily_carbs_goal = 300
        user.daily_fat_goal = 80
        user.save()
        print("Created default user 'testuser' (ID 1)")

    # Define muscle groups and their exercises
    data = {
        "Abs": ["Crunches", "Plank", "Russian Twists", "Leg Raises", "Ab Wheel Rollout"],
        "Back": ["Deadlift", "Pull-ups", "Barbell Row", "Lat Pulldown", "Seated Cable Row"],
        "Biceps": ["Barbell Curl", "Hammer Curls", "Preacher Curl"],
        "Cardio": ["Running", "Cycling", "Rowing", "Jump Rope"],
        "Chest": ["Barbell Bench Press", "Dumbbell Flyes", "Incline Dumbbell Press", "Push-ups", "Cable Crossovers"],
        "Legs": ["Squat", "Leg Press", "Romanian Deadlift", "Leg Extension", "Calf Raises"],
        "Shoulders": ["Overhead Press", "Lateral Raises", "Front Raises", "Face Pulls", "Arnold Press"],
        "Triceps": ["Tricep Pushdown", "Skull Crushers"]
    }

    for group_name, exercises in data.items():
        group, created = MuscleGroup.objects.get_or_create(name=group_name)
        if created:
            print(f"Created Muscle Group: {group_name}")
        
        for ex_name in exercises:
            exercise, ex_created = Exercise.objects.get_or_create(name=ex_name, muscle_group=group)
            if ex_created:
                print(f"  Created Exercise: {ex_name}")

    print("Seeding complete!")

if __name__ == "__main__":
    seed_data()
