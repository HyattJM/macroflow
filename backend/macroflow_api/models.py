from django.db import models
from django.contrib.auth.models import AbstractUser
from django.db.models.signals import post_save
from django.dispatch import receiver
from rest_framework.authtoken.models import Token
from django.conf import settings

class User(AbstractUser):
    height = models.FloatField(help_text="Height in cm", null=True, blank=True)
    daily_calorie_goal = models.IntegerField(default=2500)
    daily_protein_goal = models.IntegerField(default=180)
    daily_carbs_goal = models.IntegerField(default=300)
    daily_fat_goal = models.IntegerField(default=80)
    daily_water_goal = models.IntegerField(default=2000, help_text="Daily water goal in ml")

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='userprofile')
    ai_tokens = models.IntegerField(default=5)
    age = models.IntegerField(default=0)
    gender = models.CharField(max_length=10, null=True, blank=True)
    weight_lbs = models.FloatField(default=0.0)
    height_inches = models.FloatField(default=0.0)
    activity_level = models.CharField(max_length=50, null=True, blank=True)
    goal = models.CharField(max_length=50, null=True, blank=True)
    
    daily_calories_goal = models.IntegerField(default=2000)
    daily_protein_goal = models.IntegerField(default=150)
    daily_fat_goal = models.IntegerField(default=140)
    daily_net_carbs_goal = models.IntegerField(default=30)

    def __str__(self):
        return f"Profile for {self.user.username}"

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
    gif_url = models.URLField(max_length=500, null=True, blank=True) # <-- Paste this right here!

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
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='food_items', null=True, blank=True)
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
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='water_logs', null=True)
    amount_oz = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.amount_oz} oz"

class NutritionLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='nutrition_logs', null=True)
    food_name = models.CharField(max_length=200)
    calories = models.IntegerField()
    protein = models.FloatField()
    carbs = models.FloatField()
    fat = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.food_name

class WorkoutLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='workout_logs', null=True)
    exercise_name = models.CharField(max_length=200)
    weight = models.FloatField()
    sets = models.IntegerField()
    reps = models.IntegerField()
    duration_minutes = models.IntegerField(default=30)
    burned_calories = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.exercise_name} ({self.sets}x{self.reps} @ {self.weight})"

class SavedRecipe(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_recipes', null=True)
    title = models.CharField(max_length=255)
    calories = models.IntegerField()
    protein = models.FloatField()
    fat = models.FloatField()
    net_carbs = models.FloatField()
    ingredients = models.JSONField()
    instructions = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class BiometricLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    weight_lbs = models.FloatField()
    bmi = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.weight_lbs} lbs (BMI: {self.bmi})"

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_profile_and_token(sender, instance=None, created=False, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
        Token.objects.create(user=instance)
