import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Clock, XCircle, CheckCircle2 } from "lucide-react";
import { format, subDays } from "date-fns";

interface WorkoutNotification {
  id: string;
  workout_date: string;
  status: string;
  notes: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

const WorkoutNotificationsCard = () => {
  const [notifications, setNotifications] = useState<WorkoutNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel("student-workout-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "workout_notifications" }, () => fetchNotifications())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const twoWeeksAgo = subDays(new Date(), 14).toISOString().split("T")[0];
    const { data } = await (supabase as any)
      .from("workout_notifications")
      .select("id, workout_date, status, notes, acknowledged_at, created_at")
      .eq("student_id", user.id)
      .gte("workout_date", twoWeeksAgo)
      .order("workout_date", { ascending: false })
      .limit(20);

    setNotifications(data || []);
    setLoading(false);
  };

  if (loading || notifications.length === 0) return null;

  const absentCount = notifications.filter(n => n.status === "absent").length;
  const lateCount = notifications.filter(n => n.status === "late").length;
  const isFlagged = absentCount >= 3 || lateCount >= 5;

  return (
    <Card className={`border ${isFlagged ? "border-destructive/40 bg-destructive/5" : "border-amber-500/30 bg-amber-500/5"}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {isFlagged ? (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          ) : (
            <Clock className="h-5 w-5 text-amber-500" />
          )}
          <span>Morning Workout Alerts</span>
          {isFlagged && (
            <span className="ml-auto text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
              Flagged
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <XCircle className="h-4 w-4 text-destructive" />
            <span className="font-medium">{absentCount}</span>
            <span className="text-muted-foreground">absent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="font-medium">{lateCount}</span>
            <span className="text-muted-foreground">late</span>
          </div>
          <span className="text-xs text-muted-foreground ml-auto">Last 14 days</span>
        </div>

        {isFlagged && (
          <p className="text-xs text-destructive/80 bg-destructive/10 rounded-lg px-3 py-2">
            ⚠️ You have been flagged for consistent absences. Please speak with your RL Coach.
          </p>
        )}

        {/* Recent entries */}
        <div className="space-y-1.5">
          {notifications.slice(0, 5).map((n) => (
            <div key={n.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-md bg-background/60">
              <div className="flex items-center gap-2">
                {n.status === "absent" ? (
                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                ) : n.status === "late" ? (
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="capitalize font-medium">{n.status}</span>
              </div>
              <span className="text-muted-foreground">
                {format(new Date(n.workout_date), "EEE, MMM d")}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkoutNotificationsCard;
