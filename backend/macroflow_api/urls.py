from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'users', views.UserViewSet)
router.register(r'bodyweights', views.BodyWeightViewSet)
router.register(r'musclegroups', views.MuscleGroupViewSet)
router.register(r'exercises', views.ExerciseViewSet)
router.register(r'workoutsessions', views.WorkoutSessionViewSet)
router.register(r'exercisesets', views.ExerciseSetViewSet)
router.register(r'fooditems', views.FoodItemViewSet)
router.register(r'foodlogs', views.FoodLogViewSet)
router.register(r'waterlogs', views.WaterLogViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('scan-barcode/', views.scan_barcode, name='scan-barcode'),
]
