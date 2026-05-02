"""
Migration script to seed the database with a curated list of exercises.

This script maps exercises to their respective muscle groups and performs 
a batch injection into the Django database. It prevents duplicates by 
using get_or_create.
"""

from macroflow_api.models import Exercise, MuscleGroup

# The translated frontend database
FRONTEND_DB = [
    { "category": "Abs", "exercises": ["Ab-Wheel Rollout", "Cable Crunch", "Crunch", "Crunch Machine", "Decline Crunch", "Dragon Flag", "Hanging Knee Raise", "Hanging Leg Raise", "Plank", "Side Plank"] },
    { "category": "Back", "exercises": ["Barbell Row", "Barbell Shrug", "Chin Up", "Deadlift", "Dumbbell Row", "Good Morning", "Hammer Strength Row", "Lat Pulldown", "Lat Pullover", "Machine Shrug", "Neutral Chin Up", "Pendlay Row", "Pull Up", "Rack Pull", "Seated Cable Row", "Straight-Arm Cable Pushdown", "T-Bar Row", "Upright Row"] },
    { "category": "Biceps", "exercises": ["Barbell Curl", "Cable Curl", "Dumbbell Concentration Curl", "Dumbbell Curl", "Dumbbell Hammer Curl", "Dumbbell Preacher Curl", "EZ-Bar Curl", "EZ-Bar Preacher Curl", "Seated Incline Dumbbell Curl", "Seated Machine Curl"] },
    { "category": "Cardio", "exercises": ["Cycling", "Elliptical Trainer", "Rowing Machine", "Running (Outdoor)", "Running (Treadmill)", "Stationary Bike", "Swimming", "Walking"] },
    { "category": "Chest", "exercises": ["Cable Crossover", "Decline Barbell Bench Press", "Decline Hammer Strength Chest Press", "Flat Barbell Bench Press", "Flat Dumbbell Bench Press", "Flat Dumbbell Fly", "Incline Barbell Bench Press", "Incline Dumbbell Bench Press", "Incline Dumbbell Fly", "Incline Hammer Strength Chest Press", "Seated Machine Fly"] },
    { "category": "Legs", "exercises": ["Barbell Calf Raise", "Barbell Front Squat", "Barbell Glute Bridge", "Barbell Squat", "Donkey Calf Raise", "Glute-Ham Raise", "Hack Squat Machine", "Leg Extension Machine", "Leg Press", "Lying Leg Curl Machine", "Romanian Deadlift", "Seated Calf Raise Machine", "Seated Leg Curl Machine", "Standing Calf Raise Machine", "Stiff-Legged Deadlift", "Sumo Deadlift"] },
    { "category": "Shoulders", "exercises": ["Arnold Dumbbell Press", "Behind The Neck Barbell Press", "Cable Face Pull", "Front Dumbbell Raise", "Hammer Strength Shoulder Press", "Lateral Dumbbell Raise", "Lateral Machine Raise", "Log Press", "One-Arm Standing Dumbbell Press", "Overhead Press", "Push Press", "Rear Delt Dumbbell Raise", "Rear Delt Machine Fly", "Seated Dumbbell Lateral Raise", "Seated Dumbbell Press", "Smith Machine Overhead Press"] },
    { "category": "Triceps", "exercises": ["Cable Overhead Triceps Extension", "Close Grip Barbell Bench Press", "Dumbbell Overhead Triceps Extension", "EZ-Bar Skullcrusher", "Lying Triceps Extension", "Parallel Bar Triceps Dip", "Ring Dip", "Rope Push Down", "Smith Machine Close Grip Bench Press", "Triceps Press Nautilus"] }
]

def run_migration():
    """Executes the exercise migration logic."""
    added_count = 0

    print("\n🚀 Starting the Great Migration...\n")

    for group in FRONTEND_DB:
        category_name = group["category"]
        
        # 1. Safely grab or create the Muscle Group first
        muscle_group, _ = MuscleGroup.objects.get_or_create(name=category_name)

        for ex_name in group["exercises"]:
            # 2. Assign the muscle group to the exercise during creation
            obj, created = Exercise.objects.get_or_create(
                name=ex_name,
                defaults={'muscle_group': muscle_group} 
            )
            if created:
                added_count += 1
                print(f"✅ Added: {ex_name} ({category_name})")
            else:
                print(f"⚡ Skipped: {ex_name} (Already in database)")

    print(f"\n🎉 Migration Complete! Successfully injected {added_count} new exercises into Django.\n")

if __name__ == "__main__":
    run_migration()