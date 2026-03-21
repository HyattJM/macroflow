import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scale, Flame, Beef, Dumbbell, Check } from "lucide-react";
import { api, DEFAULT_USER_ID } from "@/lib/api";

// ─── Unit helpers ──────────────────────────────────────────────────────────
const lbsToKg = (lbs: number) => lbs * 0.453592;
const inToCm  = (i: number)   => i * 2.54;
const kgToLbs = (kg: number)  => kg * 2.20462;
const cmToIn  = (cm: number)  => cm / 2.54;

function ls(key: string, fallback = "") { return localStorage.getItem(key) ?? fallback; }
function lsSave(key: string, val: string) { localStorage.setItem(key, val); }

// ─── Shared UI pieces ──────────────────────────────────────────────────────
function Field({
  label, value, onChange, unit, step = 1, placeholder = "0",
}: {
  label: string; value: string; onChange: (v: string) => void;
  unit?: string; step?: number; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      <div className="flex items-center space-x-2">
        <input type="number" step={step} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        {unit && <span className="text-sm text-muted-foreground font-medium w-10 shrink-0">{unit}</span>}
      </div>
    </div>
  );
}

function Row({ label, value, color = "text-foreground" }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`font-bold text-sm ${color}`}>{value}</span>
    </div>
  );
}

function SavedBadge({ msg }: { msg: string }) {
  return (
    <div className="flex items-center space-x-2 text-green-400 text-xs font-semibold animate-in fade-in duration-300">
      <Check className="w-3.5 h-3.5" /><span>{msg}</span>
    </div>
  );
}

