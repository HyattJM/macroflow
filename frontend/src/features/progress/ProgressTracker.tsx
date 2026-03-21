import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, DEFAULT_USER_ID } from "@/lib/api";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Scale, TrendingUp, TrendingDown, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";

// ─── Unit helpers ──────────────────────────────────────────────────────────
const kgToLbs = (kg: number) => kg * 2.20462;
const lbsToKg = (lbs: number) => lbs * 0.453592;

interface UserProfile { id: number; height: number | null; }
interface BodyWeight  { id: number; user: number; date: string; weight: number; }

interface MonthGroup {
  key: string;    // "2026-03"
  label: string;  // "March 2026"
  entries: BodyWeight[];
}

function monthKey(dateStr: string) { return dateStr.slice(0, 7); }
function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleString("default", { month: "long", year: "numeric" });
}
function bmiCategory(bmi: number) {
  if (bmi < 18.5) return { label: "Underweight", color: "text-blue-400",   hex: "#60a5fa" };
  if (bmi < 25)   return { label: "Normal",      color: "text-green-400",  hex: "#4ade80" };
  if (bmi < 30)   return { label: "Overweight",  color: "text-yellow-400", hex: "#facc15" };
  return                   { label: "Obese",       color: "text-red-400",    hex: "#f87171" };
}

// Guard against stored height values that look like inches instead of cm.
// Valid adult height in cm: 120–250. In inches: 48–96. Auto-convert if needed.
function resolveHeightCm(raw: number | null | undefined): number | null {
  if (!raw || raw <= 0) return null;
  if (raw >= 100 && raw <= 250) return raw;        // valid cm
  if (raw >= 48  && raw < 100)  return raw * 2.54; // looks like inches → convert
  return null;
}

