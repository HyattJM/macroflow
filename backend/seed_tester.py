import os
import django
from datetime import timedelta
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from macroflow_api.models import UserProfile, WorkoutLog, NutritionLog

User = get_user_model()

def seed_data():
    # 1. Clean slate for test
    User.objects.filter(username='test').delete()
    
    # 2. Create User and Token
    user = User(username='test')
    user.set_password('testpass')
    user.save()
    
    Token.objects.get_or_create(user=user)
    
    # 3. Update User Profile
    UserProfile.objects.filter(user=user).update(
        age=25, gender='male', weight_lbs=180, height_inches=70,
        activity_level='moderately_active', goal='lose',
        daily_calories_goal=2000, daily_protein_goal=150,
        daily_fat_goal=140, daily_net_carbs_goal=30, ai_tokens=100
    )
    
    print("Tester account created. Injecting 14 days of data...")
    
    now = timezone.now()
    
    # 4. Inject 14 Days of Progressive Workouts & Meals
    for i in range(14, -1, -1):
        target_date = now - timedelta(days=i)
        
        # Progressive Overload Math (Weights go up over time)
        bench_weight = 185 + ((14 - i) * 5)  # 185 -> 255
        squat_weight = 225 + ((14 - i) * 5)  # 225 -> 295
        curl_weight = 30 + ((14 - i) * 2.5)  # 30 -> 65
        
        # Workouts
        workouts = [
            ("Flat Barbell Bench Press", bench_weight, 5, 5),
            ("Back Squat", squat_weight, 3, 8),
            ("Dumbbell Curl", curl_weight, 4, 10)
        ]
        
        for name, weight, sets, reps in workouts:
            log = WorkoutLog.objects.create(
                user=user, exercise_name=name, weight=weight, 
                sets=sets, reps=reps, duration_minutes=15, burned_calories=120
            )
            # Override auto_now_add
            log.created_at = target_date
            log.save()
            
        # Keto Meals (hitting ~2000 cals, low carb)
        meals = [
            ("3 Eggs & Bacon", 450, 25, 2, 35),
            ("Ribeye Steak & Butter", 850, 65, 0, 60),
            ("Chicken Thighs & Avocado", 600, 50, 6, 40)
        ]
        
        for food_name, cals, pro, carbs, fat in meals:
            nlog = NutritionLog.objects.create(
                user=user, food_name=food_name, calories=cals, 
                protein=pro, carbs=carbs, fat=fat
            )
            nlog.created_at = target_date
            nlog.save()
            
    print("Success! Database seeded.")

if __name__ == '__main__':
    seed_data()
