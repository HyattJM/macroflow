import os
import django
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from macroflow_api.models import MuscleGroup, Exercise, User

def update_groups():
    core = MuscleGroup.objects.filter(name="Core").first()
    if core:
        core.name = "Abs"
        core.save()
        print("Renamed Core to Abs")

    arms = MuscleGroup.objects.filter(name="Arms").first()
    biceps = MuscleGroup.objects.filter(name="Biceps").first()
    if arms and not biceps:
        arms.name = "Biceps"
        arms.save()
        triceps, _ = MuscleGroup.objects.get_or_create(name="Triceps")
        
        Exercise.objects.filter(name__in=["Tricep Pushdown", "Skull Crushers"]).update(muscle_group=triceps)
        print("Renamed Arms to Biceps and moved Triceps exercises")

    cardio, _ = MuscleGroup.objects.get_or_create(name="Cardio")
    Exercise.objects.get_or_create(name="Running", muscle_group=cardio)
    Exercise.objects.get_or_create(name="Cycling", muscle_group=cardio)
    Exercise.objects.get_or_create(name="Rowing", muscle_group=cardio)
    Exercise.objects.get_or_create(name="Jump Rope", muscle_group=cardio)
    print("Ensured Cardio exists")

if __name__ == "__main__":
    update_groups()
