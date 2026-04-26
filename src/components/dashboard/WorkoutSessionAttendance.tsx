import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dumbbell, Check, Users, Clock, X } from "lucide-react";

type Loc = { id: string; name: string; emoji: string };
type Session = {
  id: string;
  title: string;
  location_id: string | null;
  day_of_week: string;
  start_time: string;
  capacity: number;
  is_active: boolean;
};
type Signup = { id: string; session_id: string; student_id: string };
type Profile = { id: string; full_name: string };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const WorkoutSessionAttendance = () => {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [locations, setLocations] = useState<Loc[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({}); // student_id -> present today
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const today = new Date();
  const todayDay = DAYS[today.getDay()];
  const todayDate = today.toISOString().slice(0, 10);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [locRes, sessRes, signRes, attRes] = await Promise.all([
        (supabase as any).from("workout_locations").select("id,name,emoji").eq("is_active", true),
        (supabase as any).from("workout_sessions").select("*").eq("is_active", true).eq("day_of_week", todayDay),
        (supabase as any).from("workout_session_signups").select("id, session_id, student_id"),
        (supabase as any).from("workout_attendance").select("student_id").eq("workout_date", todayDate),
      ]);

      setLocations(locRes.data || []);
      const todaySessions: Session[] = sessRes.data || [];
      setSessions(todaySessions);

      const todaySessionIds = new Set(todaySessions.map((s) => s.id));
      const relevantSignups: Signup[] = (signRes.data || []).filter((s: Signup) => todaySessionIds.has(s.session_id));
      setSignups(relevantSignups);

      const studentIds = Array.from(new Set(relevantSignups.map((s) => s.student_id)));
      if (studentIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", studentIds);
        const map: Record<string, Profile> = {};
        (profs || []).forEach((p: any) => { map[p.id] = p; });
        setProfiles(map);
      }

      const m: Record<string, boolean> = {};
      (attRes.data || []).forEach((a: any) => { m[a.student_id] = true; });
      setMarked(m);
    } finally {
      setLoading(false);
    }
  };

  const markPresent = async (studentId: string, location: string) => {
    if (!userId) return;
    setBusy(studentId);
    const { error } = await (supabase as any).from("workout_attendance").insert({
      student_id: studentId,
      scanned_by: userId,
      workout_date: todayDate,
      location,
      status: "present",
    });
    setBusy(null);
    if (error) {
      toast({ title: "Couldn't mark present", description: error.message, variant: "destructive" });
      return;
    }
    setMarked((prev) => ({ ...prev, [studentId]: true }));
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
        <CardDescription>{todayDay} · {sessions.length} session{sessions.length === 1 ? "" : "s"} scheduled</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No workout sessions scheduled today.</p>
        ) : sessions.map((s) => {
          const loc = locations.find((l) => l.id === s.location_id);
          const sessSignups = signups.filter((sg) => sg.session_id === s.id);
          const presentCount = sessSignups.filter((sg) => marked[sg.student_id]).length;
          return (
            <div key={s.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm flex items-center gap-1.5">
                    <span className="text-base">{loc?.emoji}</span>
                    {s.title}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Clock className="h-3 w-3" />{s.start_time?.slice(0, 5)} {loc ? `· ${loc.name}` : ""}
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
                    const isPresent = !!marked[sg.student_id];
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
                            disabled={busy === sg.student_id}
                            onClick={() => markPresent(sg.student_id, loc?.name || "Unknown")}
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
