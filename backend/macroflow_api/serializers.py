from rest_framework import serializers
from .models import User, BodyWeight, MuscleGroup, Exercise, WorkoutSession, ExerciseSet, FoodItem, FoodLog, WaterLog

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'height', 'daily_calorie_goal', 'daily_protein_goal', 'daily_carbs_goal', 'daily_fat_goal', 'daily_water_goal']

class BodyWeightSerializer(serializers.ModelSerializer):
    bmi = serializers.ReadOnlyField()

    class Meta:
        model = BodyWeight
        fields = '__all__'

class MuscleGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = MuscleGroup
        fields = '__all__'

class ExerciseSerializer(serializers.ModelSerializer):
    muscle_group = MuscleGroupSerializer(read_only=True)
    muscle_group_id = serializers.PrimaryKeyRelatedField(
        queryset=MuscleGroup.objects.all(), source='muscle_group', write_only=True
    )

    class Meta:
        model = Exercise
        fields = '__all__'

class ExerciseSetSerializer(serializers.ModelSerializer):
    exercise = ExerciseSerializer(read_only=True)
    exercise_id = serializers.PrimaryKeyRelatedField(
        queryset=Exercise.objects.all(), source='exercise', write_only=True
    )

    class Meta:
        model = ExerciseSet
        fields = '__all__'

class WorkoutSessionSerializer(serializers.ModelSerializer):
    sets = ExerciseSetSerializer(many=True, read_only=True)

    class Meta:
        model = WorkoutSession
        fields = '__all__'
        
class FoodItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = FoodItem
        fields = '__all__'

class FoodLogSerializer(serializers.ModelSerializer):
    food_item = FoodItemSerializer(read_only=True)
    food_item_id = serializers.PrimaryKeyRelatedField(
        queryset=FoodItem.objects.all(), source='food_item', write_only=True
    )

    class Meta:
        model = FoodLog
        fields = '__all__'

class WaterLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = WaterLog
        fields = '__all__'
