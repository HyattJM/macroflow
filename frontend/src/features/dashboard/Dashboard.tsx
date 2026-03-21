import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Calendar, Utensils, Dumbbell, Droplets, 
  Send, Loader2, GlassWater, Search 
} from "lucide-react";
import { api, DEFAULT_USER_ID } from "@/lib/api";
import type { WaterLog } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { parseNutritionixNLP } from "../food/FoodLog";

interface UserProfile {
  id: number;
  daily_calorie_goal: number;
  daily_protein_goal: number;
  daily_carbs_goal: number;
  daily_fat_goal: number;
  daily_water_goal: number;
}

interface FoodItem {
  id: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface FoodLog {
  id: number;
  user: number;
  food_item: FoodItem; // Changed from number to FoodItem (nested)
  date: string;
  servings: number;
}

// unused Exercise interface removed

interface WorkoutSession {
  id: number;
  user: number;
  date: string;
}

interface ExerciseSet {
  id: number;
  workout: number;
  exercise: { id: number; name: string }; // Changed to object
  weight: number;
  reps: number;
}

export function Dashboard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [exercises, setExercises] = useState<{name: string, sets: number}[]>([]);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [quickLogQuery, setQuickLogQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const todayStr = new Date().toISOString().split('T')[0];

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [userResp, logsResp, sessionsResp, setsResp, waterResp] = await Promise.all([
        api.get<UserProfile>(`/users/${DEFAULT_USER_ID}/`),
        api.get<FoodLog[]>("/foodlogs/"),
        api.get<WorkoutSession[]>("/workoutsessions/"),
        api.get<ExerciseSet[]>("/exercisesets/"),
        api.get<WaterLog[]>("/waterlogs/")
      ]);

      setProfile(userResp);
      setWaterLogs(waterResp.filter(l => l.date === todayStr));
      setConnectionError(null);

      // Process food logs for today
      const todaysLogs = logsResp.filter(
        log => log.user === DEFAULT_USER_ID && log.date === todayStr
      );
      setFoodLogs(todaysLogs);

      // Process exercises for today
      const todaySession = sessionsResp.find(s => s.user === DEFAULT_USER_ID && s.date.startsWith(todayStr));
      if (todaySession) {
        const todaysSets = setsResp.filter(s => s.workout === todaySession.id);
        
        const exerciseSummary: Record<number, { name: string; sets: number }> = {};
        todaysSets.forEach(s => {
          const exId = s.exercise.id;
          if (!exerciseSummary[exId]) {
            exerciseSummary[exId] = { name: s.exercise.name, sets: 0 };
          }
          exerciseSummary[exId].sets += 1;
        });

        const exerciseList = Object.values(exerciseSummary).map(sum => ({
          name: sum.name,
          sets: sum.sets
        }));
        setExercises(exerciseList);
      } else {
        setExercises([]);
      }

    } catch (err: any) {
      console.error("Error fetching dashboard data:", err);
      setConnectionError(err.message || "Failed to connect to backend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [todayStr, refreshKey]);

  // Calculations
  const caloriesGoal = profile?.daily_calorie_goal || 2000;
  const proteinGoal = profile?.daily_protein_goal || 150;
  const carbsGoal = profile?.daily_carbs_goal || 250;
  const fatGoal = profile?.daily_fat_goal || 65;

  let caloriesConsumed = 0;
  let proteinConsumed = 0;
  let carbsConsumed = 0;
  let fatConsumed = 0;

  foodLogs.forEach(log => {
    const item = log.food_item;
    if (item) {
      caloriesConsumed += item.calories * log.servings;
      proteinConsumed += item.protein * log.servings;
      carbsConsumed += item.carbs * log.servings;
      fatConsumed += item.fat * log.servings;
    }
  });

  caloriesConsumed = Math.round(caloriesConsumed);
  proteinConsumed = Math.round(proteinConsumed);
  carbsConsumed = Math.round(carbsConsumed);
  fatConsumed = Math.round(fatConsumed);

  const caloriesRemaining = Math.max(0, caloriesGoal - caloriesConsumed);
  
  // Progress Ring Math
  const circumference = 502; // 2 * pi * radius (80)
  const percentComplete = Math.min(100, Math.round((caloriesConsumed / caloriesGoal) * 100));
  const strokeDashoffset = circumference - (percentComplete / 100) * circumference;

  // Water Logic
  const waterGoal = profile?.daily_water_goal || 2000;
  const waterConsumed = waterLogs.reduce((acc, l) => acc + l.amount, 0);
  const waterPercent = Math.min(100, Math.round((waterConsumed / waterGoal) * 100));

  const handleWaterAdd = async (amount: number) => {
    try {
      const newLog = await api.post<WaterLog>("/waterlogs/", {
        user: DEFAULT_USER_ID,
        amount: amount
      });
      setWaterLogs(prev => [...prev, newLog]);
    } catch (err) {
      console.error("Error logging water:", err);
    }
  };

  const handleQuickLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickLogQuery.trim() || isAnalyzing) return;

    setIsAnalyzing(true);
    try {
      const items = await parseNutritionixNLP(quickLogQuery);
      if (items.length === 0) {
        alert("Could not parse food data. Check keys or try again.");
        return;
      }

      // 1. Save all items to FoodItem DB and Log them
      for (const item of items) {
        const res = await api.post<{id: number}>("/fooditems/", item);
        await api.post("/foodlogs/", {
          user: DEFAULT_USER_ID,
          food_item_id: res.id,
          servings: 1
        });
      }

      setQuickLogQuery("");
      await fetchDashboardData();
    } catch (err) {
      console.error("Quick Log error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="p-4 lg:p-10 space-y-8 animate-in fade-in duration-500 pb-24 md:pb-8">
      {connectionError && (
        <div className="bg-destructive/15 border border-destructive/50 text-destructive px-4 py-3 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top duration-500">
          <div className="flex items-center gap-3 text-sm font-semibold">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            Connection Error: {connectionError}
          </div>
          <Button variant="ghost" size="sm" onClick={() => fetchDashboardData()} className="hover:bg-destructive/20 h-8 text-xs font-bold uppercase tracking-wider px-3">
            Retry
          </Button>
        </div>
      )}
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight">Dashboard</h1>
        <div className="flex items-center text-muted-foreground mt-2 space-x-2">
          <Calendar className="w-4 h-4" />
          <span className="text-sm">{today}</span>
          <span className="bg-primary/20 text-primary uppercase px-2 py-0.5 rounded text-xs font-bold tracking-wider">Today</span>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center animate-pulse text-muted-foreground">Loading dashboard data...</div>
      ) : (
        <div className="space-y-6">
          {/* Quick Log Input */}
          <Card className="border-primary/20 bg-primary/5 overflow-hidden">
            <CardContent className="p-4">
              <form onSubmit={handleQuickLog} className="relative">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Search className="w-5 h-5 text-primary" />
                   </div>
                   <input 
                      type="text" 
                      placeholder="Quick Log: '3 large eggs and a coffee'..." 
                      className="bg-transparent border-none focus:ring-0 text-lg font-medium flex-1 placeholder:text-muted-foreground/50"
                      value={quickLogQuery}
                      onChange={e => setQuickLogQuery(e.target.value)}
                      disabled={isAnalyzing}
                   />
                   <Button 
                      size="icon" 
                      className="rounded-xl w-10 h-10 shrink-0" 
                      type="submit"
                      disabled={!quickLogQuery.trim() || isAnalyzing}
                   >
                     {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                   </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calorie Ring Card */}
          <Card className="lg:col-span-2">
            <CardContent className="p-8 flex flex-col md:flex-row items-center justify-start space-y-6 md:space-y-0 md:space-x-12">
              <div className="relative w-48 h-48 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                  <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-secondary" />
                  <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="12" fill="transparent"
                    strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="text-primary transition-all duration-1000 ease-in-out" />
                </svg>
                <div className="text-center flex flex-col items-center">
                  <Utensils className="w-5 h-5 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">kcal</span>
                </div>
              </div>
              
              <div className="flex flex-col text-center md:text-left">
                <span className="text-6xl font-black">{caloriesConsumed}</span>
                <span className="text-muted-foreground text-sm font-medium mt-1">of {caloriesGoal} kcal goal</span>
                <span className="text-primary font-medium text-sm mt-2">{caloriesRemaining} kcal remaining</span>
              </div>
            </CardContent>
          </Card>

          {/* Macros & Water Card */}
          <div className="space-y-6">
            <Card className="flex flex-col justify-center space-y-6 p-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span className="flex items-center text-blue-500"><Dumbbell className="w-4 h-4 mr-2" /> Protein</span>
                  <span className="text-muted-foreground">{proteinConsumed}g / {proteinGoal}g</span>
                </div>
                <Progress value={(proteinConsumed / proteinGoal) * 100} max={100} indicatorColor="bg-blue-500" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span className="flex items-center text-green-500"><Utensils className="w-4 h-4 mr-2" /> Carbs</span>
                  <span className="text-muted-foreground">{carbsConsumed}g / {carbsGoal}g</span>
                </div>
                <Progress value={(carbsConsumed / carbsGoal) * 100} max={100} indicatorColor="bg-green-500" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span className="flex items-center text-yellow-500"><div className="w-4 h-4 mr-2 rounded-full border-2 border-current"/> Fat</span>
                  <span className="text-muted-foreground">{fatConsumed}g / {fatGoal}g</span>
                </div>
                <Progress value={(fatConsumed / fatGoal) * 100} max={100} indicatorColor="bg-yellow-500" />
              </div>
            </Card>

            <Card className="p-6 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Droplets className="w-24 h-24 text-blue-500" />
               </div>
               <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center gap-2">
                        <Droplets className="w-5 h-5 text-blue-500" />
                        <span className="font-bold text-lg">Hydration</span>
                     </div>
                     <span className="text-xs font-black uppercase tracking-widest text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">
                        {waterPercent}%
                     </span>
                  </div>
                  
                  <div className="mt-auto space-y-4">
                     <div>
                        <div className="flex items-baseline gap-1">
                           <span className="text-4xl font-black">{waterConsumed}</span>
                           <span className="text-muted-foreground text-sm font-bold uppercase">/ {waterGoal} ml</span>
                        </div>
                        <div className="w-full h-1.5 bg-secondary rounded-full mt-2 overflow-hidden">
                           <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${waterPercent}%` }} />
                        </div>
                     </div>

                     <div className="flex gap-2">
                        <button 
                           onClick={() => handleWaterAdd(250)}
                           className="flex-1 bg-secondary/50 hover:bg-blue-500 hover:text-white transition-all py-3 rounded-2xl flex flex-col items-center gap-1 border border-border/50 group/glass"
                        >
                           <GlassWater className="w-5 h-5 group-hover/glass:animate-bounce" />
                           <span className="text-[10px] font-black uppercase">+250ml</span>
                        </button>
                        <button 
                           onClick={() => handleWaterAdd(500)}
                           className="flex-1 bg-secondary/50 hover:bg-blue-500 hover:text-white transition-all py-3 rounded-2xl flex flex-col items-center gap-1 border border-border/50 group/bottle"
                        >
                           <Droplets className="w-5 h-5 group-hover/bottle:animate-pulse" />
                           <span className="text-[10px] font-black uppercase">+500ml</span>
                        </button>
                     </div>
                  </div>
               </div>
            </Card>
          </div>

          {/* Meals List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Today's Meals</CardTitle>
            </CardHeader>
            <CardContent>
              {foodLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No meals logged yet today.</p>
              ) : (
                <div className="space-y-3">
                  {foodLogs.map(log => (
                    <div key={log.id} className="flex justify-between items-center bg-secondary/30 p-3 rounded-lg">
                      <div className="flex flex-col">
                        <span className="font-semibold">{log.food_item?.name || 'Unknown Food'}</span>
                        <span className="text-xs text-muted-foreground">{log.servings} x serving</span>
                      </div>
                      <span className="font-bold">{log.food_item ? Math.round(log.food_item.calories * log.servings) : 0} kcal</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Exercise List */}
          <Card className="lg:col-span-1 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center">
                <Dumbbell className="w-5 h-5 mr-2 text-primary" /> Today's Workout
              </CardTitle>
            </CardHeader>
            <CardContent>
              {exercises.length === 0 ? (
                <p className="text-sm text-muted-foreground">No exercises logged yet.</p>
              ) : (
                <div className="space-y-3">
                  {exercises.map((ex, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="font-medium">{ex.name}</span>
                      <span className="text-muted-foreground font-bold">{ex.sets} set{ex.sets > 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}
