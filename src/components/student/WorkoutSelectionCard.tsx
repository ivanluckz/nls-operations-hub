import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Dumbbell, Check } from "lucide-react";
import { WORKOUT_LOCATIONS, type WorkoutLocation } from "@/lib/constants";

const locationConfig: Record<WorkoutLocation, { emoji: string; description: string }> = {
  Courts: { emoji: "🏀", description: "Basketball, volleyball, etc." },
  Pitch: { emoji: "⚽", description: "Football, rugby, track" },
  Competition: { emoji: "🏆", description: "Competition prep & drills" },
};

const WorkoutSelectionCard = () => {
  const { toast } = useToast();
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("workout_location")
        .eq("id", user.id)
        .single();

      setSelectedLocation((profile as any)?.workout_location || null);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (location: WorkoutLocation) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({ workout_location: location } as any)
        .eq("id", user.id);

      if (error) throw error;

      setSelectedLocation(location);
      toast({ title: "Workout Location Set! 💪", description: `You'll be at ${location}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Card className="border-2 hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Morning Workout</CardTitle>
        </div>
        <CardDescription>
          {selectedLocation ? `You're training at ${selectedLocation}` : "Choose where you work out"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {WORKOUT_LOCATIONS.map((loc) => {
            const config = locationConfig[loc];
            const isSelected = loc === selectedLocation;
            return (
              <button
                key={loc}
                disabled={saving}
                onClick={() => handleSelect(loc)}
                className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all hover:scale-105 ${
                  isSelected
                    ? "border-primary bg-primary/10 shadow-md"
                    : "border-muted hover:border-primary/40"
                }`}
              >
                {isSelected && (
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
                <span className="text-3xl">{config.emoji}</span>
                <span className="text-sm font-semibold">{loc}</span>
                <span className="text-[10px] text-muted-foreground text-center leading-tight">{config.description}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkoutSelectionCard;
