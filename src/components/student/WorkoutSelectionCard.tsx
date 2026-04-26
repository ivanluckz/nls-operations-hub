import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dumbbell, Users, Calendar } from "lucide-react";

type Workout = {
  id: string;
  name: string;
  description: string;
  days_of_week: string[];
  capacity: number;
};

const WorkoutSelectionCard = () => {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [signups, setSignups] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [wRes, mineRes, allRes] = await Promise.all([
        (supabase as any).from("workouts").select("*").eq("is_active", true).order("name"),
        (supabase as any).from("workout_signups").select("id, workout_id").eq("student_id", user.id),
        (supabase as any).from("workout_signups").select("workout_id"),
      ]);

      setWorkouts(wRes.data || []);
      const mine: Record<string, string> = {};
      (mineRes.data || []).forEach((s: any) => { mine[s.workout_id] = s.id; });
      setSignups(mine);

      const c: Record<string, number> = {};
      (allRes.data || []).forEach((s: any) => { c[s.workout_id] = (c[s.workout_id] || 0) + 1; });
      setCounts(c);
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (w: Workout) => {
    if (!userId) return;
    const existing = signups[w.id];
    setBusy(true);
    if (existing) {
      const { error } = await (supabase as any).from("workout_signups").delete().eq("id", existing);
      setBusy(false);
      if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
      toast({ title: "Left workout" });
    } else {
      if ((counts[w.id] || 0) >= w.capacity) {
        setBusy(false);
        return toast({ title: "Workout full", variant: "destructive" });
      }
      const { error } = await (supabase as any).from("workout_signups").insert({ workout_id: w.id, student_id: userId });
      setBusy(false);
      if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
      toast({ title: "Signed up! 💪", description: w.name });
    }
    fetchData();
  };

  if (loading) return null;

  return (
    <Card className="border-2 hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Morning Workouts</CardTitle>
        </div>
        <CardDescription>Pick the workouts you want to attend each week</CardDescription>
      </CardHeader>
      <CardContent>
        {workouts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">No workouts available yet.</p>
        ) : (
          <div className="space-y-2">
            {workouts.map((w) => {
              const count = counts[w.id] || 0;
              const joined = !!signups[w.id];
              const full = count >= w.capacity;
              return (
                <div key={w.id} className={`flex items-center justify-between rounded-lg border p-3 ${joined ? "border-primary bg-primary/5" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{w.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Calendar className="h-3 w-3" />
                      {w.days_of_week.join(" · ")}
                    </p>
                    {w.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{w.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge variant={full && !joined ? "destructive" : "secondary"} className="text-[10px]">
                      <Users className="h-3 w-3 mr-1" />{count}/{w.capacity}
                    </Badge>
                    <Button
                      size="sm"
                      variant={joined ? "default" : "outline"}
                      disabled={busy || (full && !joined)}
                      onClick={() => toggle(w)}
                    >
                      {joined ? "Leave" : full ? "Full" : "Join"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkoutSelectionCard;
