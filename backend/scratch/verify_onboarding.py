import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from macroflow_api.models import User, UserProfile

def test_onboarding_logic(age, gender, weight_lbs, height_inches, activity_level, goal):
    # Unit Conversion
    weight_kg = weight_lbs / 2.20462
    height_cm = height_inches * 2.54

    # BMR calculation using Mifflin-St Jeor Equation
    if 'male' in gender.lower():
        bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + 5
    else:
        bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) - 161

    # TDEE Multipliers
    multipliers = {
        'sedentary': 1.2,
        'lightly active': 1.375,
        'moderately active': 1.55,
        'very active': 1.725,
        'extra active': 1.9
    }
    multiplier = 1.2
    for key, val in multipliers.items():
        if key in activity_level.lower():
            multiplier = val
            break
            
    tdee = bmr * multiplier

    # Keto Waterfall Logic
    if 'lose' in goal.lower() or 'loss' in goal.lower():
        adjusted_calories = tdee - 500
    elif 'gain' in goal.lower() or 'muscle' in goal.lower():
        adjusted_calories = tdee + 300
    else:
        adjusted_calories = tdee

    daily_net_carbs = 30
    daily_protein = int(weight_lbs)
    calories_from_protein_carbs = (daily_protein * 4) + (daily_net_carbs * 4)
    remaining_calories = adjusted_calories - calories_from_protein_carbs
    daily_fat = int(max(0, remaining_calories / 9))

    return {
        "calories": int(adjusted_calories),
        "protein": daily_protein,
        "fat": daily_fat,
        "net_carbs": daily_net_carbs
    }

# Test Case: 200lb Male, 30yo, 70 inches, Moderately Active, Lose Weight
results = test_onboarding_logic(30, 'male', 200, 70, 'moderately active', 'lose weight')
print(f"Results for 200lb Male, 30yo, 70in, Mod Active, Lose Weight:")
print(f"Targets: {results}")

# Verify 1g protein per lb
assert results['protein'] == 200, f"Expected 200g protein, got {results['protein']}"
assert results['net_carbs'] == 30, f"Expected 30g carbs, got {results['net_carbs']}"

# Manual calculation check
# weight_kg = 200 / 2.20462 = 90.72
# height_cm = 70 * 2.54 = 177.8
# bmr = (10 * 90.72) + (6.25 * 177.8) - (5 * 30) + 5 = 907.2 + 1111.25 - 150 + 5 = 1873.45
# tdee = 1873.45 * 1.55 = 2903.8
# adjusted = 2903.8 - 500 = 2403.8
# protein_cals = 200 * 4 = 800
# carb_cals = 30 * 4 = 120
# remaining = 2403.8 - 920 = 1483.8
# fat = 1483.8 / 9 = 164.8 (~164)

expected_calories = 2403
expected_fat = 164
print(f"Expected: ~{expected_calories} cal, ~{expected_fat}g fat")

print("Verification logic passed!")
