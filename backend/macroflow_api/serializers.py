from rest_framework import serializers
from .models import User, BodyWeight, MuscleGroup, Exercise, WorkoutSession, ExerciseSet, FoodItem, FoodLog, WaterLog, NutritionLog, WorkoutLog, SavedRecipe, HeartRateDataPoint

class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for the Custom User model.
    Handles the conversion of User instances to JSON for the mobile frontend.
    """
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'height', 'daily_calorie_goal', 'daily_protein_goal', 'daily_carbs_goal', 'daily_fat_goal', 'daily_water_goal']

class BodyWeightSerializer(serializers.ModelSerializer):
    """
    Serializer for BodyWeight logs.
    Includes the calculated BMI as a read-only field.
    """
    bmi = serializers.ReadOnlyField()

    class Meta:
        model = BodyWeight
        fields = '__all__'

class MuscleGroupSerializer(serializers.ModelSerializer):
    """
    Serializer for MuscleGroup model.
    Provides simple ID and name mapping for exercise categorization.
    """
    class Meta:
        model = MuscleGroup
        fields = '__all__'

class ExerciseSerializer(serializers.ModelSerializer):
    """
    Serializer for Exercise model.
    Includes nested MuscleGroup details for GET requests and accepts 
    muscle_group_id for write operations.
    """
    muscle_group = MuscleGroupSerializer(read_only=True)
    muscle_group_id = serializers.PrimaryKeyRelatedField(
        queryset=MuscleGroup.objects.all(), source='muscle_group', write_only=True
    )

    class Meta:
        model = Exercise
        fields = '__all__'

class ExerciseSetSerializer(serializers.ModelSerializer):
    """
    Serializer for individual ExerciseSets.
    Tracks reps, weight, and PR status. Links to a specific Exercise.
    """
    exercise = ExerciseSerializer(read_only=True)
    exercise_id = serializers.PrimaryKeyRelatedField(
        queryset=Exercise.objects.all(), source='exercise', write_only=True
    )

    class Meta:
        model = ExerciseSet
        fields = '__all__'

class HeartRateDataPointSerializer(serializers.ModelSerializer):
    class Meta:
        model = HeartRateDataPoint
        fields = ['timestamp', 'bpm']

class WorkoutSessionSerializer(serializers.ModelSerializer):
    """
    Serializer for a complete WorkoutSession.
    Nests all ExerciseSet entries performed during the session.
    """
    sets = ExerciseSetSerializer(many=True, read_only=True)
    hr_data = HeartRateDataPointSerializer(many=True, required=False)

    class Meta:
        model = WorkoutSession
        fields = '__all__'
        
    def update(self, instance, validated_data):
        hr_data = validated_data.pop('hr_data', None)
        
        instance = super().update(instance, validated_data)
        
        if hr_data is not None and not instance.is_active:
            hr_objects = [
                HeartRateDataPoint(session=instance, **data)
                for data in hr_data
            ]
            HeartRateDataPoint.objects.bulk_create(hr_objects)
            
        return instance
        
class FoodItemSerializer(serializers.ModelSerializer):
    """
    Serializer for FoodItems.
    Defines the nutritional footprint (macros) for any logged food.
    """
    class Meta:
        model = FoodItem
        fields = '__all__'

class FoodLogSerializer(serializers.ModelSerializer):
    """
    Serializer for daily food consumption logs.
    Includes nested FoodItem details to display macro breakdowns in the UI.
    """
    food_item = FoodItemSerializer(read_only=True)
    food_item_id = serializers.PrimaryKeyRelatedField(
        queryset=FoodItem.objects.all(), source='food_item', write_only=True
    )

    class Meta:
        model = FoodLog
        fields = '__all__'

class WaterLogSerializer(serializers.ModelSerializer):
    """
    Serializer for hydration logs.
    """
    class Meta:
        model = WaterLog
        fields = '__all__'

class NutritionLogSerializer(serializers.ModelSerializer):
    """
    Serializer for simplified manual nutrition logging.
    """
    class Meta:
        model = NutritionLog
        fields = '__all__'

class WorkoutLogSerializer(serializers.ModelSerializer):
    """
    Serializer for simplified workout logs.
    Used for flat views or summary reports.
    """
    class Meta:
        model = WorkoutLog
        fields = '__all__'

class SavedRecipeSerializer(serializers.ModelSerializer):
    """
    Serializer for AI-generated and saved recipes.
    Handles complex nested JSON fields for ingredients and instructions.
    """
    class Meta:
        model = SavedRecipe
        fields = '__all__'
