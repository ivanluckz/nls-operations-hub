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
  const [signups, setSignups] = useState<Record<string, { id: string; created_at: string }>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});

  const COOLDOWN_DAYS = 100;
  const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
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
        (supabase as any).from("workout_signups").select("id, workout_id, created_at").eq("student_id", user.id),
        (supabase as any).from("workout_signups").select("workout_id"),
      ]);

      setWorkouts(wRes.data || []);
      const mine: Record<string, { id: string; created_at: string }> = {};
      (mineRes.data || []).forEach((s: any) => { mine[s.workout_id] = { id: s.id, created_at: s.created_at }; });
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
      const elapsed = daysSince(existing.created_at);
      if (elapsed < COOLDOWN_DAYS) {
        setBusy(false);
        return toast({
          title: "Locked in for now",
          description: `You can leave or switch this workout in ${COOLDOWN_DAYS - elapsed} day(s).`,
          variant: "destructive",
        });
      }
      const { error } = await (supabase as any).from("workout_signups").delete().eq("id", existing.id);
      setBusy(false);
      if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
      toast({ title: "Left workout" });
    } else {
      // Enforce single workout per student client-side (DB also enforces via unique index)
      if (Object.keys(signups).length > 0) {
        setBusy(false);
        return toast({
          title: "Only one workout allowed",
          description: "Leave your current workout first before joining another.",
          variant: "destructive",
        });
      }
      if ((counts[w.id] || 0) >= w.capacity) {
        setBusy(false);
        return toast({ title: "Workout full", variant: "destructive" });
      }
      const { error } = await (supabase as any).from("workout_signups").insert({ workout_id: w.id, student_id: userId });
      setBusy(false);
      if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
      toast({ title: "Signed up! 💪", description: `${w.name} · locked in for ${COOLDOWN_DAYS} days` });
    }
    fetchData();
  };

  if (loading) return null;

  return (
    <Card className="border-2 hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Morning Workouts <span className="ml-1 text-xs font-medium text-destructive">*Required</span></CardTitle>
        </div>
        <CardDescription>Pick ONE workout — you're locked in for {COOLDOWN_DAYS} days. You cannot join more than one.</CardDescription>
      </CardHeader>
      <CardContent>
        {workouts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">No workouts available yet.</p>
        ) : (
          <div className="space-y-2">
            {workouts.map((w) => {
              const count = counts[w.id] || 0;
              const signup = signups[w.id];
              const joined = !!signup;
              const full = count >= w.capacity;
              const elapsed = signup ? daysSince(signup.created_at) : 0;
              const locked = joined && elapsed < COOLDOWN_DAYS;
              const daysLeft = COOLDOWN_DAYS - elapsed;
              return (
                <div key={w.id} className={`flex items-center justify-between rounded-lg border p-3 ${joined ? "border-primary bg-primary/5" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{w.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Calendar className="h-3 w-3" />
                      {w.days_of_week.join(" · ")}
                    </p>
                    {w.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{w.description}</p>}
                    {locked && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                        🔒 Locked for {daysLeft} more day{daysLeft === 1 ? "" : "s"}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge variant={full && !joined ? "destructive" : "secondary"} className="text-[10px]">
                      <Users className="h-3 w-3 mr-1" />{count}/{w.capacity}
                    </Badge>
                    <Button
                      size="sm"
                      variant={joined ? "default" : "outline"}
                      disabled={busy || (full && !joined) || locked}
                      onClick={() => toggle(w)}
                    >
                      {joined ? (locked ? "Locked" : "Leave") : full ? "Full" : "Join"}
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
