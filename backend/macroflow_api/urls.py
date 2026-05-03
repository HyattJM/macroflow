"""
URL configuration for the MacroFlow API.

This module defines the routing table for the application, mapping endpoints 
to their respective ViewSets and function-based views. It uses a combination 
of REST Framework Routers for standard CRUD operations and explicit path 
mappings for custom AI and calculation-heavy logic.
"""

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
    # Food & Nutrition
    path('scan-barcode/', views.scan_barcode, name='scan-barcode'),
    path('analyze-nutrition/', views.analyze_nutrition, name='analyze-nutrition'),
    path('scan-keto/', views.scan_keto, name='scan-keto'),
    path('nutrition-logs/', views.get_nutrition_logs, name='nutrition-logs'),
    path('nutrition-logs/<int:pk>/update/', views.update_nutrition_log, name='update-nutrition-log'),
    path('nutrition-logs/<int:pk>/delete/', views.delete_nutrition_log, name='delete-nutrition-log'),
    path('daily-summary/', views.get_daily_summary, name='daily-summary'),
    path('log-nutrition/', views.log_nutrition, name='log-nutrition'),
    
    # Workout & Fitness
    path('log-workout/', views.log_workout, name='log-workout'),
    path('workouts/', views.get_workouts, name='workouts'),
    path('workouts/<int:pk>/update/', views.update_workout_log, name='update-workout-log'),
    path('workouts/<int:pk>/delete/', views.delete_workout_log, name='delete-workout-log'),
    path('exercise-max/', views.get_exercise_max, name='exercise-max'),
    path('workout-history/', views.get_workout_history, name='workout-history'),
    
    # Hydration
    path('log-water/', views.log_water, name='log-water'),
    path('today-water/', views.get_today_water, name='today-water'),
    
    # AI Chef & Recipes
    path('wallet/', views.get_wallet, name='get-wallet'),
    path('generate-recipe/', views.generate_recipe, name='generate-recipe'),
    path('save-recipe/', views.save_recipe, name='save-recipe'),
    path('saved-recipes/', views.get_saved_recipes, name='saved-recipes'),
    path('generate-grocery-list/', views.generate_grocery_list, name='generate-grocery-list'),
    path('generate-chef-meal/', views.generate_chef_meal, name='generate-chef-meal'),
    path('tokens/', views.get_tokens, name='get-tokens'),
    
    # Auth & Onboarding
    path('register/', views.register, name='register'),
    path('login/', views.login_view, name='login'),
    path('auth/google/', views.GoogleAuthView.as_view(), name='google-auth'),
    path('submit-onboarding/', views.submit_onboarding, name='submit-onboarding'),
    
    # User Profile & Biometrics
    path('biometrics/', views.biometrics_view, name='biometrics'),
    path('profile/', views.profile_view, name='profile'),
]
