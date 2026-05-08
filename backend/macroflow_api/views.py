from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.utils import timezone
from django.db.models import Sum, Max
from django.db.models.functions import TruncDate
from .models import User, UserProfile, BodyWeight, MuscleGroup, Exercise, WorkoutSession, ExerciseSet, FoodItem, FoodLog, WaterLog, NutritionLog, WorkoutLog, SavedRecipe, BiometricLog
from .serializers import (UserSerializer, BodyWeightSerializer, MuscleGroupSerializer, 
                          ExerciseSerializer, WorkoutSessionSerializer, ExerciseSetSerializer, 
                          FoodItemSerializer, FoodLogSerializer, WaterLogSerializer, NutritionLogSerializer, WorkoutLogSerializer, SavedRecipeSerializer)
import requests
from .gemini_service import gemini_service, RateLimitException
from .utils import calculate_calories_burned

class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing User objects.
    Provides standard CRUD operations for authenticated users.
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer

class BodyWeightViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing BodyWeight logs.
    Used to track historical weight changes and calculate BMI trends.
    """
    serializer_class = BodyWeightSerializer

    def get_queryset(self):
        return BodyWeight.objects.filter(user=self.request.user).order_by('date')

class MuscleGroupViewSet(viewsets.ModelViewSet):
    """
    ViewSet for the MuscleGroup dictionary.
    Read-only for most users; provides categorization for exercises.
    """
    queryset = MuscleGroup.objects.all()
    serializer_class = MuscleGroupSerializer

class ExerciseViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Exercise definitions.
    Returns exercise metadata including form-guide GIF URLs.
    """
    queryset = Exercise.objects.all()
    serializer_class = ExerciseSerializer

class WorkoutSessionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for WorkoutSessions.
    Acts as a container for grouped ExerciseSet logs.
    """
    queryset = WorkoutSession.objects.all()
    serializer_class = WorkoutSessionSerializer

class ExerciseSetViewSet(viewsets.ModelViewSet):
    """
    ViewSet for individual ExerciseSets.
    Records resistance, volume, and PR achievements.
    """
    queryset = ExerciseSet.objects.all()
    serializer_class = ExerciseSetSerializer

class FoodItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet for FoodItem entries.
    Provides macro-nutritional data for the logging engine.
    """
    queryset = FoodItem.objects.all()
    serializer_class = FoodItemSerializer

class FoodLogViewSet(viewsets.ModelViewSet):
    """
    ViewSet for daily FoodLogs.
    Tracks what the user ate and in what quantities.
    """
    queryset = FoodLog.objects.all()
    serializer_class = FoodLogSerializer

