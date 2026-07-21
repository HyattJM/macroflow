/**
 * MacroEngine Utility
 * 
 * Logic Rationale:
 * - BMR: Mifflin-St Jeor Equation for better accuracy in active populations.
 * - TDEE: Applies activity multipliers to BMR.
 * - Goal Adjustments: Offsets TDEE based on fat loss or muscle gain objectives.
 * - Macro Splits: Dynamic percentage mapping based on specific diet protocols.
 */

export interface UserStats {
  weight_lbs: number;
  height_inches: number;
  age: number;
  gender: 'male' | 'female';
  activity_level: string;
  goal: string;
  diet_type: string;
}

export interface MacroResults {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  'Sedentary': 1.2,
  'Lightly Active': 1.375,
  'Moderately Active': 1.55,
  'Very Active': 1.725,
  'Extra Active': 1.9
};

const DIET_RATIOS: Record<string, { p: number, c: number, f: number }> = {
  'Keto': { p: 0.25, c: 0.05, f: 0.70 },
  'Paleo': { p: 0.30, c: 0.20, f: 0.50 },
  'Balanced': { p: 0.30, c: 0.40, f: 0.30 },
  'High Protein': { p: 0.45, c: 0.25, f: 0.30 }
};

export const calculateMacros = (stats: UserStats): MacroResults => {
  // Convert to Metric for formulas
  const weightKg = stats.weight_lbs * 0.453592;
  const heightCm = stats.height_inches * 2.54;

  // 1. Calculate BMR (Mifflin-St Jeor)
  let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * stats.age);
  bmr = stats.gender === 'male' ? bmr + 5 : bmr - 161;

  // 2. Apply Activity Multiplier
  const multiplier = ACTIVITY_MULTIPLIERS[stats.activity_level] || 1.2;
  let tdee = bmr * multiplier;

  // 3. Apply Goal Offset
  if (stats.goal === 'Lose Weight') tdee -= 500;
  if (stats.goal === 'Gain Muscle') tdee += 300;

  const targetCalories = Math.round(tdee);

  // 4. Calculate Macro Breakdown
  const ratio = DIET_RATIOS[stats.diet_type] || DIET_RATIOS['Balanced'];
  
  // 4 kcal/g for Protein and Carbs, 9 kcal/g for Fat
  const protein = Math.round((targetCalories * ratio.p) / 4);
  const carbs = Math.round((targetCalories * ratio.c) / 4);
  const fat = Math.round((targetCalories * ratio.f) / 9);

  return {
    calories: targetCalories,
    protein,
    carbs,
    fat
  };
};
