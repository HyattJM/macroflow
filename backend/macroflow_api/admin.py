from django.contrib import admin
from .models import Exercise, MuscleGroup, WorkoutSession, ExerciseSet, FoodItem, FoodLog

# Register your models here so they show up in the Admin Panel
admin.site.register(Exercise)
admin.site.register(MuscleGroup)
admin.site.register(WorkoutSession)
admin.site.register(ExerciseSet)
admin.site.register(FoodItem)
admin.site.register(FoodLog)