class WaterLogViewSet(viewsets.ModelViewSet):
    """
    ViewSet for WaterLog entries.
    Tracks hydration progress against the user's daily goal.
    """
    queryset = WaterLog.objects.all()
    serializer_class = WaterLogSerializer

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def scan_barcode(request):
    """
    Identifies a food item via barcode.
    
    Flow:
    1. Check local DB for an existing item with this barcode.
    2. Fallback to Gemini AI to identify the product and estimate macros based on common knowledge.
    3. Mock fallback for testing if AI fails.

    Payload: {"barcode": "string"}
    Response: {"status": "success", "data": FoodItemObject, "source": "local|gemini_ai|mock_fallback"}
    """
    barcode = request.data.get('barcode')
    if not barcode:
        return Response({"error": "Barcode is required"}, status=status.HTTP_400_BAD_REQUEST)
    
    # 1. Check local DB (filtered by user or global catalog?) 
    # User might want to search their own items first
    try:
        food = FoodItem.objects.get(barcode=barcode, user=request.user)
        serializer = FoodItemSerializer(food)
        return Response({"status": "success", "data": serializer.data, "source": "local"})
    except FoodItem.DoesNotExist:
        pass
        
    # 2. Try Gemini to identify barcode
    ai_suggestions = gemini_service.analyze_meal_description(f"What food item has barcode {barcode}?")
    if ai_suggestions and len(ai_suggestions) > 0:
        suggestion = ai_suggestions[0]
        new_food = FoodItem.objects.create(
            user=request.user,
            name=suggestion['name'],
            barcode=barcode,
            calories=suggestion['calories'],
            protein=suggestion['protein'],
            carbs=suggestion['carbs'],
            fat=suggestion['fat']
        )
        serializer = FoodItemSerializer(new_food)
        return Response({"status": "success", "data": serializer.data, "source": "gemini_ai"})

    # 3. Last fallback
    mocked_api_response = {
        "user": request.user,
        "name": f"Mocked Scanned Item ({barcode})",
        "barcode": barcode,
        "calories": 150.0,
        "protein": 5.0,
        "carbs": 20.0,
        "fat": 5.0
    }
    
    new_food = FoodItem.objects.create(**mocked_api_response)
    serializer = FoodItemSerializer(new_food)
    return Response({"status": "success", "data": serializer.data, "source": "mock_fallback"})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def analyze_nutrition(request):
    """
    NLP-based nutrition analysis.
    Takes a natural language description of a meal and returns estimated macros.

    Payload: {"description": "1 chicken breast and 100g of rice"}
    Response: {"status": "success", "data": [{"name": "...", "calories": 0, ...}]}
    """
    description = request.data.get('description')
    if not description:
        return Response({"error": "Description is required"}, status=status.HTTP_400_BAD_REQUEST)

    nutrition_data = gemini_service.analyze_meal_description(description)
    if nutrition_data is None:
        return Response({"error": "Failed to analyze nutrition data"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({"status": "success", "data": nutrition_data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def scan_keto(request):
    """
    Keto-Vision image analysis.
    Uses Gemini Vision to identify food from a base64 image and estimate macros.
    Deducts one AI token from the user profile upon success.

    Payload: {"image": "base64_string", "modifier": "string (optional)"}
    Response: {"status": "success", "data": NutritionLogObject}
    """
    image_base64 = request.data.get('image')
    modifier = request.data.get('modifier', '')
    
    if not image_base64:
        return Response({"error": "Image (base64) is required"}, status=status.HTTP_400_BAD_REQUEST)
        
    profile = getattr(request.user, 'userprofile', None)
    if not profile or profile.ai_tokens <= 0:
        return Response({"error": "Out of free AI scans. Upgrade to Pro."}, status=status.HTTP_402_PAYMENT_REQUIRED)
        
    # Process through our Keto-Vision agent prompt
    try:
        keto_data = gemini_service.analyze_meal_image_with_modifications(image_base64, modifier)
    except RateLimitException as e:
        return Response({'error': str(e)}, status=429)
        
    if not keto_data:
         return Response({"error": "Failed to analyze image via Keto Vision"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
         
    # Success: Deduct token and save log
    profile.ai_tokens -= 1
    profile.save()
         
    new_log = NutritionLog.objects.create(
        user=request.user,
        food_name=keto_data.get('food_name', 'Keto Vision Scanned Item'),
        calories=int(keto_data.get('calories', 0)),
        protein=float(keto_data.get('protein', 0.0)),
        carbs=float(keto_data.get('carbs', 0.0)),
        fat=float(keto_data.get('fat', 0.0))
    )
    serializer = NutritionLogSerializer(new_log)
    return Response({"status": "success", "data": serializer.data})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_nutrition_logs(request):
    """
    Retrieves nutrition logs for a user within a specified timeframe.
    Defaults to 'today' if no date parameters are provided.

    Query Params: ?date=YYYY-MM-DD or ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
    Response: {"status": "success", "data": [Logs], "totals": {"calories": 0, ...}}
    """
    logs = NutritionLog.objects.filter(user=request.user)

    date_param = request.query_params.get('date')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')

    if date_param:
        logs = logs.filter(created_at__date=date_param)
    elif start_date or end_date:
        if start_date:
            logs = logs.filter(created_at__date__gte=start_date)
        if end_date:
            logs = logs.filter(created_at__date__lte=end_date)
    else:
        today = timezone.localdate()
        logs = logs.filter(created_at__date=today)

    logs = logs.order_by('-created_at')

    totals = logs.aggregate(
        total_calories=Sum('calories'),
        total_protein=Sum('protein'),
        total_carbs=Sum('carbs'),
        total_fat=Sum('fat')
    )

    aggregated_totals = {
        'calories': totals['total_calories'] or 0,
        'protein': round(totals['total_protein'], 1) if totals['total_protein'] is not None else 0.0,
        'fat': round(totals['total_fat'], 1) if totals['total_fat'] is not None else 0.0,
        'net_carbs': round(totals['total_carbs'], 1) if totals['total_carbs'] is not None else 0.0,
    }

    serializer = NutritionLogSerializer(logs, many=True)
    return Response({
        "status": "success",
        "data": serializer.data,
        "totals": aggregated_totals
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_daily_summary(request):
    """
    Provides a high-level summary of the user's progress for the current day.
    Includes totals for macros consumed, calories burned, and current goals.

    Response: {"calories": 0, "protein": 0, ..., "goals": {...}}
    """
    today = timezone.localdate()
    
    # Gathering logs for today filtered by user
    logs_today = NutritionLog.objects.filter(user=request.user, created_at__date=today)
    workouts_today = WorkoutLog.objects.filter(user=request.user, created_at__date=today)
    
    totals = logs_today.aggregate(
        total_calories=Sum('calories'),
        total_protein=Sum('protein'),
        total_carbs=Sum('carbs'),
        total_fat=Sum('fat')
    )
    
    total_burned = workouts_today.aggregate(Sum('burned_calories'))['burned_calories__sum'] or 0.0
    
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    
    payload = {
        'calories': totals['total_calories'] or 0,
        'protein': count_safe(totals['total_protein']),
        'fat': count_safe(totals['total_fat']),
        'net_carbs': count_safe(totals['total_carbs']),
        'burned': round(total_burned, 1),
        'age': profile.age,
        'goals': {
            'calories': profile.daily_calories_goal,
            'protein': profile.daily_protein_goal,
            'fat': profile.daily_fat_goal,
            'net_carbs': profile.daily_net_carbs_goal
        }
    }
    
    return Response(payload)

def count_safe(val):
    """Rounding helper to prevent NoneType errors in JSON responses."""
    return round(val, 1) if val is not None else 0.0

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def log_workout(request):
    """
    Logs a completed workout exercise.
    Calculates calories burned based on MET values for the exercise and user weight.
    Supports both legacy flat logging and multi-set aggregation.

    Payload: {"exercise_name": "...", "duration": 30, "sets_list": [{"weight": 0, "reps": 0}]}
    Response: {"status": "success", "data": WorkoutLogObject}
    """
    try:
        exercise_name = request.data.get('exercise_name', 'Unknown Exercise')
        duration = int(request.data.get('duration', 30))
        sets_list = request.data.get('sets_list', []) # Array of {weight, reps}
        
        # Calculate burned calories if user has weight info, fallback to 180lbs
        profile = getattr(request.user, 'userprofile', None)
        weight_lbs = profile.weight_lbs if profile and profile.weight_lbs > 0 else 180
        weight_kg = weight_lbs / 2.20462
        
        burned = calculate_calories_burned(exercise_name, duration, weight_kg)
        
        if sets_list and len(sets_list) > 0:
            total_sets = len(sets_list)
            # Aggregate for legacy WorkoutLog: Use max weight and average reps
            max_weight = max(float(s.get('weight', 0)) for s in sets_list)
            avg_reps = sum(int(s.get('reps', 0)) for s in sets_list) // total_sets
            
            new_log = WorkoutLog.objects.create(
                user=request.user,
                exercise_name=exercise_name,
                weight=max_weight,
                sets=total_sets,
                reps=avg_reps,
                duration_minutes=duration,
                burned_calories=burned
            )
        else:
            new_log = WorkoutLog.objects.create(
                user=request.user,
                exercise_name=exercise_name,
                weight=float(request.data.get('weight', 0.0)),
                sets=int(request.data.get('sets', 1)),
                reps=int(request.data.get('reps', 1)),
                duration_minutes=duration,
                burned_calories=burned
            )
            
        serializer = WorkoutLogSerializer(new_log)
        return Response({"status": "success", "data": serializer.data})
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_workouts(request):
    """
    Retrieves all workout logs for the authenticated user, ordered by recency.
    """
    logs = WorkoutLog.objects.filter(user=request.user).order_by('-created_at')
    serializer = WorkoutLogSerializer(logs, many=True)
    return Response({"status": "success", "data": serializer.data})

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_nutrition_log(request, pk):
    """
    Updates an existing nutrition log entry.
    Ensures the log belongs to the authenticated user.
    """
    try:
        log = NutritionLog.objects.get(pk=pk, user=request.user)
    except NutritionLog.DoesNotExist:
        return Response({"status": "error", "message": "Log not found or unauthorized"}, status=status.HTTP_404_NOT_FOUND)
        
    try:
        log.food_name = request.data.get('food_name', log.food_name)
        log.calories = int(request.data.get('calories', log.calories))
        log.protein = float(request.data.get('protein', log.protein))
        log.carbs = float(request.data.get('carbs', log.carbs))
        log.fat = float(request.data.get('fat', log.fat))
        log.save()
        serializer = NutritionLogSerializer(log)
        return Response({"status": "success", "data": serializer.data})
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_nutrition_log(request, pk):
    """
    Deletes a nutrition log entry.
    """
    try:
        log = NutritionLog.objects.get(pk=pk, user=request.user)
        log.delete()
        return Response({"status": "success", "message": "Deleted successfully"})
    except NutritionLog.DoesNotExist:
        return Response({"status": "error", "message": "Log not found or unauthorized"}, status=status.HTTP_404_NOT_FOUND)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_workout_log(request, pk):
    """
    Updates an existing workout log entry.
    """
    try:
        log = WorkoutLog.objects.get(pk=pk, user=request.user)
    except WorkoutLog.DoesNotExist:
        return Response({"status": "error", "message": "Log not found or unauthorized"}, status=status.HTTP_404_NOT_FOUND)
        
    try:
        log.exercise_name = request.data.get('exercise_name', log.exercise_name)
        log.weight = float(request.data.get('weight', log.weight))
        log.sets = int(request.data.get('sets', log.sets))
        log.reps = int(request.data.get('reps', log.reps))
        log.save()
        serializer = WorkoutLogSerializer(log)
        return Response({"status": "success", "data": serializer.data})
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_workout_log(request, pk):
    """
    Deletes a workout log entry.
    """
    try:
        log = WorkoutLog.objects.get(pk=pk, user=request.user)
        log.delete()
        return Response({"status": "success", "message": "Deleted successfully"})
    except WorkoutLog.DoesNotExist:
        return Response({"status": "error", "message": "Log not found or unauthorized"}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def log_water(request):
    """
    Logs water intake in ounces.

    Payload: {"amount_oz": 8}
    Response: {"status": "success", "data": WaterLogObject}
    """
    try:
        amount_oz = int(request.data.get('amount_oz', 0))
        if amount_oz <= 0:
            return Response({"status": "error", "message": "Amount must be greater than 0"}, status=status.HTTP_400_BAD_REQUEST)
            
        new_log = WaterLog.objects.create(user=request.user, amount_oz=amount_oz)
        serializer = WaterLogSerializer(new_log)
        return Response({"status": "success", "data": serializer.data})
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_today_water(request):
    """
    Retrieves the total water consumed by the user today.
    """
    today = timezone.localdate()
    logs_today = WaterLog.objects.filter(user=request.user, created_at__date=today)
    
    total_oz = logs_today.aggregate(total=Sum('amount_oz'))['total'] or 0
    
    return Response({"status": "success", "data": {"total_oz": total_oz}})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def log_nutrition(request):
    """
    Manually logs a food item with macros.

    Payload: {"food_name": "...", "calories": 0, "protein": 0, ...}
    Response: {"status": "success", "data": NutritionLogObject}
    """
    try:
        new_log = NutritionLog.objects.create(
            user=request.user,
            food_name=request.data.get('food_name', 'Unknown Item'),
            calories=int(request.data.get('calories', 0)),
            protein=float(request.data.get('protein', 0.0)),
            carbs=float(request.data.get('carbs', 0.0)),
            fat=float(request.data.get('fat', 0.0))
        )
        serializer = NutritionLogSerializer(new_log)
        return Response({"status": "success", "data": serializer.data})
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_wallet(request):
    """
    Returns the user's current AI token balance.
    """
    profile = getattr(request.user, 'userprofile', None)
    tokens = profile.ai_tokens if profile else 0
    return Response({"status": "success", "ai_tokens": tokens})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_tokens(request):
    profile = getattr(request.user, 'userprofile', None)
    return Response({"tokens": profile.ai_tokens if profile else 0})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_recipe(request):
    """
    AI Chef feature: Generates a keto-friendly recipe based on a list of ingredients.
    
    Payload: {"ingredients": "string or list"}
    Response: {"status": "success", "data": RecipeData}
    """
    ingredients = request.data.get('ingredients')
    if not ingredients:
        return Response({"error": "Ingredients are required"}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        recipe_data = gemini_service.generate_keto_recipe(ingredients)
    except RateLimitException as e:
        return Response({'error': str(e)}, status=429)
        
    if not recipe_data:
        return Response({"error": "Failed to generate recipe via AI Chef"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    return Response({"status": "success", "data": recipe_data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_recipe(request):
    """
    Saves an AI-generated or user-defined recipe to the user's collection.
    """
    try:
        new_recipe = SavedRecipe.objects.create(
            user=request.user,
            title=request.data.get('title', 'Unknown Recipe'),
            calories=int(request.data.get('calories', 0)),
            protein=float(request.data.get('protein', 0.0)),
            fat=float(request.data.get('fat', 0.0)),
            net_carbs=float(request.data.get('net_carbs', 0.0)),
            ingredients=request.data.get('ingredients', []),
            instructions=request.data.get('instructions', [])
        )
        serializer = SavedRecipeSerializer(new_recipe)
        return Response({"status": "success", "data": serializer.data})
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_saved_recipes(request):
    """
    Retrieves all recipes saved by the user.
    """
    recipes = SavedRecipe.objects.filter(user=request.user).order_by('-created_at')
    serializer = SavedRecipeSerializer(recipes, many=True)
    return Response({"status": "success", "data": serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_grocery_list(request):
    """
    AI feature: Consolidates ingredients from multiple saved recipes into a grocery list.
    
    Payload: {"recipe_ids": [1, 2]}
    Response: {"status": "success", "data": GroceryListData}
    """
    recipe_ids = request.data.get('recipe_ids', [])
    if not recipe_ids:
        return Response({"error": "Recipe IDs are required"}, status=status.HTTP_400_BAD_REQUEST)
        
    recipes = SavedRecipe.objects.filter(id__in=recipe_ids, user=request.user)
    if not recipes.exists():
         return Response({"error": "No valid recipes for this user found"}, status=status.HTTP_404_NOT_FOUND)
         
    all_ingredients = []
    for recipe in recipes:
        if isinstance(recipe.ingredients, list):
            all_ingredients.extend(recipe.ingredients)
            
    if not all_ingredients:
        return Response({"error": "No ingredients found in selected recipes"}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        grocery_data = gemini_service.generate_grocery_list(all_ingredients)
    except RateLimitException as e:
        return Response({'error': str(e)}, status=429)
        
    if not grocery_data:
        return Response({"error": "Failed to generate grocery list via AI"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    return Response({"status": "success", "data": grocery_data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_chef_meal(request):
    """
    AI Chef: Recommends a meal based on the user's remaining nutritional budget for the day.
    Deducts one AI token upon success.

    Response: {"status": "success", "data": RecipeData}
    """
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    if profile.ai_tokens <= 0:
        return Response({"error": "Out of free AI tokens. Upgrade to Pro."}, status=status.HTTP_402_PAYMENT_REQUIRED)
    
    today = timezone.localdate()
    logs_today = NutritionLog.objects.filter(user=request.user, created_at__date=today)
    
    totals = logs_today.aggregate(
        total_calories=Sum('calories'),
        total_protein=Sum('protein'),
        total_carbs=Sum('carbs'),
        total_fat=Sum('fat')
    )
    
    consumed = {
        'calories': totals['total_calories'] or 0,
        'protein': totals['total_protein'] or 0.0,
        'fat': totals['total_fat'] or 0.0,
        'net_carbs': totals['total_carbs'] or 0.0
    }
    
    # Baseline daily goals
    goals = {
        'calories': 2000,
        'protein': 150,
        'net_carbs': 30,
        'fat': 140
    }
    
    remaining = {
        'calories': max(0, goals['calories'] - consumed['calories']),
        'protein': max(0.0, goals['protein'] - consumed['protein']),
        'net_carbs': max(0.0, goals['net_carbs'] - consumed['net_carbs']),
        'fat': max(0.0, goals['fat'] - consumed['fat'])
    }
    
    try:
        recipe_data = gemini_service.generate_meal_for_macros(remaining)
    except RateLimitException as e:
        return Response({'error': str(e)}, status=429)
        
    if not recipe_data:
        return Response({"error": "Failed to generate recipe via AI Chef"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    # Success: Deduct token
    profile.ai_tokens -= 1
    profile.save()
    
    return Response({"status": "success", "data": recipe_data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_onboarding(request):
    """
    Handles user onboarding and calculates personalized keto macro targets.
    
    Logic:
    1. Unit Conversion: Converts Imperial (lbs, inches) to Metric (kg, cm) for calculation.
    2. BMR (Basal Metabolic Rate): Calculated using the Mifflin-St Jeor Equation, 
       which is considered the most accurate for general populations.
    3. TDEE (Total Daily Energy Expenditure): Multiplies BMR by an activity factor.
    4. Goal Adjustment: 
       - Weight Loss: TDEE - 500 kcal
       - Muscle Gain: TDEE + 300 kcal
    5. Macro Waterfall:
       - Net Carbs: Fixed at 30g (standard keto induction level).
       - Protein: Fixed at 1g per lb of body weight (to preserve lean mass).
       - Fat: Fills the remaining calorie budget.

    Payload: {"age": int, "gender": "male|female", "weight_lbs": float, "height_inches": float, "activity_level": "...", "goal": "..."}
    Response: {"status": "success", "calculated_targets": {...}}
    """
    data = request.data
    try:
        age_val = data.get('age', 0)
        age = int(age_val)
        gender = str(data.get('gender', '')).lower()
        weight_lbs = float(data.get('weight_lbs', 0.0))
        height_inches = float(data.get('height_inches', 0.0))
        activity_level = str(data.get('activity_level', '')).lower().replace(' ', '_')
        goal = str(data.get('goal', '')).lower().replace(' ', '_')
    except (ValueError, TypeError):
        return Response({"error": "Invalid numeric data provided"}, status=status.HTTP_400_BAD_REQUEST)

    if not all([age, gender, weight_lbs, height_inches, activity_level, goal]):
        return Response({"error": "Missing required onboarding data"}, status=status.HTTP_400_BAD_REQUEST)

    # Unit Conversion
    weight_kg = weight_lbs / 2.20462
    height_cm = height_inches * 2.54

    # BMR calculation using Mifflin-St Jeor Equation
    if 'male' in gender:
        bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + 5
    else:
        bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) - 161

    # TDEE Multipliers
    multipliers = {
        'sedentary': 1.2,
        'lightly_active': 1.375,
        'moderately_active': 1.55,
        'very_active': 1.725,
        'extra_active': 1.9
    }
    # Match key partially if needed
    multiplier = 1.2
    for key, val in multipliers.items():
        if key in activity_level:
            multiplier = val
            break
            
    tdee = bmr * multiplier

    # Keto Waterfall Logic
    # 1. Adjust calories based on goal
    if 'lose' in goal or 'loss' in goal:
        adjusted_calories = tdee - 500
    elif 'gain' in goal or 'muscle' in goal:
        adjusted_calories = tdee + 300
    else:
        adjusted_calories = tdee

    # 2. Set Net Carbs (30g)
    daily_net_carbs = 30
    
    # 3. Protein (1g per lb of body weight)
    daily_protein = int(weight_lbs)
    
    # 4. Fat (remaining calories)
    calories_from_protein_carbs = (daily_protein * 4) + (daily_net_carbs * 4)
    remaining_calories = adjusted_calories - calories_from_protein_carbs
    daily_fat = int(max(0, remaining_calories / 9))

    # Persistence to UserProfile
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    profile.age = age
    profile.gender = gender
    profile.weight_lbs = weight_lbs
    profile.height_inches = height_inches
    profile.activity_level = activity_level
    profile.goal = goal
    profile.daily_calories_goal = int(adjusted_calories)
    profile.daily_protein_goal = daily_protein
    profile.daily_fat_goal = daily_fat
    profile.daily_net_carbs_goal = daily_net_carbs
    profile.save()

    # Sync to legacy User model
    user = request.user
    user.daily_calorie_goal = int(adjusted_calories)
    user.daily_protein_goal = daily_protein
    user.daily_fat_goal = daily_fat
    user.daily_carbs_goal = daily_net_carbs
    user.height = height_cm
    user.save()

    return Response({
        "status": "success",
        "calculated_targets": {
            "calories": int(adjusted_calories),
            "protein": daily_protein,
            "fat": daily_fat,
            "net_carbs": daily_net_carbs
        }
    })

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """
    Registers a new user and returns an authentication token.
    Grants 5 free AI tokens to the new user profile by default.
    """
    username = request.data.get('username')
    password = request.data.get('password')
    if not username or not password:
        return Response({"error": "Username and password required"}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        if User.objects.filter(username=username).exists():
            return Response({"error": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)
            
        user = User(username=username)
        user.set_password(password)
        user.save()
        
        token, _ = Token.objects.get_or_create(user=user)
        profile, created = UserProfile.objects.get_or_create(user=user)
        profile.ai_tokens = 5
        profile.save()
        
        return Response({"status": "success", "token": token.key, "ai_tokens": profile.ai_tokens})
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    Authenticates user credentials and returns an API token.
    """
    username = request.data.get('username')
    password = request.data.get('password')
    user = authenticate(username=username, password=password)
    if user:
        token, _ = Token.objects.get_or_create(user=user)
        profile = getattr(user, 'userprofile', None)
        return Response({"status": "success", "token": token.key, "ai_tokens": profile.ai_tokens if profile else 0})
    return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_exercise_max(request):
    """
    Retrieves the Personal Best (max weight and reps) for a specific exercise.
    Used for the progress badges in the UI.
    """
    name = request.query_params.get('name', '')
    if not name:
        return Response({"max_weight": 0, "max_reps": 0})
    
    best_log = WorkoutLog.objects.filter(
        user=request.user, 
        exercise_name__iexact=name
    ).order_by('-weight', '-reps').first()
    
    if best_log:
        return Response({"max_weight": best_log.weight, "max_reps": best_log.reps})
    return Response({"max_weight": 0, "max_reps": 0})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_workout_history(request):
    """
    Retrieves workout history in two formats:
    1. 'graph' mode: Returns max weight per date for charting progress.
    2. Default: Returns full log history grouped by date for SectionList display.
    """
    exercise = request.query_params.get('exercise')
    req_mode = request.query_params.get('mode')

    # Base queryset for the user
    logs = WorkoutLog.objects.filter(user=request.user)

    # Apply the exercise filter if the frontend passed one
    if exercise:
        logs = logs.filter(exercise_name__iexact=exercise)

    # 1. Send data formatted for the ChartKit Graph
    if req_mode == 'graph':
        graph_logs = logs.annotate(date=TruncDate('created_at')) \
                         .values('date') \
                         .annotate(max_weight=Max('weight')) \
                         .order_by('date')
        
        data = [{
            'date': item['date'].strftime('%m/%d'),
            'weight': item['max_weight']
        } for item in graph_logs]
        return Response(data)
        
    # 2. Send data grouped by Date for the History SectionList
    else:
        logs = logs.order_by('-created_at')
        grouped = {}
        for log in logs:
            date_str = log.created_at.strftime('%Y-%m-%d')
            if date_str not in grouped:
                grouped[date_str] = []
            grouped[date_str].append(WorkoutLogSerializer(log).data)
        
        sections = [{'title': k, 'data': v} for k, v in grouped.items()]
        return Response(sections)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def profile_view(request):
    """
    Retrieves or updates user profile biometrics and activity preferences.
    """
    try:
        profile, created = UserProfile.objects.get_or_create(user=request.user)
        if request.method == 'GET':
            return Response({
                "status": "success",
                "data": {
                    "age": profile.age,
                    "height_inches": profile.height_inches,
                    "weight_lbs": profile.weight_lbs,
                    "gender": profile.gender,
                    "activity_level": profile.activity_level
                }
            })
        elif request.method == 'POST':
            profile.age = int(request.data.get('age', profile.age))
            profile.height_inches = float(request.data.get('height_inches', profile.height_inches))
            profile.weight_lbs = float(request.data.get('weight_lbs', profile.weight_lbs))
            profile.gender = request.data.get('gender', profile.gender)
            profile.activity_level = request.data.get('activity_level', profile.activity_level)
            profile.save()
            return Response({"status": "success", "message": "Profile updated successfully"})
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST', 'GET'])
@permission_classes([IsAuthenticated])
def biometrics_view(request):
    """
    Manages historical biometric snapshots (weight and BMI).
    Used for long-term health trend visualization.
    """
    if request.method == 'POST':
        try:
            weight_lbs = float(request.data.get('weight_lbs', 0))
            bmi = float(request.data.get('bmi', 0))
            
            if weight_lbs <= 0 or bmi <= 0:
                return Response({"error": "Invalid metrics"}, status=status.HTTP_400_BAD_REQUEST)
                
            new_log = BiometricLog.objects.create(
                user=request.user,
                weight_lbs=weight_lbs,
                bmi=bmi
            )
            return Response({"status": "success", "id": new_log.id})
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            
    elif request.method == 'GET':
        logs = BiometricLog.objects.filter(user=request.user).order_by('created_at')
        data = [{
            'id': log.id,
            'weight_lbs': log.weight_lbs,
            'bmi': log.bmi,
            'date': log.created_at.strftime('%m/%d')
        } for log in logs]
        return Response({"status": "success", "data": data})


class GoogleAuthView(APIView):
    """
    Verifies a Google ID token from the mobile client and issues a DRF app token.

    Flow:
    1. Receive the raw idToken from the React Native GoogleSignin.signIn() call.
    2. Verify it with Google's public keys via google.oauth2.id_token.verify_oauth2_token().
       This confirms the token was issued by Google for our exact client ID and has not expired.
    3. Extract email, given_name, family_name from the verified claims.
    4. get_or_create a Django User whose username is the email address.
       - New users receive an auto-set unusable password (they'll always log in via Google).
       - New users get a UserProfile seeded with 5 free AI tokens.
    5. get_or_create a DRF Token for the user and return it alongside the email.

    Request body: { "id_token": "<Google JWT string>" }
    Response:     { "status": "success", "token": "<DRF token key>", "email": "<user email>" }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        raw_id_token = request.data.get('id_token')
        if not raw_id_token:
            return Response(
                {"error": "id_token is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ── Step 1: Verify the token with Google ─────────────────────────────────
        try:
            id_info = id_token.verify_oauth2_token(
                raw_id_token,
                google_requests.Request(),
                settings.GOOGLE_WEB_CLIENT_ID,
            )
        except ValueError as e:
            # Token is invalid, expired, or not intended for this client.
            return Response(
                {"error": f"Invalid Google token: {e}"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # ── Step 2: Extract claims ────────────────────────────────────────────────
        email      = id_info.get('email', '')
        first_name = id_info.get('given_name', '')
        last_name  = id_info.get('family_name', '')

        if not email:
            return Response(
                {"error": "Google token did not contain an email claim."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ── Step 3: Resolve user ──────────────────────────────────────────────────
        user, created = User.objects.get_or_create(
            username=email,
            defaults={
                'email': email,
                'first_name': first_name,
                'last_name': last_name,
            }
        )

        if created:
            # Google-only accounts have no usable password.
            user.set_unusable_password()
            user.save()

            # Seed a UserProfile with free AI tokens for new sign-ups.
            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.ai_tokens = 5
            profile.save()

        # ── Step 4: Issue DRF token ───────────────────────────────────────────────
        token, _ = Token.objects.get_or_create(user=user)

        return Response({
            "status": "success",
            "token": token.key,
            "email": user.email,
        }, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_workout_session(request):
    """
    Creates a new active session and returns the session ID.
    """
    session = WorkoutSession.objects.create(user=request.user, is_active=True)
    return Response({"status": "success", "session_id": session.id})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def finish_workout_session(request, pk):
    """
    Accepts an array of time-stamped HR JSON objects, closes the session (end_time=now, is_active=False), and saves the time-series data.
    """
    try:
        session = WorkoutSession.objects.get(pk=pk, user=request.user, is_active=True)
    except WorkoutSession.DoesNotExist:
        return Response({"error": "Active session not found"}, status=status.HTTP_404_NOT_FOUND)

    hr_data = request.data.get('hr_data', [])
    
    data = {
        'is_active': False,
        'end_time': timezone.now(),
        'hr_data': hr_data
    }
    
    serializer = WorkoutSessionSerializer(session, data=data, partial=True)
    
    if serializer.is_valid():
        serializer.save()
        return Response({"status": "success", "message": "Session finished and HR data saved."})
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def log_bodyweight(request):
    """
    Logs a new bodyweight entry for the authenticated user.
    """
    weight = request.data.get('weight')
    if weight is None:
        return Response({"error": "Weight is required"}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        weight_val = float(weight)
    except (ValueError, TypeError):
        return Response({"error": "Invalid weight value"}, status=status.HTTP_400_BAD_REQUEST)
        
    entry = BodyWeight.objects.create(user=request.user, weight=weight_val)
    serializer = BodyWeightSerializer(entry)
    return Response(serializer.data, status=status.HTTP_201_CREATED)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_latest_weight(request):
    """
    Retrieves the latest bodyweight entry for the authenticated user.
    """
    latest = BodyWeight.objects.filter(user=request.user).order_by('-date', '-id').first()
    if latest:
        serializer = BodyWeightSerializer(latest)
        return Response(serializer.data)
    return Response({"weight": None})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_water(request):
    """
    Logs a new water intake entry.
    """
    print(f"DEBUG: add_water hit with data: {request.data}")
    amount = request.data.get('amount')
    if amount is None:
        return Response({"error": "Amount is required"}, status=status.HTTP_400_BAD_REQUEST)
    
    WaterLog.objects.create(user=request.user, amount_oz=int(amount))
    return Response({"status": "success", "amount_added": amount})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_today_water(request):
    """
    Returns the total water consumed today.
    """
    print(f"DEBUG: get_today_water hit for user: {request.user}")
    today = timezone.now().date()
    total = WaterLog.objects.filter(
        user=request.user, 
        created_at__date=today
    ).aggregate(total=Sum('amount_oz'))['total'] or 0
    
    return Response({"total": total})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def delete_account(request):
    """
    Verifies the user's password and deletes their account.
    """
    password = request.data.get('password')
    if not password:
        return Response({"error": "Password is required"}, status=status.HTTP_400_BAD_REQUEST)
    
    user = request.user
    if not user.check_password(password):
        return Response({"error": "Invalid password"}, status=status.HTTP_401_UNAUTHORIZED)
    
    user.delete()
    return Response({"status": "Account deleted successfully"}, status=status.HTTP_200_OK)