// ─── Custom Tooltips ───────────────────────────────────────────────────────
function WeightTooltip({ active, payload, label, weightUnit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-lg text-sm">
      <p className="font-semibold mb-1">
        {new Date(label + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
      </p>
      <p className="text-blue-400 font-bold">{payload[0].value.toFixed(1)} {weightUnit}</p>
    </div>
  );
}

function BMITooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const bmi = payload[0].value as number;
  const cat  = bmiCategory(bmi);
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-lg text-sm">
      <p className="font-semibold mb-1">
        {new Date(label + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
      </p>
      <p className={`font-bold ${cat.color}`}>{bmi.toFixed(1)} — {cat.label}</p>
    </div>
  );
}

// ─── MonthTabs ─────────────────────────────────────────────────────────────
function MonthTabs({
  groups, activeIdx, setActiveIdx,
}: {
  groups: MonthGroup[]; activeIdx: number; setActiveIdx: (i: number) => void;
}) {
  if (groups.length <= 1) return null;
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-wrap gap-2">
        {groups.map((g, idx) => (
          <button key={g.key} onClick={() => setActiveIdx(idx)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              idx === activeIdx
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}>
            {g.label}
          </button>
        ))}
      </div>
      <div className="flex items-center space-x-1 ml-4 shrink-0">
        <button onClick={() => setActiveIdx(Math.min(activeIdx + 1, groups.length - 1))}
          disabled={activeIdx >= groups.length - 1}
          className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold px-2 min-w-[130px] text-center">
          {groups[activeIdx]?.label ?? "—"}
        </span>
        <button onClick={() => setActiveIdx(Math.max(activeIdx - 1, 0))}
          disabled={activeIdx <= 0}
          className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export function ProgressTracker() {
  const [weights, setWeights]     = useState<BodyWeight[]>([]);
  const [profile, setProfile]     = useState<UserProfile | null>(null);
  const [newWeight, setNewWeight] = useState("");
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [activeWeightMonth, setActiveWeightMonth] = useState(0);
  const [activeBmiMonth,    setActiveBmiMonth]    = useState(0);

  const isMetric   = localStorage.getItem("metrix_unit_system") !== "imperial";
  const weightUnit = isMetric ? "kg" : "lbs";

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [weightsData, profileData] = await Promise.all([
        api.get<BodyWeight[]>("/bodyweights/"),
        api.get<UserProfile>(`/users/${DEFAULT_USER_ID}/`),
      ]);
      const sorted = weightsData
        .filter(w => w.user === DEFAULT_USER_ID)
        .sort((a, b) => a.date.localeCompare(b.date));
      setWeights(sorted);
      setProfile(profileData);
    } catch (err) {
      console.error("Error fetching progress data", err);
    } finally {
      setLoading(false);
    }
  }

  // Group by calendar month (most-recent first)
  const monthGroups: MonthGroup[] = useMemo(() => {
    const map = new Map<string, BodyWeight[]>();
    for (const w of weights) {
      const k = monthKey(w.date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(w);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, entries]) => ({ key, label: monthLabel(key), entries }));
  }, [weights]);

  const toDisplay = (kg: number) => isMetric ? kg : kgToLbs(kg);

  // Height source: backend profile first, then localStorage (from calculator page).
  // resolveHeightCm() auto-detects inches vs cm and normalises to cm.
  const heightCmSource = resolveHeightCm(
    (profile?.height ?? parseFloat(localStorage.getItem("metrix_calc_height_cm") ?? "")) || null
  );

  const computeBMI = (kg: number) => {
    if (!heightCmSource) return null;
    const hM = heightCmSource / 100;
    return kg / (hM * hM);
  };

  // Latest logged weight from backend; fall back to calculator-entered weight
  const latestKg = weights.at(-1)?.weight
    ?? (parseFloat(localStorage.getItem("metrix_latest_weight_kg") ?? "") || null);
  const latestDisplay = latestKg !== null ? toDisplay(latestKg) : null;
  const currentBMI    = latestKg !== null ? computeBMI(latestKg) : null;

  // Live preview while typing the log-weight field
  const previewKg = newWeight
    ? (isMetric ? parseFloat(newWeight) : lbsToKg(parseFloat(newWeight)))
    : null;
  const previewBMI = previewKg && previewKg > 0 ? computeBMI(previewKg) : null;
  const displayedWeight = previewKg && previewKg > 0 ? toDisplay(previewKg) : latestDisplay;
  const displayedBMI    = previewBMI ?? currentBMI;
  const displayedCat    = displayedBMI ? bmiCategory(displayedBMI) : null;

  // Trend
  const trend = weights.length >= 2
    ? weights.at(-1)!.weight - weights.at(-2)!.weight
    : null;

  const handleLogWeight = async () => {
    const n = parseFloat(newWeight);
    if (isNaN(n) || n <= 0) return;
    setSaving(true);
    try {
      const kg = isMetric ? n : lbsToKg(n);
      await api.post("/bodyweights/", {
        user: DEFAULT_USER_ID,
        weight: kg,
      });
      // Persist so Calculators page auto-fills its weight fields
      localStorage.setItem("metrix_latest_weight_kg", kg.toString());
      setNewWeight("");
      await fetchData();
    } catch (err) {
      console.error("Error logging weight", err);
    } finally {
      setSaving(false);
    }
  };

  // Weight chart for selected month
  const weightGroup  = monthGroups[activeWeightMonth] ?? null;
  const weightChartData = (weightGroup?.entries ?? []).map(e => ({
    date:   e.date,
    weight: parseFloat(toDisplay(e.weight).toFixed(1)),
  }));

  // BMI chart for selected month (only if height is known)
  const bmiGroup     = monthGroups[activeBmiMonth] ?? null;
  const bmiChartData = heightCmSource
    ? (bmiGroup?.entries ?? []).map(e => ({
        date: e.date,
        bmi:  parseFloat((computeBMI(e.weight) ?? 0).toFixed(2)),
      }))
    : [];

  const wMin = weightChartData.length ? Math.min(...weightChartData.map(d => d.weight)) - 2 : 0;
  const wMax = weightChartData.length ? Math.max(...weightChartData.map(d => d.weight)) + 2 : 100;
  const bMin = bmiChartData.length    ? Math.min(...bmiChartData.map(d => d.bmi)) - 1 : 15;
  const bMax = bmiChartData.length    ? Math.max(...bmiChartData.map(d => d.bmi)) + 1 : 35;

  const xTickFmt = (v: string) =>
    new Date(v + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric" });

  return (
    <div className="p-10 space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Progress Tracker</h1>
          <p className="text-muted-foreground mt-2">Monitor your weight and BMI over time.</p>
        </div>
        <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
          {isMetric ? "Metric (kg)" : "Imperial (lbs)"}
        </span>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Weight */}
        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center space-y-1 min-h-[140px]">
            <Scale className="w-7 h-7 text-blue-500 mb-1" />
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current Weight</h3>
            <span className="text-4xl font-black">
              {displayedWeight !== null ? displayedWeight.toFixed(1) : "—"}
            </span>
            <span className="text-sm text-muted-foreground">{weightUnit}</span>
            {trend !== null && (
              <span className={`flex items-center text-xs font-semibold mt-1 ${trend <= 0 ? "text-green-400" : "text-red-400"}`}>
                {trend <= 0
                  ? <TrendingDown className="w-3 h-3 mr-1"/>
                  : <TrendingUp   className="w-3 h-3 mr-1"/>}
                {trend > 0 ? "+" : ""}{toDisplay(trend).toFixed(1)} {weightUnit} vs last entry
              </span>
            )}
          </CardContent>
        </Card>

        {/* BMI */}
        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center space-y-1 min-h-[140px]">
            {displayedBMI
              ? <TrendingUp className="w-7 h-7 text-green-500 mb-1" />
              : <AlertCircle className="w-7 h-7 text-yellow-500 mb-1" />
            }
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">BMI</h3>
            <span className={`text-4xl font-black ${displayedCat?.color ?? ""}`}>
              {displayedBMI ? displayedBMI.toFixed(1) : "—"}
            </span>
            {displayedBMI && displayedCat && (
              <span className={`text-xs font-semibold ${displayedCat.color}`}>{displayedCat.label}</span>
            )}
            {!heightCmSource && (
              <span className="text-xs text-yellow-500 mt-1 text-center">
                Enter height in Calculators or Settings
              </span>
            )}
          </CardContent>
        </Card>

        {/* Log Weight */}
        <Card className="border-primary/30">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-base font-bold">Log Today's Weight</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="number"
                step={isMetric ? 0.1 : 0.25}
                value={newWeight}
                onChange={e => setNewWeight(e.target.value)}
                className="flex-1 h-11 border rounded-lg px-3 bg-background font-semibold text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder={isMetric ? "e.g. 75.5" : "e.g. 166.5"}
              />
              <span className="text-sm text-muted-foreground font-medium">{weightUnit}</span>
            </div>
            <Button
              className="w-full"
              onClick={handleLogWeight}
              disabled={!newWeight || parseFloat(newWeight) <= 0 || saving}
            >
              {saving ? "Saving..." : "Save Weight"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Weight Chart ── */}
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle>Weight History</CardTitle>
          </div>
          <MonthTabs groups={monthGroups} activeIdx={activeWeightMonth} setActiveIdx={setActiveWeightMonth} />
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground animate-pulse">Loading...</div>
          ) : weightChartData.length < 2 ? (
            <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl space-y-2">
              <Scale className="w-10 h-10 opacity-20" />
              <p className="text-sm">Log at least two entries to see the chart.</p>
            </div>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
                  <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 11 }} tickMargin={8}
                    axisLine={false} tickLine={false} tickFormatter={xTickFmt} />
                  <YAxis domain={[wMin, wMax]} tick={{ fill: "#888", fontSize: 11 }} axisLine={false}
                    tickLine={false} tickFormatter={(v) => `${v}${weightUnit}`} width={58} />
                  <Tooltip content={<WeightTooltip weightUnit={weightUnit} />} />
                  <ReferenceLine y={weightChartData[0].weight} stroke="#888" strokeDasharray="4 4" strokeOpacity={0.3} />
                  <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={3}
                    dot={{ r: 4, fill: "#3b82f6", strokeWidth: 2, stroke: "#1e3a5f" }}
                    activeDot={{ r: 6, strokeWidth: 0, fill: "#60a5fa" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── BMI Chart ── */}
      {heightCmSource && (
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle>BMI History</CardTitle>
            </div>
            <MonthTabs groups={monthGroups} activeIdx={activeBmiMonth} setActiveIdx={setActiveBmiMonth} />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground animate-pulse">Loading...</div>
            ) : bmiChartData.length < 2 ? (
              <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl space-y-2">
                <TrendingUp className="w-10 h-10 opacity-20" />
                <p className="text-sm">Log at least two weight entries to see your BMI chart.</p>
              </div>
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bmiChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
                    <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 11 }} tickMargin={8}
                      axisLine={false} tickLine={false} tickFormatter={xTickFmt} />
                    <YAxis domain={[bMin, bMax]} tick={{ fill: "#888", fontSize: 11 }} axisLine={false}
                      tickLine={false} tickFormatter={(v) => v.toFixed(1)} width={42} />
                    <Tooltip content={<BMITooltip />} />
                    {/* BMI category reference lines */}
                    <ReferenceLine y={18.5} stroke="#60a5fa" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "18.5", fill: "#60a5fa", fontSize: 10, position: "insideTopLeft" }} />
                    <ReferenceLine y={25}   stroke="#4ade80" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "25",   fill: "#4ade80", fontSize: 10, position: "insideTopLeft" }} />
                    <ReferenceLine y={30}   stroke="#facc15" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "30",   fill: "#facc15", fontSize: 10, position: "insideTopLeft" }} />
                    <Line type="monotone" dataKey="bmi" stroke="#a78bfa" strokeWidth={3}
                      dot={{ r: 4, fill: "#a78bfa", strokeWidth: 2, stroke: "#4c1d95" }}
                      activeDot={{ r: 6, strokeWidth: 0, fill: "#c4b5fd" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
