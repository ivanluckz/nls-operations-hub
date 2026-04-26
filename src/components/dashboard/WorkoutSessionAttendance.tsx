import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dumbbell, Check, Users, Calendar } from "lucide-react";

type Workout = {
  id: string;
  name: string;
  days_of_week: string[];
  capacity: number;
};
type Signup = { id: string; workout_id: string; student_id: string };
type Profile = { id: string; full_name: string };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Props {
  /** If true, only show workouts the current user is assigned to as a teacher. */
  teacherScope?: boolean;
}

const WorkoutSessionAttendance = ({ teacherScope = false }: Props) => {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({}); // `${workout_id}:${student_id}` -> true
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const today = new Date();
  const todayDay = DAYS[today.getDay()];
  const todayDate = today.toISOString().slice(0, 10);

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [teacherScope]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Fetch all active workouts. RLS lets everyone authenticated see active workouts.
      const wRes = await (supabase as any).from("workouts").select("*").eq("is_active", true);
      let allWorkouts: Workout[] = wRes.data || [];

      // Filter to today + (if teacherScope) only those assigned to this teacher.
      let assignedIds: Set<string> | null = null;
      if (teacherScope) {
        const wtRes = await (supabase as any)
          .from("workout_teachers")
          .select("workout_id")
          .eq("teacher_id", user.id);
        assignedIds = new Set((wtRes.data || []).map((r: any) => r.workout_id));
      }

      const todayWorkouts = allWorkouts.filter(
        (w) => w.days_of_week.includes(todayDay) && (!assignedIds || assignedIds.has(w.id))
      );
      setWorkouts(todayWorkouts);

      const todayIds = new Set(todayWorkouts.map((w) => w.id));

      const [sRes, attRes] = await Promise.all([
        (supabase as any).from("workout_signups").select("id, workout_id, student_id"),
        (supabase as any).from("workout_attendance").select("student_id, workout_id").eq("workout_date", todayDate),
      ]);

      const relevantSignups: Signup[] = (sRes.data || []).filter((s: Signup) => todayIds.has(s.workout_id));
      setSignups(relevantSignups);

      const studentIds = Array.from(new Set(relevantSignups.map((s) => s.student_id)));
      if (studentIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", studentIds);
        const map: Record<string, Profile> = {};
        (profs || []).forEach((p: any) => { map[p.id] = p; });
        setProfiles(map);
      } else {
        setProfiles({});
      }

      const m: Record<string, boolean> = {};
      (attRes.data || []).forEach((a: any) => { m[`${a.workout_id || ""}:${a.student_id}`] = true; });
      setMarked(m);
    } finally {
      setLoading(false);
    }
  };

  const markPresent = async (workoutId: string, workoutName: string, studentId: string) => {
    if (!userId) return;
    const key = `${workoutId}:${studentId}`;
    setBusy(key);
    const { error } = await (supabase as any).from("workout_attendance").insert({
      student_id: studentId,
      scanned_by: userId,
      workout_date: todayDate,
      workout_id: workoutId,
      location: workoutName,
      status: "present",
    });
    setBusy(null);
    if (error) {
      toast({ title: "Couldn't mark present", description: error.message, variant: "destructive" });
      return;
    }
    setMarked((prev) => ({ ...prev, [key]: true }));
    toast({ title: "Marked present 💪" });
  };

  if (loading) return null;

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Morning Workout Attendance</CardTitle>
        </div>
        <CardDescription>
          {todayDay} · {workouts.length} workout{workouts.length === 1 ? "" : "s"}
          {teacherScope ? " assigned to you" : " scheduled"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {workouts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {teacherScope ? "You're not assigned to any workouts today." : "No workouts scheduled today."}
          </p>
        ) : workouts.map((w) => {
          const sessSignups = signups.filter((sg) => sg.workout_id === w.id);
          const presentCount = sessSignups.filter((sg) => marked[`${w.id}:${sg.student_id}`]).length;
          return (
            <div key={w.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{w.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Calendar className="h-3 w-3" />{w.days_of_week.join(" · ")}
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  <Users className="h-3 w-3 mr-1" />{presentCount}/{sessSignups.length} present
                </Badge>
              </div>
              {sessSignups.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No students signed up.</p>
              ) : (
                <div className="space-y-1">
                  {sessSignups.map((sg) => {
                    const p = profiles[sg.student_id];
                    const key = `${w.id}:${sg.student_id}`;
                    const isPresent = !!marked[key];
                    return (
                      <div key={sg.id} className={`flex items-center justify-between rounded-md px-2 py-1.5 ${isPresent ? "bg-primary/5" : "bg-muted/40"}`}>
                        <span className="text-sm truncate">{p?.full_name || "Unknown"}</span>
                        {isPresent ? (
                          <Badge className="text-[10px]"><Check className="h-3 w-3 mr-1" />Present</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={busy === key}
                            onClick={() => markPresent(w.id, w.name, sg.student_id)}
                          >
                            Mark present
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default WorkoutSessionAttendance;
