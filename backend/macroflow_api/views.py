from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import User, BodyWeight, MuscleGroup, Exercise, WorkoutSession, ExerciseSet, FoodItem, FoodLog, WaterLog
from .serializers import (UserSerializer, BodyWeightSerializer, MuscleGroupSerializer, 
                          ExerciseSerializer, WorkoutSessionSerializer, ExerciseSetSerializer, 
                          FoodItemSerializer, FoodLogSerializer, WaterLogSerializer)
import requests

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
def scan_barcode(request):
    barcode = request.data.get('barcode')
    if not barcode:
        return Response({"error": "Barcode is required"}, status=status.HTTP_400_BAD_REQUEST)
    
    # 1. Check local DB
    try:
        food = FoodItem.objects.get(barcode=barcode)
        serializer = FoodItemSerializer(food)
        return Response({"status": "success", "data": serializer.data, "source": "local"})
    except FoodItem.DoesNotExist:
        pass
        
    # 2. Query external API (Placeholder for Edamam/Nutritionix)
    # This is a mocked response since we don't have an API key yet
    # In a real app, you would make a requests.get() to the API provider
    mocked_api_response = {
        "name": f"Mocked Scanned Item ({barcode})",
        "barcode": barcode,
        "calories": 150.0,
        "protein": 5.0,
        "carbs": 20.0,
        "fat": 5.0
    }
    
    # 3. Save to local DB so future scans are fast
    new_food = FoodItem.objects.create(**mocked_api_response)
    serializer = FoodItemSerializer(new_food)
    return Response({"status": "success", "data": serializer.data, "source": "external"})
