from django.db import models
from django.contrib.auth.models import AbstractUser
from django.db.models.signals import post_save
from django.dispatch import receiver
from rest_framework.authtoken.models import Token
from django.conf import settings

class User(AbstractUser):
    """
    Custom user model for MacroFlow.
    Extends the standard Django AbstractUser to include physiological data
    and daily nutritional/hydration targets.
    """
    height = models.FloatField(help_text="Height in cm", null=True, blank=True)
    daily_calorie_goal = models.IntegerField(default=2500)
    daily_protein_goal = models.IntegerField(default=180)
    daily_carbs_goal = models.IntegerField(default=300)
    daily_fat_goal = models.IntegerField(default=80)
    daily_water_goal = models.IntegerField(default=2000, help_text="Daily water goal in ml")

class UserProfile(models.Model):
    """
    Extended profile for a User, storing physical attributes and calculated goals.
    This model separates the authentication/basic user data from the specific
    fitness/nutrition metrics used for calculations (like BMR and TDEE).
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='userprofile')
    ai_tokens = models.IntegerField(default=5, help_text="Available tokens for AI-powered features like meal recognition.")
    age = models.IntegerField(default=0)
    gender = models.CharField(max_length=10, null=True, blank=True)
    weight_lbs = models.FloatField(default=0.0)
    height_inches = models.FloatField(default=0.0)
    activity_level = models.CharField(max_length=50, null=True, blank=True)
    goal = models.CharField(max_length=50, null=True, blank=True)
    
    # Nutritional goals calculated during onboarding
    daily_calories_goal = models.IntegerField(default=2000)
    daily_protein_goal = models.IntegerField(default=150)
    daily_fat_goal = models.IntegerField(default=140)
    daily_net_carbs_goal = models.IntegerField(default=30)

    def __str__(self):
        return f"Profile for {self.user.username}"

class BodyWeight(models.Model):
    """
    Historical log of a user's weight over time.
    Used for progress tracking and dynamic recalculation of nutritional needs.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='weight_logs')
    date = models.DateField(auto_now_add=True)
    weight = models.FloatField(help_text="Weight in kg")

    @property
    def bmi(self):
        """
        Calculates the Body Mass Index (BMI) based on current weight and user's height.
        Formula: weight (kg) / [height (m)]^2
        """
        if self.user.height and self.weight:
            height_m = self.user.height / 100
            return round(self.weight / (height_m ** 2), 2)
        return None

class MuscleGroup(models.Model):
    """
    Dictionary of muscle groups used to categorize exercises.
    Example: 'Chest', 'Back', 'Legs', 'Deltoids'.
    """
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name

class Exercise(models.Model):
    """
    Master list of exercises.
    Contains metadata for exercise identification and visual instruction URLs.
    """
    muscle_group = models.ForeignKey(MuscleGroup, on_delete=models.CASCADE, related_name='exercises')
    name = models.CharField(max_length=200)
    gif_url = models.URLField(max_length=500, null=True, blank=True, help_text="Direct link to a form-guide GIF.")

    def __str__(self):
        return self.name

class WorkoutSession(models.Model):
    """
    A single training session container. 
    Acts as a parent for multiple ExerciseSet entries.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='workouts')
    date = models.DateTimeField(auto_now_add=True)

class ExerciseSet(models.Model):
    """
    A specific set performed within a WorkoutSession.
    Tracks quantitative metrics like resistance and volume.
    """
    workout = models.ForeignKey(WorkoutSession, on_delete=models.CASCADE, related_name='sets')
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE)
    weight = models.FloatField(help_text="Weight in lbs/kg depending on user preference.")
    reps = models.IntegerField()
    is_pr = models.BooleanField(default=False, help_text="True if this set represents a personal record.")

class FoodItem(models.Model):
    """
    Database of food items and their macro-nutritional profiles.
    Can be user-specific or global (null user).
    """
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
    """
    Record of a food item consumed by a user on a specific date.
    Calculates total nutritional intake by multiplying servings by the FoodItem's macros.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='food_logs')
    food_item = models.ForeignKey(FoodItem, on_delete=models.CASCADE)
    date = models.DateField(auto_now_add=True)
    servings = models.FloatField(default=1.0)

class WaterLog(models.Model):
    """
    Log for tracking water intake throughout the day.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='water_logs', null=True)
    amount_oz = models.IntegerField(help_text="Amount consumed in ounces.")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.amount_oz} oz"

class NutritionLog(models.Model):
    """
    Simplified nutrition record for quick logging.
    Used when a full FoodItem entry isn't required (e.g., quick manual entry).
    """
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
    """
    Flat record of a completed exercise.
    Often used for legacy data migration or simplified logging views.
    """
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
    """
    AI-generated or user-created recipes.
    Stores full ingredient lists and step-by-step instructions in JSON format.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_recipes', null=True)
    title = models.CharField(max_length=255)
    calories = models.IntegerField()
    protein = models.FloatField()
    fat = models.FloatField()
    net_carbs = models.FloatField()
    ingredients = models.JSONField(help_text="List of ingredients.")
    instructions = models.JSONField(help_text="Ordered list of cooking steps.")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class BiometricLog(models.Model):
    """
    Snapshots of user biometrics for health trend visualization.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    weight_lbs = models.FloatField()
    bmi = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.weight_lbs} lbs (BMI: {self.bmi})"

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_profile_and_token(sender, instance=None, created=False, **kwargs):
    """
    Signal receiver that automatically creates a UserProfile and an Auth Token
    whenever a new User is registered.
    """
    if created:
        UserProfile.objects.create(user=instance)
        Token.objects.create(user=instance)
