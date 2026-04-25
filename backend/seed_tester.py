import os
import csv
import django
from datetime import datetime, timezone as dt_timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from macroflow_api.models import UserProfile, WorkoutLog

User = get_user_model()

def seed_data():
    User.objects.filter(username='test').delete()
    
    user = User(username='test')
    user.set_password('testpass')
    user.save()
    
    Token.objects.get_or_create(user=user)
    
    UserProfile.objects.filter(user=user).update(
        age=26, gender='male', weight_lbs=190, height_inches=72,
        activity_level='moderately_active', goal='lose',
        daily_calories_goal=2200, daily_protein_goal=160,
        daily_fat_goal=150, daily_net_carbs_goal=50, ai_tokens=100
    )
    
    csv_file = 'FitNotes_Export_2026_04_25_05_03_34.csv'
    
    if not os.path.exists(csv_file):
        print(f"\n[ERROR] Could not find {csv_file}\n")
        return

    print("Parsing ALL individual sets from FitNotes...")

    total_logs = 0
    
    with open(csv_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            date_str = row['Date'].strip()
            exercise = row['Exercise'].strip()
            
            try:
                weight = float(row['Weight'])
                reps = int(row['Reps'])
            except (ValueError, TypeError):
                continue
                
            target_date = datetime.strptime(date_str, '%Y-%m-%d').replace(hour=12, minute=0, tzinfo=dt_timezone.utc)
            
            log = WorkoutLog.objects.create(
                user=user, 
                exercise_name=exercise, 
                weight=weight, 
                sets=1, # FitNotes logs 1 row per set
                reps=reps, 
                duration_minutes=0, 
                burned_calories=0 
            )
            log.created_at = target_date
            log.save()
            total_logs += 1

    print(f"Success! Crushed it. Processed {total_logs} INDIVIDUAL SETS into your history.")

if __name__ == '__main__':
    seed_data()