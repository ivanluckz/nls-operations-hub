import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Dumbbell, MapPin, Plus, Pencil, Trash2, Users } from "lucide-react";
import { DAYS_OF_WEEK } from "@/lib/constants";

type WorkoutLocation = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  is_active: boolean;
};

type WorkoutSession = {
  id: string;
  title: string;
  location_id: string | null;
  day_of_week: string;
  start_time: string;
  capacity: number;
  description: string;
  is_active: boolean;
};

type Signup = {
  id: string;
  session_id: string;
  student_id: string;
  student?: { full_name: string; email: string };
};

const emptyLocation = { name: "", emoji: "💪", description: "", is_active: true };
const emptySession = {
  title: "",
  location_id: "",
  day_of_week: "Monday",
  start_time: "06:00",
  capacity: 30,
  description: "",
  is_active: true,
};

const AdminWorkouts = () => {
  const { toast } = useToast();
  const [locations, setLocations] = useState<WorkoutLocation[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(true);

  const [locDialog, setLocDialog] = useState(false);
  const [locForm, setLocForm] = useState<any>(emptyLocation);
  const [editingLoc, setEditingLoc] = useState<string | null>(null);

  const [sessDialog, setSessDialog] = useState(false);
  const [sessForm, setSessForm] = useState<any>(emptySession);
  const [editingSess, setEditingSess] = useState<string | null>(null);

  const [signupsOpen, setSignupsOpen] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [locRes, sessRes, signRes] = await Promise.all([
      (supabase as any).from("workout_locations").select("*").order("name"),
      (supabase as any).from("workout_sessions").select("*").order("day_of_week"),
      (supabase as any).from("workout_session_signups").select("id, session_id, student_id"),
    ]);
    setLocations(locRes.data || []);
    setSessions(sessRes.data || []);

    // hydrate signups with student names in one extra query
    const ids = Array.from(new Set((signRes.data || []).map((s: any) => s.student_id)));
    let profiles: any[] = [];
    if (ids.length) {
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids as string[]);
      profiles = data || [];
    }
    const byId = new Map(profiles.map((p) => [p.id, p]));
    setSignups(
      (signRes.data || []).map((s: any) => ({ ...s, student: byId.get(s.student_id) }))
    );
    setLoading(false);
  };

  /* ---------------- Location handlers ---------------- */
  const openNewLocation = () => {
    setEditingLoc(null);
    setLocForm(emptyLocation);
    setLocDialog(true);
  };
  const openEditLocation = (loc: WorkoutLocation) => {
    setEditingLoc(loc.id);
    setLocForm({ name: loc.name, emoji: loc.emoji, description: loc.description, is_active: loc.is_active });
    setLocDialog(true);
  };
  const saveLocation = async () => {
    if (!locForm.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const payload = {
      name: locForm.name.trim(),
      emoji: locForm.emoji || "💪",
      description: locForm.description || "",
      is_active: locForm.is_active,
    };
    const res = editingLoc
      ? await (supabase as any).from("workout_locations").update(payload).eq("id", editingLoc)
      : await (supabase as any).from("workout_locations").insert(payload);
    if (res.error) {
      toast({ title: "Error", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editingLoc ? "Location updated" : "Location created" });
    setLocDialog(false);
    fetchAll();
  };
  const deleteLocation = async (id: string) => {
    if (!confirm("Delete this location? Sessions using it will keep working but lose the link.")) return;
    const { error } = await (supabase as any).from("workout_locations").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchAll();
  };

  /* ---------------- Session handlers ---------------- */
  const openNewSession = () => {
    setEditingSess(null);
    setSessForm({ ...emptySession, location_id: locations[0]?.id || "" });
    setSessDialog(true);
  };
  const openEditSession = (s: WorkoutSession) => {
    setEditingSess(s.id);
    setSessForm({
      title: s.title,
      location_id: s.location_id || "",
      day_of_week: s.day_of_week,
      start_time: s.start_time?.slice(0, 5) || "06:00",
      capacity: s.capacity,
      description: s.description,
      is_active: s.is_active,
    });
    setSessDialog(true);
  };
  const saveSession = async () => {
    if (!sessForm.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload: any = {
      title: sessForm.title.trim(),
      location_id: sessForm.location_id || null,
      day_of_week: sessForm.day_of_week,
      start_time: sessForm.start_time,
      capacity: Number(sessForm.capacity) || 30,
      description: sessForm.description || "",
      is_active: sessForm.is_active,
    };
    if (!editingSess) payload.created_by = user.id;
    const res = editingSess
      ? await (supabase as any).from("workout_sessions").update(payload).eq("id", editingSess)
      : await (supabase as any).from("workout_sessions").insert(payload);
    if (res.error) {
      toast({ title: "Error", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editingSess ? "Session updated" : "Session created" });
    setSessDialog(false);
    fetchAll();
  };
  const deleteSession = async (id: string) => {
    if (!confirm("Delete this session? All student signups will be removed.")) return;
    const { error } = await (supabase as any).from("workout_sessions").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchAll();
  };

  const removeSignup = async (id: string) => {
    const { error } = await (supabase as any).from("workout_session_signups").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchAll();
  };

  const signupCount = (sessionId: string) => signups.filter((s) => s.session_id === sessionId).length;
  const locName = (id: string | null) => locations.find((l) => l.id === id)?.name || "—";

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Dumbbell className="h-7 w-7 text-primary" />
            Morning Workouts
          </h1>
          <p className="text-muted-foreground">
            Manage workout locations and scheduled sessions. Students sign up themselves.
          </p>
        </div>

        <Tabs defaultValue="sessions">
          <TabsList>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
          </TabsList>

          {/* ---------------- SESSIONS ---------------- */}
          <TabsContent value="sessions" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{sessions.length} session(s)</p>
              <Button onClick={openNewSession}>
                <Plus className="h-4 w-4 mr-1" /> New session
              </Button>
            </div>
            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : sessions.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  No sessions yet. Create your first one.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {sessions.map((s) => {
                  const count = signupCount(s.id);
                  const full = count >= s.capacity;
                  return (
                    <Card key={s.id} className={!s.is_active ? "opacity-60" : ""}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between gap-2">
                          <div>
                            <CardTitle className="text-lg">{s.title}</CardTitle>
                            <CardDescription>
                              {s.day_of_week} · {s.start_time?.slice(0, 5)} · {locName(s.location_id)}
                            </CardDescription>
                          </div>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEditSession(s)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => deleteSession(s.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
                        <div className="flex items-center justify-between">
                          <div className="flex gap-2 items-center">
                            <Badge variant={full ? "destructive" : "secondary"}>
                              <Users className="h-3 w-3 mr-1" />
                              {count}/{s.capacity}
                            </Badge>
                            {!s.is_active && <Badge variant="outline">Inactive</Badge>}
                          </div>
                          <Button size="sm" variant="outline" onClick={() => setSignupsOpen(s.id)}>
                            View signups
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ---------------- LOCATIONS ---------------- */}
          <TabsContent value="locations" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{locations.length} location(s)</p>
              <Button onClick={openNewLocation}>
                <Plus className="h-4 w-4 mr-1" /> New location
              </Button>
            </div>
            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                {locations.map((loc) => (
                  <Card key={loc.id} className={!loc.is_active ? "opacity-60" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{loc.emoji}</span>
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              {loc.name}
                            </CardTitle>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditLocation(loc)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteLocation(loc.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{loc.description || "—"}</p>
                      {!loc.is_active && <Badge variant="outline" className="mt-2">Inactive</Badge>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ---------------- Location dialog ---------------- */}
      <Dialog open={locDialog} onOpenChange={setLocDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLoc ? "Edit location" : "New location"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={locForm.name} onChange={(e) => setLocForm({ ...locForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Emoji</Label>
              <Input
                maxLength={4}
                value={locForm.emoji}
                onChange={(e) => setLocForm({ ...locForm, emoji: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={locForm.description}
                onChange={(e) => setLocForm({ ...locForm, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={locForm.is_active}
                onCheckedChange={(v) => setLocForm({ ...locForm, is_active: v })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLocDialog(false)}>Cancel</Button>
            <Button onClick={saveLocation}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Session dialog ---------------- */}
      <Dialog open={sessDialog} onOpenChange={setSessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSess ? "Edit session" : "New session"}</DialogTitle>
            <DialogDescription>Schedule a morning workout. Students will see and join it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                value={sessForm.title}
                onChange={(e) => setSessForm({ ...sessForm, title: e.target.value })}
                placeholder="e.g. Strength & Conditioning"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Location</Label>
                <Select
                  value={sessForm.location_id}
                  onValueChange={(v) => setSessForm({ ...sessForm, location_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Pick location" /></SelectTrigger>
                  <SelectContent>
                    {locations.filter((l) => l.is_active || l.id === sessForm.location_id).map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.emoji} {l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Day</Label>
                <Select
                  value={sessForm.day_of_week}
                  onValueChange={(v) => setSessForm({ ...sessForm, day_of_week: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start time</Label>
                <Input
                  type="time"
                  value={sessForm.start_time}
                  onChange={(e) => setSessForm({ ...sessForm, start_time: e.target.value })}
                />
              </div>
              <div>
                <Label>Capacity</Label>
                <Input
                  type="number"
                  min={1}
                  value={sessForm.capacity}
                  onChange={(e) => setSessForm({ ...sessForm, capacity: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={sessForm.description}
                onChange={(e) => setSessForm({ ...sessForm, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={sessForm.is_active}
                onCheckedChange={(v) => setSessForm({ ...sessForm, is_active: v })}
              />
              <Label>Active (visible to students)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSessDialog(false)}>Cancel</Button>
            <Button onClick={saveSession}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Signups dialog ---------------- */}
      <Dialog open={!!signupsOpen} onOpenChange={(o) => !o && setSignupsOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Signups</DialogTitle>
            <DialogDescription>
              {sessions.find((s) => s.id === signupsOpen)?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {signups.filter((s) => s.session_id === signupsOpen).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No signups yet.</p>
            ) : (
              signups
                .filter((s) => s.session_id === signupsOpen)
                .map((s) => (
                  <div key={s.id} className="flex items-center justify-between border rounded-md p-2">
                    <div>
                      <p className="text-sm font-medium">{s.student?.full_name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{s.student?.email}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removeSignup(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminWorkouts;
