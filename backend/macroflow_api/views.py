from rest_framework.permissions import AllowAny
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
    queryset = User.objects.all()
    serializer_class = UserSerializer

class BodyWeightViewSet(viewsets.ModelViewSet):
    queryset = BodyWeight.objects.all()
    serializer_class = BodyWeightSerializer

class MuscleGroupViewSet(viewsets.ModelViewSet):
    queryset = MuscleGroup.objects.all()
    serializer_class = MuscleGroupSerializer

class ExerciseViewSet(viewsets.ModelViewSet):
    queryset = Exercise.objects.all()
    serializer_class = ExerciseSerializer

class WorkoutSessionViewSet(viewsets.ModelViewSet):
    queryset = WorkoutSession.objects.all()
    serializer_class = WorkoutSessionSerializer

class ExerciseSetViewSet(viewsets.ModelViewSet):
    queryset = ExerciseSet.objects.all()
    serializer_class = ExerciseSetSerializer

class FoodItemViewSet(viewsets.ModelViewSet):
    queryset = FoodItem.objects.all()
    serializer_class = FoodItemSerializer

class FoodLogViewSet(viewsets.ModelViewSet):
    queryset = FoodLog.objects.all()
    serializer_class = FoodLogSerializer

class WaterLogViewSet(viewsets.ModelViewSet):
    queryset = WaterLog.objects.all()
    serializer_class = WaterLogSerializer

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def scan_barcode(request):
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
    return round(val, 1) if val is not None else 0.0

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def log_workout(request):
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
    logs = WorkoutLog.objects.filter(user=request.user).order_by('-created_at')
    serializer = WorkoutLogSerializer(logs, many=True)
    return Response({"status": "success", "data": serializer.data})

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_nutrition_log(request, pk):
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
    try:
        log = NutritionLog.objects.get(pk=pk, user=request.user)
        log.delete()
        return Response({"status": "success", "message": "Deleted successfully"})
    except NutritionLog.DoesNotExist:
        return Response({"status": "error", "message": "Log not found or unauthorized"}, status=status.HTTP_404_NOT_FOUND)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_workout_log(request, pk):
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
    try:
        log = WorkoutLog.objects.get(pk=pk, user=request.user)
        log.delete()
        return Response({"status": "success", "message": "Deleted successfully"})
    except WorkoutLog.DoesNotExist:
        return Response({"status": "error", "message": "Log not found or unauthorized"}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def log_water(request):
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
    today = timezone.localdate()
    logs_today = WaterLog.objects.filter(user=request.user, created_at__date=today)
    
    total_oz = logs_today.aggregate(total=Sum('amount_oz'))['total'] or 0
    
    return Response({"status": "success", "data": {"total_oz": total_oz}})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def log_nutrition(request):
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
    recipes = SavedRecipe.objects.filter(user=request.user).order_by('-created_at')
    serializer = SavedRecipeSerializer(recipes, many=True)
    return Response({"status": "success", "data": serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_grocery_list(request):
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

@api_view(['POST', 'GET'])
@permission_classes([IsAuthenticated])
def biometrics_view(request):
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
