import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dumbbell, Check, Users, Clock } from "lucide-react";

type Loc = { id: string; name: string; emoji: string; description: string };
type Session = {
  id: string;
  title: string;
  location_id: string | null;
  day_of_week: string;
  start_time: string;
  capacity: number;
  description: string;
};

const WorkoutSelectionCard = () => {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [locations, setLocations] = useState<Loc[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [signups, setSignups] = useState<Record<string, string>>({}); // session_id -> signup id
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [profileRes, locRes, sessRes, mySignupsRes, allSignupsRes] = await Promise.all([
        supabase.from("profiles").select("workout_location").eq("id", user.id).single(),
        (supabase as any).from("workout_locations").select("*").eq("is_active", true).order("name"),
        (supabase as any).from("workout_sessions").select("*").eq("is_active", true).order("day_of_week"),
        (supabase as any).from("workout_session_signups").select("id, session_id").eq("student_id", user.id),
        (supabase as any).from("workout_session_signups").select("session_id"),
      ]);

      setSelectedLocation((profileRes.data as any)?.workout_location || null);
      setLocations(locRes.data || []);
      setSessions(sessRes.data || []);

      const mine: Record<string, string> = {};
      (mySignupsRes.data || []).forEach((s: any) => { mine[s.session_id] = s.id; });
      setSignups(mine);

      const c: Record<string, number> = {};
      (allSignupsRes.data || []).forEach((s: any) => { c[s.session_id] = (c[s.session_id] || 0) + 1; });
      setCounts(c);
    } finally {
      setLoading(false);
    }
  };

  const selectLocation = async (loc: Loc) => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ workout_location: loc.name } as any).eq("id", userId);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setSelectedLocation(loc.name);
    toast({ title: "Workout location set 💪", description: `You'll be at ${loc.name}` });
  };

  const toggleSession = async (sess: Session) => {
    if (!userId) return;
    const existing = signups[sess.id];
    setSaving(true);
    if (existing) {
      const { error } = await (supabase as any).from("workout_session_signups").delete().eq("id", existing);
      setSaving(false);
      if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
      toast({ title: "Removed from session" });
    } else {
      if ((counts[sess.id] || 0) >= sess.capacity) {
        setSaving(false);
        return toast({ title: "Session full", variant: "destructive" });
      }
      const { error } = await (supabase as any).from("workout_session_signups")
        .insert({ session_id: sess.id, student_id: userId });
      setSaving(false);
      if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
      toast({ title: "Signed up! 💪", description: sess.title });
    }
    fetchData();
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
          {selectedLocation ? `Default location: ${selectedLocation}` : "Pick a default location, then join sessions below"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {locations.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Default location</p>
            <div className="grid grid-cols-3 gap-2">
              {locations.map((loc) => {
                const isSelected = loc.name === selectedLocation;
                return (
                  <button
                    key={loc.id}
                    disabled={saving}
                    onClick={() => selectLocation(loc)}
                    className={`relative flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all hover:scale-105 ${
                      isSelected ? "border-primary bg-primary/10 shadow-md" : "border-muted hover:border-primary/40"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                    <span className="text-2xl">{loc.emoji}</span>
                    <span className="text-xs font-semibold">{loc.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Available sessions</p>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">No sessions scheduled yet.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => {
                const count = counts[s.id] || 0;
                const joined = !!signups[s.id];
                const full = count >= s.capacity;
                const loc = locations.find((l) => l.id === s.location_id);
                return (
                  <div key={s.id} className={`flex items-center justify-between rounded-lg border p-2.5 ${joined ? "border-primary bg-primary/5" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {loc?.emoji} {s.title}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {s.day_of_week} · {s.start_time?.slice(0, 5)} {loc ? `· ${loc.name}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={full && !joined ? "destructive" : "secondary"} className="text-[10px]">
                        <Users className="h-3 w-3 mr-1" />{count}/{s.capacity}
                      </Badge>
                      <Button
                        size="sm"
                        variant={joined ? "default" : "outline"}
                        disabled={saving || (full && !joined)}
                        onClick={() => toggleSession(s)}
                      >
                        {joined ? "Leave" : full ? "Full" : "Join"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkoutSelectionCard;
