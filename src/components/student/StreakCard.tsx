import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Flame, Utensils, Dumbbell, Activity, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Streak {
  streak_type: string;
  current_streak: number;
  longest_streak: number;
}

interface Milestone {
  milestone_type: string;
  streak_type: string;
  achieved_at: string;
}

const STREAK_CONFIG: Record<string, { label: string; icon: typeof Flame; color: string }> = {
  activity: { label: "Activities", icon: Activity, color: "text-blue-500" },
  meal: { label: "Meals", icon: Utensils, color: "text-emerald-500" },
  workout: { label: "Workouts", icon: Dumbbell, color: "text-orange-500" },
};

const MILESTONES = [7, 14, 30, 50, 100];
function nextMilestone(current: number): number {
  return MILESTONES.find(m => m > current) || 100;
}

const StreakCard = () => {
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [streakRes, milestoneRes] = await Promise.all([
        supabase.from("attendance_streaks" as any).select("streak_type, current_streak, longest_streak").eq("student_id", user.id),
        supabase.from("streak_milestones" as any).select("milestone_type, streak_type, achieved_at").eq("student_id", user.id),
      ]);

      const streakData = (streakRes.data || []) as unknown as Streak[];
      setStreaks(streakData);

      // Check for new milestones to celebrate
      const seen = JSON.parse(localStorage.getItem("seen_milestones") || "[]");
      const milestones = (milestoneRes.data || []) as unknown as Milestone[];
      const newOnes = milestones.filter(m => !seen.includes(`${m.milestone_type}_${m.streak_type}`));
      if (newOnes.length > 0) {
        const latest = newOnes[newOnes.length - 1];
        const cfg = STREAK_CONFIG[latest.streak_type];
        const days = latest.milestone_type.replace("_day", "");
        toast({
          title: `🎉 ${days}-Day Streak!`,
          description: `You hit a ${days}-day ${cfg?.label || latest.streak_type} streak!`,
        });
        const allIds = milestones.map(m => `${m.milestone_type}_${m.streak_type}`);
        localStorage.setItem("seen_milestones", JSON.stringify(allIds));
      }

      setLoading(false);
    };
    load();
  }, [toast]);

  if (loading) return null;
  if (streaks.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            Streaks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Attend activities, meals, or workouts on consecutive days to build streaks!
          </p>
        </CardContent>
      </Card>
    );
  }

  const bestStreak = Math.max(...streaks.map(s => s.longest_streak), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          Your Streaks
          {bestStreak > 0 && (
            <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground font-normal">
              <Trophy className="h-3 w-3" /> Best: {bestStreak}d
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(["activity", "meal", "workout"] as const).map(type => {
          const streak = streaks.find(s => s.streak_type === type);
          const cfg = STREAK_CONFIG[type];
          const Icon = cfg.icon;
          const current = streak?.current_streak || 0;
          const next = nextMilestone(current);
          const progress = Math.min((current / next) * 100, 100);

          return (
            <div key={type} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${cfg.color}`} />
                  <span className="text-sm font-medium">{cfg.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {current > 0 && <Flame className="h-3.5 w-3.5 text-orange-500" />}
                  <span className="text-sm font-bold tabular-nums">{current}d</span>
                  <span className="text-xs text-muted-foreground">/ {next}d</span>
                </div>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default StreakCard;
