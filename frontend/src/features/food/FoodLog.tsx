import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, DEFAULT_USER_ID } from "@/lib/api";
import {
  Search, Plus, Utensils, Loader2,
  Database, Trash2, PenLine, Info, ExternalLink
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────
interface FoodItem {
  id: number;
  name: string;
  barcode: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface FoodLog {
  id: number;
  user: number;
  food_item: FoodItem; // nested object returned by GET
  date: string;
  servings: number;
}

// USDA Nutrient IDs
const USDA_NUTRIENTS = {
  protein: 1003,
  fat: 1004,
  carbs: 1005,
  calories: 1008,
};

interface USDANutrient {
  nutrientId: number;
  nutrientName: string;
  value: number;
  unitName: string;
}

interface USDAFood {
  fdcId: number;
  description: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  foodNutrients: USDANutrient[];
  servingSize?: number;
  servingSizeUnit?: string;
}

// ─── USDA API Helpers ───────────────────────────────────────────────────────
const USDA_API_KEY = "MclgFfkTh9WAQp3ujUx2reFxCsqcKt4hpG4tj5g2";
const USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";

// Simple persistent cache for the session
let searchCache: Record<string, Omit<FoodItem, "id">[]> = {};

function usdaToFoodItem(food: USDAFood): Omit<FoodItem, "id"> {
  const findNutrient = (id: number) => 
    food.foodNutrients.find(n => n.nutrientId === id)?.value || 0;

  const brand = food.brandName || food.brandOwner;
  const description = food.description;
  const fullName = brand ? `${description} (${brand})` : description;

  return {
    name: fullName,
    barcode: food.gtinUpc || null,
    calories: Math.round(findNutrient(USDA_NUTRIENTS.calories) || findNutrient(1008)),
    protein: Math.round(findNutrient(USDA_NUTRIENTS.protein)),
    carbs: Math.round(findNutrient(USDA_NUTRIENTS.carbs)),
    fat: Math.round(findNutrient(USDA_NUTRIENTS.fat)),
  };
}

async function searchUSDA(query: string): Promise<{ results: Omit<FoodItem, "id">[], rateLimited: boolean }> {
  const q = query.toLowerCase().trim();
  if (searchCache[q]) return { results: searchCache[q], rateLimited: false };

  try {
    const params = new URLSearchParams({
      query: q,
      pageSize: "25",
      api_key: USDA_API_KEY,
    });
    const res = await fetch(`${USDA_SEARCH_URL}?${params}`);
    
    if (res.status === 429) {
      return { results: [], rateLimited: true };
    }
    
    if (!res.ok) {
      console.error("USDA search failed:", res.status);
      return { results: [], rateLimited: false };
    }
    
    const data = await res.json();
    const results = (data.foods || []).map((f: USDAFood) => usdaToFoodItem(f));
    searchCache[q] = results;
    return { results, rateLimited: false };
  } catch (err) {
    console.error("USDA search error:", err);
    return { results: [], rateLimited: false };
  }
}

// ─── Nutritionix API Helpers ───────────────────────────────────────────────
// NOTE: User will need to replace these with their own keys
const NUTRITIONIX_APP_ID = "YOUR_APP_ID"; 
const NUTRITIONIX_APP_KEY = "YOUR_APP_KEY";
const NUX_SEARCH_URL = "https://trackapi.nutritionix.com/v2/search/instant";
const NUX_NLP_URL = "https://trackapi.nutritionix.com/v2/natural/nutrients";

async function searchNutritionix(query: string): Promise<Omit<FoodItem, "id">[]> {
  if (!NUTRITIONIX_APP_ID || NUTRITIONIX_APP_ID === "YOUR_APP_ID") return [];
  
  try {
    const res = await fetch(`${NUX_SEARCH_URL}?query=${encodeURIComponent(query)}`, {
      headers: {
        "x-app-id": NUTRITIONIX_APP_ID,
        "x-app-key": NUTRITIONIX_APP_KEY,
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    
    // Mix branded and common
    const branded = (data.branded || []).map((f: any) => ({
      name: `${f.food_name} (${f.brand_name_item_name})`,
      barcode: f.nix_item_id || null,
      calories: Math.round(f.nf_calories || 0),
      protein: Math.round(f.nf_protein || 0),
      carbs: Math.round(f.nf_total_carbohydrate || 0),
      fat: Math.round(f.nf_total_fat || 0),
      isBranded: true
    }));

    const common = (data.common || []).map((f: any) => ({
      name: f.food_name,
      barcode: null,
      calories: 0, // Common needs a detail call to get macros usually
      protein: 0,
      carbs: 0,
      fat: 0,
      isCommon: true
    }));

    return [...branded, ...common];
  } catch (err) {
    console.error("Nutritionix search error:", err);
    return [];
  }
}

export async function parseNutritionixNLP(query: string): Promise<Omit<FoodItem, "id">[]> {
  if (!NUTRITIONIX_APP_ID || NUTRITIONIX_APP_ID === "YOUR_APP_ID") return [];

  try {
    const res = await fetch(NUX_NLP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-id": NUTRITIONIX_APP_ID,
        "x-app-key": NUTRITIONIX_APP_KEY,
      },
      body: JSON.stringify({ query })
    });
    if (!res.ok) return [];
    const data = await res.json();
    
    return (data.foods || []).map((f: any) => ({
      name: f.food_name,
      barcode: null,
      calories: Math.round(f.nf_calories || 0),
      protein: Math.round(f.nf_protein || 0),
      carbs: Math.round(f.nf_total_carbohydrate || 0),
      fat: Math.round(f.nf_total_fat || 0),
    }));
  } catch (err) {
    console.error("Nutritionix NLP error:", err);
    return [];
  }
}

// ─── Blank Manual Form ──────────────────────────────────────────────────────
const BLANK_MANUAL = { name: "", calories: "", protein: "", carbs: "", fat: "" };

type AddMode = "search" | "manual";
type Provider = "usda" | "nutritionix";

export function FoodLog() {
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [mode, setMode] = useState<AddMode>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [localResults, setLocalResults] = useState<FoodItem[]>([]);
  const [usdaResults, setUsdaResults] = useState<Omit<FoodItem, "id">[]>([]);
  const [selectedFood, setSelectedFood] = useState<Omit<FoodItem, "id"> & { id?: number } | null>(null);
  const [servings, setServings] = useState(1);
  const [manual, setManual] = useState({ ...BLANK_MANUAL });
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingFood, setSavingFood] = useState(false);
  const [rateLimitError, setRateLimitError] = useState(false);
  const [provider, setProvider] = useState<Provider>("usda");
  const [nuxResults, setNuxResults] = useState<Omit<FoodItem, "id">[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [logsData, foodData] = await Promise.all([
        api.get<FoodLog[]>("/foodlogs/"),
        api.get<FoodItem[]>("/fooditems/"),
      ]);
      const todayStr = new Date().toISOString().split("T")[0];
      setLogs(logsData.filter(l => l.user === DEFAULT_USER_ID && l.date === todayStr));
      setFoodItems(foodData);
    } catch (err) { console.error("Error fetching food data", err); }
    finally { setLoading(false); }
  }

  // ── Debounced search ──
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!searchQuery.trim()) { setLocalResults([]); setUsdaResults([]); return; }
    
    // Search local database
    const local = foodItems.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    setLocalResults(local);

    debounceTimer.current = setTimeout(async () => {
      setSearching(true);
      setRateLimitError(false);
      try {
        if (provider === "usda") {
          const { results, rateLimited } = await searchUSDA(searchQuery);
          if (rateLimited) {
            setRateLimitError(true);
            return;
          }
          const localNames = new Set(local.map(f => f.name.toLowerCase()));
          setUsdaResults(results.filter(r => !localNames.has(r.name.toLowerCase())));
        } else {
          const results = await searchNutritionix(searchQuery);
          setNuxResults(results);
        }
      } catch { /* silent */ }
      finally { setSearching(false); }
    }, 800);
  }, [searchQuery, foodItems, provider]);

  async function ensureSaved(food: Omit<FoodItem, "id"> & { id?: number }): Promise<number> {
    if (food.id) return food.id;
    const byName = foodItems.find(f => f.name.toLowerCase() === food.name.toLowerCase());
    if (byName) return byName.id;
    if (food.barcode) {
      const byBarcode = foodItems.find(f => f.barcode === food.barcode);
      if (byBarcode) return byBarcode.id;
    }
    try {
      const saved = await api.post<FoodItem>("/fooditems/", {
        name: food.name, barcode: food.barcode ?? null,
        calories: food.calories, protein: food.protein,
        carbs: food.carbs, fat: food.fat,
      });
      setFoodItems(prev => [...prev, saved]);
      return saved.id;
    } catch {
      const fresh = await api.get<FoodItem[]>("/fooditems/");
      setFoodItems(fresh);
      const match = fresh.find(f =>
        (food.barcode && f.barcode === food.barcode) ||
        f.name.toLowerCase() === food.name.toLowerCase()
      );
      if (match) return match.id;
      throw new Error("Could not save food item");
    }
  }

  const handleLogFood = async () => {
    if (!selectedFood) return;
    setSavingFood(true);
    try {
      const foodId = await ensureSaved(selectedFood);
      await api.post("/foodlogs/", {
        user: DEFAULT_USER_ID,
        food_item_id: foodId,
        servings,
      });
      setSelectedFood(null); setServings(1);
      await fetchData();
    } catch (err) { console.error("Error logging food", err); }
    finally { setSavingFood(false); }
  };

  const handleLogManual = async () => {
    const name = manual.name.trim();
    if (!name || !manual.calories) return;
    setSavingFood(true);
    try {
      const foodId = await ensureSaved({
        name,
        barcode: null,
        calories: parseFloat(manual.calories) || 0,
        protein: parseFloat(manual.protein) || 0,
        carbs: parseFloat(manual.carbs) || 0,
        fat: parseFloat(manual.fat) || 0,
      });
      await api.post("/foodlogs/", {
        user: DEFAULT_USER_ID,
        food_item_id: foodId,
        servings,
      });
      setManual({ ...BLANK_MANUAL }); setServings(1);
      await fetchData();
    } catch (err) { console.error("Error logging manual food", err); }
    finally { setSavingFood(false); }
  };

  const handleDeleteLog = async (logId: number) => {
    try {
      await api.delete(`/foodlogs/${logId}/`);
      setLogs(prev => prev.filter(l => l.id !== logId));
    } catch (err) { console.error("Error deleting log", err); }
  };

  const totals = logs.reduce(
    (acc, l) => {
      const f = l.food_item;
      if (!f) return acc;
      return {
        calories: acc.calories + Math.round(f.calories * l.servings),
        protein: acc.protein + Math.round(f.protein * l.servings),
        carbs: acc.carbs + Math.round(f.carbs * l.servings),
        fat: acc.fat + Math.round(f.fat * l.servings),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <div className="p-4 lg:p-10 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight">Food Log</h1>
        <p className="text-muted-foreground mt-2">Track your meals and hit your macro goals with USDA or Nutritionix.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
        {/* ── Left/Middle: Search & Manual Entry (Larger) ── */}
        <div className="xl:col-span-3 space-y-6">
          <Card className="h-full">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl">Add Food to Log</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Search the USDA database or enter details manually.</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex rounded-lg border border-input overflow-hidden text-xs">
                  <button onClick={() => setMode("search")}
                    className={`px-4 py-2 font-medium transition-colors flex items-center gap-1.5 ${mode === "search" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
                    <Search className="w-3.5 h-3.5" /> Search
                  </button>
                  <button onClick={() => setMode("manual")}
                    className={`px-4 py-2 font-medium transition-colors flex items-center gap-1.5 ${mode === "manual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
                    <PenLine className="w-3.5 h-3.5" /> Manual
                  </button>
                </div>
                {mode === "search" && (
                   <div className="flex rounded-lg border border-input overflow-hidden text-[10px] font-bold uppercase tracking-tighter">
                     <button onClick={() => setProvider("usda")}
                       className={`px-2 py-1 transition-colors ${provider === "usda" ? "bg-blue-500 text-white" : "bg-card text-muted-foreground"}`}>USDA</button>
                     <button onClick={() => setProvider("nutritionix")}
                       className={`px-2 py-1 transition-colors ${provider === "nutritionix" ? "bg-orange-500 text-white" : "bg-card text-muted-foreground"}`}>NUX</button>
                   </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              {mode === "search" && (
                <div className="space-y-6">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-4 top-3.5 w-5 h-5 text-muted-foreground pointer-events-none" />
                    {searching && <Loader2 className="absolute right-4 top-3.5 w-5 h-5 text-muted-foreground animate-spin" />}
                    <input type="text" placeholder="Search for food (e.g. Steak, Banana, Oat Milk...)"
                      value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-12 py-3.5 border rounded-2xl bg-secondary/20 border-secondary text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all font-medium" />
                  </div>

                   {/* Results Section */}
                  {searchQuery.length > 0 && !selectedFood && (
                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Search Results</h3>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Database className="w-3 h-3 text-primary" /> Local DB</span>
                          <span className="flex items-center gap-1">
                            {provider === "usda" ? (
                              <><ExternalLink className="w-3 h-3 text-blue-400" /> USDA</>
                            ) : (
                              <><ExternalLink className="w-3 h-3 text-orange-400" /> Nutritionix</>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {rateLimitError && provider === "usda" && (
                          <div className="p-6 bg-red-500/10 border-2 border-dashed border-red-500/20 rounded-2xl text-center space-y-3">
                            <Info className="w-8 h-8 mx-auto text-red-500" />
                            <div>
                              <p className="text-red-500 font-bold">USDA API Rate Limit Reached</p>
                              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                                The USDA "DEMO_KEY" is currently rate-limited. To continue searching millions of items, 
                                please enter a personal API key in the source code or wait a few minutes. 
                                <br/><br/>
                                <a href="https://api.nal.usda.gov/" target="_blank" className="text-primary hover:underline font-bold">Get a free API key here →</a>
                              </p>
                            </div>
                          </div>
                        )}

                        {!rateLimitError && localResults.length === 0 && usdaResults.length === 0 && !searching && (
                          <div className="text-center py-12 bg-secondary/10 rounded-2xl border-2 border-dashed border-secondary">
                            <Utensils className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                            <p className="text-muted-foreground font-medium">No foods found. Try a different search or use Manual mode.</p>
                          </div>
                        )}

                        {localResults.map(food => (
                          <button key={food.id} onClick={() => setSelectedFood(food)}
                            className="w-full text-left p-4 rounded-2xl border border-secondary bg-background hover:bg-secondary/30 hover:border-primary/30 transition-all flex items-center justify-between group">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <Database className="w-5 h-5 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-base truncate group-hover:text-primary transition-colors">{food.name}</p>
                                <p className="text-xs text-muted-foreground">Saved in your database</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                              <p className="text-lg font-black text-primary">{food.calories}<span className="text-[10px] ml-1 uppercase opacity-60">kcal</span></p>
                              <div className="flex gap-2 text-[10px] uppercase font-bold text-muted-foreground mt-0.5">
                                <span>{food.protein}p</span>
                                <span>{food.carbs}c</span>
                                <span>{food.fat}f</span>
                              </div>
                            </div>
                          </button>
                        ))}

                        {provider === "usda" ? usdaResults.map((food, idx) => (
                          <button key={`usda-${idx}`} onClick={() => setSelectedFood(food)}
                            className="w-full text-left p-4 rounded-2xl border border-secondary bg-background hover:bg-secondary/30 hover:border-blue-400/30 transition-all flex items-center justify-between group">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center shrink-0">
                                <ExternalLink className="w-5 h-5 text-blue-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-base line-clamp-2 group-hover:text-blue-400 transition-colors leading-tight">{food.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">USDA FoodData Central</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                              <p className="text-lg font-black text-blue-400">{food.calories}<span className="text-[10px] ml-1 uppercase opacity-60">kcal</span></p>
                              <div className="flex gap-2 text-[10px] uppercase font-bold text-muted-foreground mt-0.5">
                                <span>{food.protein}p</span>
                                <span>{food.carbs}c</span>
                                <span>{food.fat}f</span>
                              </div>
                            </div>
                          </button>
                        )) : nuxResults.map((food, idx) => (
                          <button key={`nux-${idx}`} onClick={() => setSelectedFood(food)}
                            className="w-full text-left p-4 rounded-2xl border border-secondary bg-background hover:bg-secondary/30 hover:border-orange-400/30 transition-all flex items-center justify-between group">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-orange-400/10 flex items-center justify-center shrink-0">
                                <ExternalLink className="w-5 h-5 text-orange-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-base line-clamp-2 group-hover:text-orange-400 transition-colors leading-tight">{food.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Nutritionix Database</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                              <p className="text-lg font-black text-orange-400">{food.calories || "?"}<span className="text-[10px] ml-1 uppercase opacity-60">kcal</span></p>
                              <div className="flex gap-2 text-[10px] uppercase font-bold text-muted-foreground mt-0.5">
                                <span>{food.protein}p</span>
                                <span>{food.carbs}c</span>
                                <span>{food.fat}f</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Selected Item Detail / Serve / Add */}
                  {selectedFood && (
                    <div className="p-6 border-2 border-primary/20 bg-primary/5 rounded-3xl animate-in zoom-in-95 duration-200">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="space-y-4 flex-1">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-primary px-2 py-0.5 bg-primary/10 rounded-full mb-2 inline-block">Selected Food</span>
                            <h3 className="text-2xl font-black leading-tight text-foreground">{selectedFood.name}</h3>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-4">
                             <div className="bg-background/50 p-3 rounded-2xl border border-secondary text-center">
                               <p className="text-xs text-muted-foreground font-bold uppercase tracking-tighter">Calories</p>
                               <p className="text-xl font-black">{selectedFood.calories}</p>
                             </div>
                             <div className="bg-background/50 p-3 rounded-2xl border border-secondary text-center">
                               <p className="text-xs text-blue-400 font-bold uppercase tracking-tighter">Protein</p>
                               <p className="text-xl font-black">{selectedFood.protein}g</p>
                             </div>
                             <div className="bg-background/50 p-3 rounded-2xl border border-secondary text-center">
                               <p className="text-xs text-green-400 font-bold uppercase tracking-tighter">Carbs</p>
                               <p className="text-xl font-black">{selectedFood.carbs}g</p>
                             </div>
                             <div className="bg-background/50 p-3 rounded-2xl border border-secondary text-center">
                               <p className="text-xs text-yellow-400 font-bold uppercase tracking-tighter">Fat</p>
                               <p className="text-xl font-black">{selectedFood.fat}g</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 w-fit px-3 py-1.5 rounded-lg border border-secondary">
                             <Info className="w-3 h-3" />
                             <span>Nutritional values per 100g / Standard serving</span>
                          </div>
                        </div>

                        <div className="md:w-64 space-y-4 shrink-0">
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider ml-1">Servings</label>
                            <div className="flex items-center bg-background rounded-2xl border border-secondary overflow-hidden h-14">
                               <button onClick={() => setServings(s => Math.max(0.1, s - 0.5))} className="w-12 h-full hover:bg-secondary transition-all text-xl font-bold border-r border-secondary">-</button>
                               <input type="number" step="0.1" min="0.1" value={servings}
                                 onChange={e => setServings(Number(e.target.value))}
                                 className="flex-1 h-full text-center text-lg font-black bg-transparent focus:outline-none" />
                               <button onClick={() => setServings(s => s + 0.5)} className="w-12 h-full hover:bg-secondary transition-all text-xl font-bold border-l border-secondary">+</button>
                            </div>
                          </div>

                          <div className="flex gap-2">
                             <Button onClick={handleLogFood} className="flex-1 h-12 rounded-2xl text-base font-bold shadow-lg shadow-primary/25" disabled={savingFood}>
                                {savingFood ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5 mr-1" />}
                                Add to Log
                             </Button>
                             <Button variant="ghost" className="h-12 w-12 rounded-2xl bg-secondary/50 hover:bg-secondary" onClick={() => { setSelectedFood(null); setServings(1); }}>
                                <Trash2 className="w-5 h-5 text-muted-foreground" />
                             </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!searchQuery && !selectedFood && (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40">
                      <Search className="w-16 h-16 mb-6 opacity-10" />
                      <p className="text-xl font-bold">Start typing to search {provider === "usda" ? "USDA" : "Nutritionix"}...</p>
                      <p className="text-sm mt-1">Access millions of validated food items.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Manual Mode ── */}
              {mode === "manual" && (
                <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-right-4 duration-300 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1">Food Name *</label>
                      <input type="text" placeholder="e.g. Grandma's Secret Stew"
                        value={manual.name} onChange={e => setManual(m => ({ ...m, name: e.target.value }))}
                        className="w-full h-14 border rounded-2xl px-5 bg-secondary/20 border-secondary text-lg font-medium focus-visible:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
                    </div>
                    
                    {[
                      { key: "calories", label: "Calories", unit: "kcal", icon: <Utensils className="w-4 h-4" /> },
                      { key: "protein", label: "Protein", unit: "g", icon: <PenLine className="w-4 h-4 text-blue-400" /> },
                      { key: "carbs", label: "Carbs", unit: "g", icon: <PenLine className="w-4 h-4 text-green-400" /> },
                      { key: "fat", label: "Fat", unit: "g", icon: <PenLine className="w-4 h-4 text-yellow-400" /> },
                    ].map(({ key, label, unit, icon }) => (
                      <div key={key} className="space-y-2">
                        <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-2">
                          {icon} {label}
                        </label>
                        <div className="relative">
                          <input type="number" step="0.1" min="0" placeholder="0"
                            value={manual[key as keyof typeof manual]} onChange={e => setManual(m => ({ ...m, [key]: e.target.value }))}
                            className="w-full h-14 border rounded-2xl px-5 pr-12 bg-secondary/20 border-secondary text-lg font-black focus:outline-none focus:ring-2 focus:ring-primary/50" />
                          <span className="absolute right-5 top-4.5 text-xs font-bold text-muted-foreground opacity-50">{unit}</span>
                        </div>
                      </div>
                    ))}
                    
                    <div className="md:col-span-2 pt-4">
                      <div className="space-y-2 mb-6">
                        <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1">Servings</label>
                        <div className="flex items-center bg-secondary/20 rounded-2xl border border-secondary overflow-hidden h-14">
                           <button onClick={() => setServings(s => Math.max(0.1, s - 0.5))} className="w-16 h-full hover:bg-secondary transition-all text-xl font-bold border-r border-secondary">-</button>
                           <input type="number" step="0.1" min="0.1" value={servings}
                             onChange={e => setServings(Number(e.target.value))}
                             className="flex-1 h-full text-center text-lg font-black bg-transparent focus:outline-none" />
                           <button onClick={() => setServings(s => s + 0.5)} className="w-16 h-full hover:bg-secondary transition-all text-xl font-bold border-l border-secondary">+</button>
                        </div>
                      </div>

                      {manual.name && manual.calories && (
                         <div className="p-6 rounded-3xl bg-primary/5 border-2 border-primary/20 mb-8 flex items-center justify-between">
                            <div className="space-y-1">
                               <p className="text-xs font-bold text-primary uppercase tracking-widest">Preview Log Entry</p>
                               <p className="text-xl font-black text-foreground">{manual.name}</p>
                            </div>
                            <div className="text-right">
                               <p className="text-2xl font-black text-primary">{Math.round(parseFloat(manual.calories || "0") * servings)}<span className="text-xs ml-1 opacity-60">kcal total</span></p>
                               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                 {Math.round(parseFloat(manual.protein || "0") * servings)}p • {Math.round(parseFloat(manual.carbs || "0") * servings)}c • {Math.round(parseFloat(manual.fat || "0") * servings)}f
                               </p>
                            </div>
                         </div>
                      )}

                      <Button className="w-full h-16 rounded-2xl text-xl font-black shadow-xl shadow-primary/25 transition-transform hover:scale-[1.01] active:scale-[0.99]"
                        onClick={handleLogManual}
                        disabled={!manual.name.trim() || !manual.calories || savingFood}>
                        {savingFood ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6 mr-2" />}
                        {savingFood ? "Saving…" : "Add Manual Entry"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Today's Log (Sticky-ish) ── */}
        <div className="xl:col-span-2">
          <Card className="h-full bg-secondary/10 border-none sticky top-10">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-card rounded-t-xl">
              <CardTitle className="text-xl">Today's Summary</CardTitle>
              <div className="bg-primary/20 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter">
                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center p-20 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                  <p className="font-medium">Refreshing log...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground/30 py-32">
                  <Utensils className="w-20 h-20 mb-6 opacity-10" />
                  <p className="text-lg font-bold">Log is empty</p>
                  <p className="text-sm text-center mt-2 px-10">Use search or manual entry to track your intake today.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Total Stats Bar */}
                  <div className="grid grid-cols-4 gap-2 bg-card p-4 rounded-3xl border border-secondary shadow-sm">
                    {[
                      { label: "kcal", value: totals.calories, color: "text-foreground" },
                      { label: "P", value: totals.protein, color: "text-blue-400" },
                      { label: "C", value: totals.carbs, color: "text-green-400" },
                      { label: "F", value: totals.fat, color: "text-yellow-400" },
                    ].map(st => (
                      <div key={st.label} className="text-center">
                         <p className={`text-xl font-black ${st.color}`}>{st.value}</p>
                         <p className="text-[9px] font-bold text-muted-foreground uppercase">{st.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {logs.map(log => {
                      const food = log.food_item;
                      if (!food) return null;
                      return (
                        <div key={log.id}
                          className="flex items-center justify-between p-4 bg-card border border-secondary rounded-2xl hover:border-primary/20 transition-all group">
                          <div className="flex flex-col min-w-0 mr-4">
                            <span className="font-bold text-sm truncate">{food.name}</span>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60 mt-1">{log.servings} serving{log.servings !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <div className="font-black text-sm">{Math.round(food.calories * log.servings)}<span className="text-[9px] ml-1 opacity-50">kcal</span></div>
                              <div className="flex gap-2 text-[9px] font-medium opacity-70">
                                <span className="text-blue-400">{Math.round(food.protein * log.servings)}p</span>
                                <span className="text-green-400">{Math.round(food.carbs * log.servings)}c</span>
                                <span className="text-yellow-400">{Math.round(food.fat * log.servings)}f</span>
                              </div>
                            </div>
                            <button onClick={() => handleDeleteLog(log.id)}
                              className="w-8 h-8 rounded-full bg-red-400/5 hover:bg-red-400/10 text-red-400/40 hover:text-red-400 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
