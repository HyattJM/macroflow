from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    height = models.FloatField(help_text="Height in cm", null=True, blank=True)
    daily_calorie_goal = models.IntegerField(default=2500)
    daily_protein_goal = models.IntegerField(default=180)
    daily_carbs_goal = models.IntegerField(default=300)
    daily_fat_goal = models.IntegerField(default=80)
    daily_water_goal = models.IntegerField(default=2000, help_text="Daily water goal in ml")

class BodyWeight(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='weight_logs')
    date = models.DateField(auto_now_add=True)
    weight = models.FloatField(help_text="Weight in kg")

    @property
    def bmi(self):
        if self.user.height and self.weight:
            height_m = self.user.height / 100
            return round(self.weight / (height_m ** 2), 2)
        return None

class MuscleGroup(models.Model):
    name = models.CharField(max_length=100, unique=True) # e.g., 'Chest', 'Back', 'Legs'

    def __str__(self):
        return self.name

class Exercise(models.Model):
    muscle_group = models.ForeignKey(MuscleGroup, on_delete=models.CASCADE, related_name='exercises')
    name = models.CharField(max_length=200) # e.g., 'Bench Press'

    def __str__(self):
        return self.name

class WorkoutSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='workouts')
    date = models.DateTimeField(auto_now_add=True)

class ExerciseSet(models.Model):
    workout = models.ForeignKey(WorkoutSession, on_delete=models.CASCADE, related_name='sets')
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE)
    weight = models.FloatField()
    reps = models.IntegerField()
    is_pr = models.BooleanField(default=False) # Personal Record flag

class FoodItem(models.Model):
    name = models.CharField(max_length=200)
    barcode = models.CharField(max_length=100, unique=True, null=True, blank=True)
    calories = models.FloatField()
    protein = models.FloatField()
    carbs = models.FloatField()
    fat = models.FloatField()

    def __str__(self):
        return self.name

class FoodLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='food_logs')
    food_item = models.ForeignKey(FoodItem, on_delete=models.CASCADE)
    date = models.DateField(auto_now_add=True)
    servings = models.FloatField(default=1.0)

class WaterLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='water_logs')
    date = models.DateField(auto_now_add=True)
    amount = models.IntegerField(help_text="Amount in ml")

    def __str__(self):
        return f"{self.user.username} - {self.amount}ml on {self.date}"
