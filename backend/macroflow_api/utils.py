import re

def calculate_calories_burned(exercise_name, duration_minutes, weight_kg):
    """
    Estimates total calories expended during a specific physical activity.
    
    Logic:
    Uses the Metabolic Equivalent of Task (MET) formula:
    Calories = (MET * 3.5 * weight_kg / 200) * duration_minutes

    MET Values Rationale:
    - MET is a ratio of your working metabolic rate relative to your resting metabolic rate.
    - One MET is the energy you spend sitting at rest.
    - This function maps common exercise keywords (like 'running', 'deadlift') to 
      validated MET constants.
    
    Args:
        exercise_name (str): The name of the exercise to look up MET for.
        duration_minutes (int): How long the exercise was performed.
        weight_kg (float): User's weight in kilograms.

    Returns:
        float: Total calories burned, rounded to 2 decimal places.
    """
    
    # Mapping table of exercise keywords to MET values
    MET_VALUES = {
        'running': 9.8,
        'jogging': 7.0,
        'walking': 3.5,
        'cycling': 7.5,
        'swimming': 7.0,
        'bench press': 5.0,
        'squat': 5.0,
        'deadlift': 5.0,
        'weight lifting': 4.5,
        'strength training': 5.0,
        'hiit': 8.0,
        'yoga': 2.5,
        'pilates': 3.0,
        'jump rope': 11.0,
        'stairs': 8.0,
        'hiking': 6.0,
        'rowing': 7.0,
    }
    
    name_lower = exercise_name.lower()
    met = 4.0 # Baseline for moderate activity if no match
    
    for keyword, value in MET_VALUES.items():
        if keyword in name_lower:
            met = value
            break
            
    # Formula implementation
    # Calories = (MET * 3.5 * weight_kg / 200) * duration
    burned = (met * 3.5 * weight_kg / 200) * duration_minutes
    return round(burned, 2)