// ─── BMI Section ───────────────────────────────────────────────────────────
function BMICard({
  isMetric, weightDisplay, heightDisplay, onWeightChange, onHeightChange,
}: {
  isMetric: boolean;
  weightDisplay: string; heightDisplay: string;
  onWeightChange: (v: string) => void; onHeightChange: (v: string) => void;
}) {
  const [saved, setSaved] = useState(false);

  const wKg = isMetric ? parseFloat(weightDisplay) : lbsToKg(parseFloat(weightDisplay));
  const hM  = (isMetric ? parseFloat(heightDisplay) : inToCm(parseFloat(heightDisplay))) / 100;
  const bmi = wKg > 0 && hM > 0 ? wKg / (hM * hM) : null;

  const getCategory = (b: number) => {
    if (b < 18.5) return { label: "Underweight", color: "text-blue-400" };
    if (b < 25)   return { label: "Normal weight", color: "text-green-400" };
    if (b < 30)   return { label: "Overweight", color: "text-yellow-400" };
    return          { label: "Obese", color: "text-red-400" };
  };
  const cat = bmi ? getCategory(bmi) : null;

  const handleSave = () => {
    if (!bmi) return;
    lsSave("metrix_saved_bmi", JSON.stringify({ bmi: +bmi.toFixed(1), date: new Date().toISOString() }));
    setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-lg">
          <Scale className="w-5 h-5 text-blue-400" /><span>BMI Calculator</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">weight(kg) ÷ height(m)²</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Weight (${isMetric ? "kg" : "lbs"})`} value={weightDisplay}
            onChange={onWeightChange} unit={isMetric ? "kg" : "lbs"} step={0.1} />
          <Field label={`Height (${isMetric ? "cm" : "in"})`} value={heightDisplay}
            onChange={onHeightChange} unit={isMetric ? "cm" : "in"} step={isMetric ? 0.5 : 0.25} />
        </div>
        {bmi && cat && (
          <div className="p-4 rounded-xl bg-secondary/30 space-y-3">
            <div className="text-center">
              <span className={`text-5xl font-black ${cat.color}`}>{bmi.toFixed(1)}</span>
              <p className={`text-sm font-semibold mt-1 ${cat.color}`}>{cat.label}</p>
            </div>
            <div>
              <Row label="Underweight" value="< 18.5"      color="text-blue-400" />
              <Row label="Normal"      value="18.5 – 24.9" color="text-green-400" />
              <Row label="Overweight"  value="25 – 29.9"   color="text-yellow-400" />
              <Row label="Obese"       value="≥ 30"        color="text-red-400" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <Button size="sm" variant="outline" className="text-xs" onClick={handleSave}>Save BMI</Button>
              {saved && <SavedBadge msg="BMI saved!" />}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── TDEE Section ──────────────────────────────────────────────────────────
const ACTIVITY_FACTORS = [
  { label: "Sedentary (desk job, no exercise)",     value: 1.2 },
  { label: "Lightly Active (1–3 days/week)",        value: 1.375 },
  { label: "Moderately Active (3–5 days/week)",     value: 1.55 },
  { label: "Very Active (6–7 days/week)",           value: 1.725 },
  { label: "Extremely Active (athlete / physical)", value: 1.9 },
];

function TDEECard({
  isMetric, weightDisplay, heightDisplay, age, sex, activity, bmr, tdee,
  onWeightChange, onHeightChange, onAgeChange, onSexChange, onActivityChange,
}: {
  isMetric: boolean;
  weightDisplay: string; heightDisplay: string;
  age: string; sex: "male" | "female"; activity: number;
  bmr: number | null; tdee: number | null;
  onWeightChange: (v: string) => void; onHeightChange: (v: string) => void;
  onAgeChange: (v: string) => void; onSexChange: (v: "male" | "female") => void;
  onActivityChange: (v: number) => void;
}) {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!tdee) return;
    lsSave("metrix_saved_tdee", JSON.stringify({ tdee: Math.round(tdee), bmr: Math.round(bmr!), date: new Date().toISOString() }));
    setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-lg">
          <Flame className="w-5 h-5 text-orange-400" /><span>TDEE Calculator</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Mifflin-St Jeor equation</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex rounded-lg border border-input overflow-hidden">
          {(["male", "female"] as const).map((s) => (
            <button key={s} onClick={() => onSexChange(s)}
              className={`flex-1 py-2 text-sm font-medium transition-colors capitalize ${
                sex === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label={`Weight (${isMetric ? "kg" : "lbs"})`} value={weightDisplay}
            onChange={onWeightChange} unit={isMetric ? "kg" : "lbs"} step={0.1} />
          <Field label={`Height (${isMetric ? "cm" : "in"})`} value={heightDisplay}
            onChange={onHeightChange} unit={isMetric ? "cm" : "in"} step={isMetric ? 0.5 : 0.25} />
          <Field label="Age" value={age} onChange={onAgeChange} unit="yrs" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Activity Level</label>
          <select value={activity} onChange={(e) => onActivityChange(Number(e.target.value))}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {ACTIVITY_FACTORS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        {tdee && bmr && (
          <div className="p-4 rounded-xl bg-secondary/30 space-y-2">
            <div className="text-center mb-3">
              <span className="text-5xl font-black text-orange-400">{Math.round(tdee)}</span>
              <p className="text-sm text-muted-foreground mt-1">kcal / day</p>
            </div>
            <Row label="BMR"               value={`${Math.round(bmr)} kcal`} />
            <Row label="TDEE"              value={`${Math.round(tdee)} kcal`}        color="text-orange-400" />
            <Row label="Weight loss (−500)" value={`${Math.round(tdee - 500)} kcal`} color="text-blue-400" />
            <Row label="Weight gain (+300)" value={`${Math.round(tdee + 300)} kcal`} color="text-green-400" />
            <div className="flex items-center justify-between pt-1">
              <Button size="sm" variant="outline" className="text-xs" onClick={handleSave}>Save TDEE</Button>
              {saved && <SavedBadge msg="TDEE saved! Keto updated." />}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Keto Section ──────────────────────────────────────────────────────────
const GOALS = [
  { label: "Maintenance (0%)",      deficit: 0 },
  { label: "Light Cut (−10%)",      deficit: 0.1 },
  { label: "Moderate Cut (−20%)",   deficit: 0.2 },
  { label: "Aggressive Cut (−30%)", deficit: 0.3 },
  { label: "Lean Bulk (+10%)",      deficit: -0.1 },
];

function KetoCard({ computedTdee }: { computedTdee: number | null }) {
  // Use live computed TDEE if available; otherwise fallback to what was manually saved
  const [overrideTdee, setOverrideTdeeRaw] = useState(() => {
    const saved = ls("metrix_saved_tdee");
    if (saved) { try { return String(JSON.parse(saved).tdee); } catch {} }
    return "";
  });
  const [goal, setGoalRaw]  = useState(() => parseFloat(ls("metrix_calc_keto_goal")) || 0.2);
  const [saved, setSaved]   = useState(false);
  const [saving, setSaving] = useState(false);

  const setOverrideTdee = (v: string) => { setOverrideTdeeRaw(v); lsSave("metrix_calc_keto_override_tdee", v); };
  const setGoal         = (v: number) => { setGoalRaw(v);         lsSave("metrix_calc_keto_goal", String(v)); };

  // Live TDEE takes precedence; user can still override
  const activeTdee = computedTdee ?? parseFloat(overrideTdee);
  const t = activeTdee > 0 ? activeTdee : 0;

  let result: { calories: number; carbs: number; protein: number; fat: number } | null = null;
  if (t > 0) {
    const cals = t * (1 - goal);
    result = {
      calories: Math.round(cals),
      carbs:    Math.round((cals * 0.05) / 4),
      protein:  Math.round((cals * 0.25) / 4),
      fat:      Math.round((cals * 0.70) / 9),
    };
  }

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await api.patch(`/users/${DEFAULT_USER_ID}/`, {
        daily_calorie_goal: result.calories,
        daily_protein_goal: result.protein,
        daily_carbs_goal:   result.carbs,
        daily_fat_goal:     result.fat,
      });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error("Failed to save keto macros", err); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-lg">
          <Beef className="w-5 h-5 text-green-400" /><span>Keto Macros</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">5% carbs · 25% protein · 70% fat</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Live TDEE display or manual override */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            TDEE {computedTdee ? <span className="text-green-400 normal-case ml-1">← auto-filled from TDEE calculator</span> : ""}
          </label>
          {computedTdee ? (
            <div className="h-10 rounded-md border border-green-500/30 bg-green-500/5 px-3 flex items-center">
              <span className="text-sm font-semibold text-green-400">{Math.round(computedTdee)} kcal</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <input type="number" step={1} value={overrideTdee} placeholder="e.g. 2500"
                onChange={(e) => setOverrideTdee(e.target.value)}
                className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              <span className="text-sm text-muted-foreground font-medium w-10 shrink-0">kcal</span>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Goal</label>
          <select value={goal} onChange={(e) => setGoal(Number(e.target.value))}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {GOALS.map((g) => <option key={g.deficit} value={g.deficit}>{g.label}</option>)}
          </select>
        </div>
        {result && (
          <div className="p-4 rounded-xl bg-secondary/30 space-y-2">
            <div className="text-center mb-3">
              <span className="text-5xl font-black text-green-400">{result.calories}</span>
              <p className="text-sm text-muted-foreground mt-1">kcal / day</p>
            </div>
            <Row label="Carbs (5%)"    value={`${result.carbs} g`}    color="text-yellow-400" />
            <Row label="Protein (25%)" value={`${result.protein} g`}  color="text-blue-400" />
            <Row label="Fat (70%)"     value={`${result.fat} g`}      color="text-red-400" />
            <div className="flex items-center justify-between pt-1">
              <Button size="sm" variant="outline" className="text-xs" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save as Nutrition Goals"}
              </Button>
              {saved && <SavedBadge msg="Goals updated in Settings & Dashboard!" />}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── 1RM Section ───────────────────────────────────────────────────────────
const PERCENTAGES = [100, 95, 90, 85, 80, 75, 70];

function OneRMCard({ isMetric }: { isMetric: boolean }) {
  const [weight, setWeight] = useState("");
  const [reps,   setReps]   = useState("");
  const wUnit  = isMetric ? "kg" : "lbs";
  const wInput = parseFloat(weight);
  const r      = parseFloat(reps);
  const oneRM  = wInput > 0 && r >= 1 && r < 37 ? wInput / (1.0278 - 0.0278 * r) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-lg">
          <Dumbbell className="w-5 h-5 text-purple-400" /><span>One-Rep Max (1RM)</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Brzycki: weight ÷ (1.0278 − 0.0278 × reps)</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Weight (${wUnit})`} value={weight} onChange={setWeight} unit={wUnit} step={isMetric ? 0.5 : 1} />
          <Field label="Reps" value={reps} onChange={setReps} placeholder="1–36" />
        </div>
        {reps !== "" && r >= 37 && <p className="text-xs text-yellow-500">⚠ Less accurate above 36 reps.</p>}
        {oneRM !== null && (
          <div className="p-4 rounded-xl bg-secondary/30 space-y-2">
            <div className="text-center mb-3">
              <span className="text-5xl font-black text-purple-400">{oneRM.toFixed(1)}</span>
              <p className="text-sm text-muted-foreground mt-1">{wUnit} estimated 1RM</p>
            </div>
            {PERCENTAGES.map((pct) => (
              <Row key={pct} label={`${pct}% of 1RM`}
                value={`${(oneRM * pct / 100).toFixed(1)} ${wUnit}`}
                color={pct === 100 ? "text-purple-400" : "text-foreground"} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page (lifted shared state) ────────────────────────────────────────────
export function Calculators() {
  const isMetric = localStorage.getItem("metrix_unit_system") !== "imperial";

  // Shared state stored in kg / cm internally; display in user's units
  // resolveH validates: >= 100 cm, or converts from inches if 48-96
  function resolveH(raw: number): number {
    if (raw >= 100 && raw <= 250) return raw;
    if (raw >= 48  && raw < 100)  return raw * 2.54;
    return 0;
  }
  const [weightKg, setWeightKgRaw] = useState<number>(() => parseFloat(ls("metrix_calc_weight_kg")) || 0);
  const [heightCm, setHeightCmRaw] = useState<number>(() => resolveH(parseFloat(ls("metrix_calc_height_cm")) || 0));
  const [age,      setAgeRaw]      = useState<string>(() => ls("metrix_calc_age"));
  const [sex,      setSexRaw]      = useState<"male" | "female">(() => (ls("metrix_calc_sex") as any) || "male");
  const [activity, setActivityRaw] = useState<number>(() => parseFloat(ls("metrix_calc_activity")) || 1.55);

  // Derived display values (in user's units)
  const weightDisplay = weightKg > 0 ? (isMetric ? weightKg : kgToLbs(weightKg)).toFixed(1) : "";
  const heightDisplay = heightCm > 0 ? (isMetric ? heightCm : cmToIn(heightCm)).toFixed(1)  : "";

  // Setters — convert from display unit back to kg/cm and persist
  const setWeight = useCallback((displayVal: string) => {
    const n = parseFloat(displayVal);
    if (isNaN(n)) { setWeightKgRaw(0); lsSave("metrix_calc_weight_kg", "0"); return; }
    const kg = isMetric ? n : lbsToKg(n);
    setWeightKgRaw(kg);
    lsSave("metrix_calc_weight_kg", kg.toString());
    // Also write to shared "latest weight" key so Progress page can read it
    lsSave("metrix_latest_weight_kg", kg.toString());
  }, [isMetric]);

  const setHeight = useCallback((displayVal: string) => {
    const n = parseFloat(displayVal);
    if (isNaN(n)) { setHeightCmRaw(0); lsSave("metrix_calc_height_cm", "0"); return; }
    const cm = isMetric ? n : inToCm(n);
    setHeightCmRaw(cm);
    lsSave("metrix_calc_height_cm", cm.toString());
  }, [isMetric]);

  const setAge = (v: string) => { setAgeRaw(v); lsSave("metrix_calc_age", v); };
  const setSex = (v: "male" | "female") => { setSexRaw(v); lsSave("metrix_calc_sex", v); };
  const setActivity = (v: number) => { setActivityRaw(v); lsSave("metrix_calc_activity", v.toString()); };

  // Compute BMR and TDEE from shared state
  const ageNum = parseFloat(age);
  const bmr: number | null = weightKg > 0 && heightCm > 0 && ageNum > 0
    ? (sex === "male"
        ? 10 * weightKg + 6.25 * heightCm - 5 * ageNum + 5
        : 10 * weightKg + 6.25 * heightCm - 5 * ageNum - 161)
    : null;
  const tdee: number | null = bmr ? bmr * activity : null;

  // Persist computed TDEE whenever it changes so Keto can read it live
  useEffect(() => {
    if (tdee) lsSave("metrix_computed_tdee", tdee.toFixed(0));
  }, [tdee]);

  return (
    <div className="p-10 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Calculators</h1>
          <p className="text-muted-foreground mt-2">Fitness and nutrition tools to guide your goals.</p>
        </div>
        <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
          {isMetric ? "Metric (kg, cm)" : "Imperial (lbs, in)"}
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <BMICard
          isMetric={isMetric}
          weightDisplay={weightDisplay}
          heightDisplay={heightDisplay}
          onWeightChange={setWeight}
          onHeightChange={setHeight}
        />
        <TDEECard
          isMetric={isMetric}
          weightDisplay={weightDisplay}
          heightDisplay={heightDisplay}
          age={age}
          sex={sex}
          activity={activity}
          bmr={bmr}
          tdee={tdee}
          onWeightChange={setWeight}
          onHeightChange={setHeight}
          onAgeChange={setAge}
          onSexChange={setSex}
          onActivityChange={setActivity}
        />
        <KetoCard computedTdee={tdee} />
        <OneRMCard isMetric={isMetric} />
      </div>
    </div>
  );
}
