import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { api, DEFAULT_USER_ID } from "@/lib/api";

interface UserProfile {
  id: number;
  username: string;
  height: number | null;
  daily_calorie_goal: number;
  daily_protein_goal: number;
  daily_carbs_goal: number;
  daily_fat_goal: number;
}

export function Settings() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isMetric, setIsMetric] = useState<boolean>(() => {
    return localStorage.getItem("metrix_unit_system") !== "imperial";
  });

  useEffect(() => {
    async function fetchProfile() {
      try {
        const data = await api.get<UserProfile>(`/users/${DEFAULT_USER_ID}/`);
        setProfile(data);
      } catch (err: any) {
        setError("Failed to load user profile");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  const handleUnitToggle = (metric: boolean) => {
    setIsMetric(metric);
    localStorage.setItem("metrix_unit_system", metric ? "metric" : "imperial");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!profile) return;
    const { name, value } = e.target;
    setProfile({
      ...profile,
      [name]: value === "" ? null : Number(value),
    });
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const data = await api.put<UserProfile>(`/users/${profile.id}/`, profile);
      setProfile(data);
      setSuccessMsg("Profile updated successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError("Failed to save changes");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-muted-foreground animate-pulse">Loading settings...</div>;
  if (error) return <div className="p-10 text-red-500">{error}</div>;
  if (!profile) return <div className="p-10">Profile not found.</div>;

  const heightLabel = isMetric ? "Height (cm)" : "Height (in)";
  const heightPlaceholder = isMetric ? "e.g. 175" : "e.g. 69";

  return (
    <div className="p-10 space-y-8 animate-in fade-in duration-500 max-w-4xl">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your goals and profile details.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Units Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Unit System</CardTitle>
            <p className="text-sm text-muted-foreground">Choose between metric and imperial measurements.</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <span className={`text-sm font-semibold transition-colors ${!isMetric ? "text-foreground" : "text-muted-foreground"}`}>
                Imperial
              </span>
              <Toggle checked={isMetric} onChange={handleUnitToggle} />
              <span className={`text-sm font-semibold transition-colors ${isMetric ? "text-foreground" : "text-muted-foreground"}`}>
                Metric
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Currently using: <span className="font-semibold text-primary">{isMetric ? "Metric (kg, cm)" : "Imperial (lbs, in)"}</span>
            </p>
          </CardContent>
        </Card>

        {/* Goals Config */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Nutrition Goals</CardTitle>
            <p className="text-sm text-muted-foreground">Set your daily caloric and macronutrient targets.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Daily Calories (kcal)</label>
                <input type="number" name="daily_calorie_goal" value={profile.daily_calorie_goal || 0} onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-blue-500">Daily Protein (g)</label>
                <input type="number" name="daily_protein_goal" value={profile.daily_protein_goal || 0} onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-green-500">Daily Carbs (g)</label>
                <input type="number" name="daily_carbs_goal" value={profile.daily_carbs_goal || 0} onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-yellow-500">Daily Fat (g)</label>
                <input type="number" name="daily_fat_goal" value={profile.daily_fat_goal || 0} onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Body Metrics */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Body Metrics</CardTitle>
            <p className="text-sm text-muted-foreground">Details used to calculate your BMI and other progress indicators.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 max-w-sm">
              <label className="text-sm font-medium">{heightLabel}</label>
              <input
                type="number"
                name="height"
                value={profile.height || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setProfile({ ...profile, height: val === "" ? null : Number(val) });
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={heightPlaceholder}
              />
            </div>

            <div className="pt-4 flex items-center space-x-4">
              <Button onClick={handleSave} disabled={saving} className="rounded-xl px-8">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              {successMsg && <span className="text-sm text-green-500 font-medium">{successMsg}</span>}
              {error && <span className="text-sm text-red-500 font-medium">{error}</span>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
