import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, DEFAULT_USER_ID } from "@/lib/api";
import { Dumbbell, Plus, Trash2 } from "lucide-react";

interface MuscleGroup {
  id: number;
  name: string;
}

interface Exercise {
  id: number;
  muscle_group: { id: number; name: string };
  name: string;
}

interface WorkoutSession {
  id: number;
  user: number;
  date: string;
}

interface ExerciseSet {
  id: number;
  workout: number;
  exercise: { id: number; name: string; muscle_group: { id: number; name: string } };
  weight: number;
  reps: number;
  is_pr: boolean;
}

const MUSCLE_IMAGES: Record<string, string> = {
  "Chest": "/muscle_images/chest.png",
  "Back": "/muscle_images/back.png",
  "Legs": "/muscle_images/legs.png",
  "Shoulders": "/muscle_images/shoulders.png",
  "Biceps": "/muscle_images/biceps.png",
  "Triceps": "/muscle_images/triceps.png",
  "Abs": "/muscle_images/abs.png",
  "Cardio": "/muscle_images/cardio.png"
};

export function ExerciseLog() {
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workoutSession, setWorkoutSession] = useState<WorkoutSession | null>(null);
  const [sets, setSets] = useState<ExerciseSet[]>([]);
  
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<number | null>(null);
  const [weight, setWeight] = useState<number>(0);
  const [reps, setReps] = useState<number>(0);
  
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [savingExercise, setSavingExercise] = useState(false);
  
  const [loading, setLoading] = useState(true);

  const currentGroupName = muscleGroups.find(g => g.id === selectedGroup)?.name || "";
  const muscleImg = MUSCLE_IMAGES[currentGroupName];

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [groupsData, exercisesData, sessionsData, setsData] = await Promise.all([
        api.get<MuscleGroup[]>("/musclegroups/"),
        api.get<Exercise[]>("/exercises/"),
        api.get<WorkoutSession[]>("/workoutsessions/"),
        api.get<ExerciseSet[]>("/exercisesets/")
      ]);

      setMuscleGroups(groupsData);
      setExercises(exercisesData);

      // Find today's workout session for user
      const todayStr = new Date().toISOString().split('T')[0];
      let todaySession = sessionsData.find(s => s.user === DEFAULT_USER_ID && s.date.startsWith(todayStr));
      
      if (!todaySession) {
        // Create one if it doesn't exist
        todaySession = await api.post<WorkoutSession>("/workoutsessions/", {
          user: DEFAULT_USER_ID
        });
      }
      
      setWorkoutSession(todaySession);
      if (todaySession) {
        setSets(setsData.filter(set => set.workout === todaySession.id));
      }

    } catch (err) {
      console.error("Error fetching exercise data", err);
    } finally {
      setLoading(false);
    }
  }

  const handleLogSet = async () => {
    if (!workoutSession || !selectedExercise || weight <= 0 || reps <= 0) return;
    try {
      await api.post("/exercisesets/", {
        workout: workoutSession.id,
        exercise_id: selectedExercise,
        weight: weight,
        reps: reps,
        is_pr: false
      });
      // reset form, but keep exercise selected for multiple sets
      setWeight(0);
      setReps(0);
      fetchData(); // refresh sets
    } catch (err) {
      console.error("Error logging set", err);
    }
  };

  const handleAddExercise = async () => {
    if (!selectedGroup || !newExerciseName.trim()) return;
    try {
      setSavingExercise(true);
      const newEx = await api.post<Exercise>("/exercises/", {
        name: newExerciseName.trim(),
        muscle_group_id: selectedGroup
      });
      
      // Update local state instead of full refresh for better UX
      setExercises(prev => [...prev, newEx]);
      setSelectedExercise(newEx.id);
      setIsAddingExercise(false);
      setNewExerciseName("");
    } catch (err) {
      console.error("Error adding exercise", err);
    } finally {
      setSavingExercise(false);
    }
  };

  const handleDeleteSet = async (setId: number) => {
    try {
      await api.delete(`/exercisesets/${setId}/`);
      setSets(prev => prev.filter(s => s.id !== setId));
    } catch (err) {
      console.error("Error deleting set", err);
    }
  };

  const filteredExercises = exercises.filter(e => e.muscle_group.id === selectedGroup);

  return (
    <div className="p-4 lg:p-10 space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight">Exercise Log</h1>
        <p className="text-muted-foreground mt-2">Log your sets, reps, and track your gains.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Add Exercise */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Log a Set</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {muscleImg && (
                <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-muted/30 animate-in zoom-in-95 duration-300">
                  <img 
                    src={muscleImg} 
                    alt={currentGroupName} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-bottom p-4">
                    <p className="text-white font-bold tracking-tight text-lg mt-auto">{currentGroupName.toUpperCase()}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Muscle Group</label>
                <select 
                  className="w-full h-10 border rounded-md px-3 bg-background"
                  value={selectedGroup || ""}
                  onChange={e => {
                    setSelectedGroup(Number(e.target.value));
                    setSelectedExercise(null);
                  }}
                >
                  <option value="" disabled>Select Muscle Group</option>
                  {muscleGroups.slice().sort((a, b) => a.name.localeCompare(b.name)).map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {selectedGroup && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Exercise</label>
                      <button 
                        onClick={() => {
                          setIsAddingExercise(!isAddingExercise);
                          setNewExerciseName("");
                        }}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        {isAddingExercise ? "Cancel" : <><Plus className="w-3 h-3" /> New Exercise</>}
                      </button>
                    </div>

                    {!isAddingExercise ? (
                      <select 
                        className="w-full h-10 border rounded-md px-3 bg-background"
                        value={selectedExercise || ""}
                        onChange={e => setSelectedExercise(Number(e.target.value))}
                      >
                        <option value="" disabled>Select Exercise</option>
                        {filteredExercises.map(e => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex gap-2 animate-in slide-in-from-top-1 duration-200">
                        <input 
                          type="text"
                          placeholder="Exercise Name (e.g. Bench Press)"
                          className="flex-1 h-10 border rounded-md px-3 bg-background"
                          value={newExerciseName}
                          onChange={e => setNewExerciseName(e.target.value)}
                          autoFocus
                        />
                        <Button 
                          size="sm"
                          onClick={handleAddExercise}
                          disabled={!newExerciseName.trim() || savingExercise}
                        >
                          {savingExercise ? "..." : "Save"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedExercise && !isAddingExercise && (
                <div className="space-y-4 animate-in fade-in p-4 border rounded-xl bg-secondary/20">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Weight (kg/lbs)</label>
                      <input 
                        type="number" 
                        value={weight || ""}
                        onChange={e => setWeight(Number(e.target.value))}
                        className="w-full h-10 border rounded px-3 bg-background font-bold"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Reps</label>
                      <input 
                        type="number" 
                        value={reps || ""}
                        onChange={e => setReps(Number(e.target.value))}
                        className="w-full h-10 border rounded px-3 bg-background font-bold"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleLogSet} 
                    className="w-full bg-blue-600 hover:bg-blue-700 font-bold"
                    disabled={weight <= 0 || reps <= 0}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Log Set
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Today's Workout */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Today's Workout</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground p-4 text-center animate-pulse">Loading workout...</p>
              ) : sets.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground border-2 border-dashed rounded-xl">
                  <Dumbbell className="w-12 h-12 mb-4 opacity-20" />
                  <p>You haven't logged any exercises today.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Group sets by exercise id */}
                  {Array.from(new Set(sets.map(s => s.exercise.id))).map(exerciseId => {
                    const exerciseSets = sets.filter(s => s.exercise.id === exerciseId);
                    // The API returns exercise as a nested object on ExerciseSet
                    const firstSet = exerciseSets[0];
                    const exerciseName = firstSet?.exercise?.name
                      || exercises.find(e => e.id === exerciseId)?.name
                      || 'Unknown Exercise';
                    
                    return (
                      <div key={exerciseId} className="border rounded-xl p-4">
                        <h3 className="font-bold text-lg mb-3 flex items-center">
                          <Dumbbell className="w-4 h-4 mr-2 text-primary" /> {exerciseName}
                        </h3>
                        <div className="space-y-2">
                          {exerciseSets.map((set, idx) => (
                            <div key={set.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0 group/set">
                              <span className="text-muted-foreground font-medium w-16">Set {idx + 1}</span>
                              <span className="font-bold">{set.weight} <span className="text-muted-foreground text-xs font-normal">weight</span></span>
                              <span className="font-bold">{set.reps} <span className="text-muted-foreground text-xs font-normal">reps</span></span>
                              <button 
                                onClick={() => handleDeleteSet(set.id)}
                                className="p-1.5 rounded-full hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors opacity-0 group-hover/set:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
