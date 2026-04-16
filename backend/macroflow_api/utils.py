import re

def calculate_calories_burned(exercise_name, duration_minutes, weight_kg):
    """
    Calculates calories burned based on MET values for various exercises.
    Formula: (MET * 3.5 * weight_kg / 200) * duration_minutes
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
