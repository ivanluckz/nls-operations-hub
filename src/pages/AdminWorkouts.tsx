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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Dumbbell, Plus, Pencil, Trash2, Users, Trash, Download } from "lucide-react";
import { exportWorkoutsToExcel, exportWorkoutsAsCSV } from "@/lib/workout-export";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

type Workout = {
  id: string;
  name: string;
  description: string;
  days_of_week: string[];
  capacity: number;
  is_active: boolean;
};
type WT = { id: string; workout_id: string; teacher_id: string };
type Signup = { id: string; workout_id: string; student_id: string; created_at: string };
type Profile = { id: string; full_name: string; email: string };

const emptyForm = {
  name: "",
  description: "",
  days_of_week: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  capacity: 30,
  is_active: true,
  teacher_ids: [] as string[],
};

const AdminWorkouts = () => {
  const { toast } = useToast();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [wTeachers, setWTeachers] = useState<WT[]>([]);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);

  const [signupsOpen, setSignupsOpen] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<Record<string, { status: string; id: string }>>({});

  useEffect(() => { fetchAll(); }, []);

  const loadAttendance = async (workoutId: string) => {
    const { data } = await (supabase as any)
      .from("workout_attendance")
      .select("id, student_id, status")
      .eq("workout_id", workoutId)
      .gte("workout_date", new Date().toISOString().split('T')[0]);

    const map: Record<string, { status: string; id: string }> = {};
    (data || []).forEach((record: any) => {
      map[record.student_id] = { status: record.status || 'unmarked', id: record.id };
    });
    setAttendance(map);
  };

  const markAttendance = async (studentId: string, status: string, workoutId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const existing = attendance[studentId]?.id;

    try {
      if (existing) {
        await (supabase as any)
          .from("workout_attendance")
          .update({ status, scanned_at: new Date().toISOString() })
          .eq("id", existing);
      } else {
        await (supabase as any)
          .from("workout_attendance")
          .insert({
            student_id: studentId,
            workout_id: workoutId,
            status,
            workout_date: today,
            scanned_at: new Date().toISOString(),
            scanned_by: user.id,
            location: "Admin"
          });
      }

      setAttendance(prev => ({
        ...prev,
        [studentId]: { status, id: existing || `new_${studentId}` }
      }));
      toast({ title: "✓", description: `Marked as ${status}` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save attendance", variant: "destructive" });
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    const [wRes, wtRes, sRes, teacherRolesRes] = await Promise.all([
      (supabase as any).from("workouts").select("*").order("name"),
      (supabase as any).from("workout_teachers").select("*"),
      (supabase as any).from("workout_signups").select("*"),
      supabase.from("user_roles").select("user_id").eq("role", "teacher"),
    ]);
    setWorkouts(wRes.data || []);
    setWTeachers(wtRes.data || []);
    setSignups(sRes.data || []);

    const teacherIds: string[] = (teacherRolesRes.data || []).map((r: any) => r.user_id as string);
    let teacherProfiles: Profile[] = [];
    if (teacherIds.length) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", teacherIds);
      teacherProfiles = (data || [])
        .filter((p: any) => p?.full_name)
        .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name)) as Profile[];
    }
    setTeachers(teacherProfiles);

    const studentIds: string[] = Array.from(new Set((sRes.data || []).map((s: any) => s.student_id as string)));
    if (studentIds.length) {
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", studentIds);
      const map: Record<string, Profile> = {};
      (data || []).forEach((p: any) => { map[p.id] = p; });
      // also add teachers to map
      teacherProfiles.forEach((t) => { map[t.id] = t; });
      setProfiles(map);
    } else {
      const map: Record<string, Profile> = {};
      teacherProfiles.forEach((t) => { map[t.id] = t; });
      setProfiles(map);
    }
    setLoading(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialog(true);
  };

  const openEdit = (w: Workout) => {
    setEditing(w.id);
    setForm({
      name: w.name,
      description: w.description,
      days_of_week: w.days_of_week,
      capacity: w.capacity,
      is_active: w.is_active,
      teacher_ids: wTeachers.filter((t) => t.workout_id === w.id).map((t) => t.teacher_id),
    });
    setDialog(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast({ title: "Name required", variant: "destructive" });
    if (!form.days_of_week.length) return toast({ title: "Pick at least one day", variant: "destructive" });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload: any = {
      name: form.name.trim(),
      description: form.description || "",
      days_of_week: form.days_of_week,
      capacity: Number(form.capacity) || 30,
      is_active: form.is_active,
    };

    let workoutId = editing;
    if (editing) {
      const { error } = await (supabase as any).from("workouts").update(payload).eq("id", editing);
      if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      payload.created_by = user.id;
      const { data, error } = await (supabase as any).from("workouts").insert(payload).select("id").single();
      if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
      workoutId = data.id;
    }

    // sync teachers
    if (workoutId) {
      const uniqueIds: string[] = Array.from(new Set((form.teacher_ids as string[]).filter(Boolean)));
      const { error: delErr } = await (supabase as any)
        .from("workout_teachers")
        .delete()
        .eq("workout_id", workoutId);
      if (delErr) return toast({ title: "Teacher sync error", description: delErr.message, variant: "destructive" });
      if (uniqueIds.length) {
        const rows = uniqueIds.map((tid) => ({ workout_id: workoutId, teacher_id: tid }));
        const { error } = await (supabase as any)
          .from("workout_teachers")
          .upsert(rows, { onConflict: "workout_id,teacher_id", ignoreDuplicates: true });
        if (error) return toast({ title: "Teacher sync error", description: error.message, variant: "destructive" });
      }
    }

    toast({ title: editing ? "Workout updated" : "Workout created" });
    setDialog(false);
    fetchAll();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this workout? All signups will be removed.")) return;
    const { error } = await (supabase as any).from("workouts").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchAll();
  };

  const COOLDOWN_DAYS = 100;
  const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

  const removeSignup = async (s: Signup, studentName: string) => {
    const elapsed = daysSince(s.created_at);
    const locked = elapsed < COOLDOWN_DAYS;
    const msg = locked
      ? `${studentName} is still in their ${COOLDOWN_DAYS}-day commitment (${COOLDOWN_DAYS - elapsed} day(s) left). Override and remove anyway?`
      : `Remove ${studentName} from this workout?`;
    if (!confirm(msg)) return;
    const { error } = await (supabase as any).from("workout_signups").delete().eq("id", s.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: locked ? "Cooldown overridden" : "Signup removed", description: studentName });
      fetchAll();
    }
  };

  const signupCount = (wid: string) => signups.filter((s) => s.workout_id === wid).length;
  const teachersFor = (wid: string) =>
    wTeachers.filter((t) => t.workout_id === wid).map((t) => profiles[t.teacher_id]).filter(Boolean);

  const toggleDay = (d: string) => {
    setForm((f: any) => ({
      ...f,
      days_of_week: f.days_of_week.includes(d)
        ? f.days_of_week.filter((x: string) => x !== d)
        : [...f.days_of_week, d],
    }));
  };
  const toggleTeacher = (id: string) => {
    setForm((f: any) => ({
      ...f,
      teacher_ids: f.teacher_ids.includes(id)
        ? f.teacher_ids.filter((x: string) => x !== id)
        : [...f.teacher_ids, id],
    }));
  };

  const buildExportData = () => {
    const workoutById: Record<string, Workout> = {};
    workouts.forEach((w) => { workoutById[w.id] = w; });
    return {
      workouts: workouts.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description || "",
        days_of_week: w.days_of_week || [],
        capacity: w.capacity,
        is_active: w.is_active,
        created_at: (w as any).created_at || new Date().toISOString(),
      })),
      teachers: teachers.map((t) => ({ id: t.id, full_name: t.full_name, email: t.email })),
      workoutTeachers: wTeachers.map((wt) => ({
        workout_id: wt.workout_id,
        workout_name: workoutById[wt.workout_id]?.name || "—",
        teacher_id: wt.teacher_id,
        teacher_name: profiles[wt.teacher_id]?.full_name || "—",
      })),
      signups: signups.map((s) => ({
        id: s.id,
        workout_id: s.workout_id,
        workout_name: workoutById[s.workout_id]?.name || "—",
        student_id: s.student_id,
        student_name: profiles[s.student_id]?.full_name || "Unknown",
        student_email: profiles[s.student_id]?.email || "—",
        created_at: s.created_at,
      })),
      profiles,
    };
  };

  const handleDownloadExcel = () => {
    try {
      exportWorkoutsToExcel(buildExportData());
      toast({ title: "✅ Downloaded", description: "Workouts exported to Excel" });
    } catch (error: any) {
      console.error("Excel export failed:", error);
      toast({ title: "Error", description: error?.message || "Failed to export data", variant: "destructive" });
    }
  };

  const handleDownloadCSV = () => {
    try {
      exportWorkoutsAsCSV(buildExportData());
      toast({ title: "✅ Downloaded", description: "Workouts exported as CSV" });
    } catch (error: any) {
      console.error("CSV export failed:", error);
      toast({ title: "Error", description: error?.message || "Failed to export data", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Dumbbell className="h-7 w-7 text-primary" />
              Morning Workouts
            </h1>
            <p className="text-muted-foreground">
              Each workout runs on chosen weekdays. Assign teachers and a capacity. Students sign up themselves.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button onClick={handleDownloadExcel} variant="outline">
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
            <Button onClick={handleDownloadCSV} variant="outline">
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> New workout
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : workouts.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">No workouts yet.</CardContent></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {workouts.map((w) => {
              const count = signupCount(w.id);
              const full = count >= w.capacity;
              const ts = teachersFor(w.id);
              return (
                <Card key={w.id} className={!w.is_active ? "opacity-60" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">{w.name}</CardTitle>
                        <CardDescription>{w.days_of_week.join(" · ")}</CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(w)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(w.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {w.description && <p className="text-sm text-muted-foreground">{w.description}</p>}
                    <div className="flex flex-wrap gap-1">
                      {ts.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">No teachers assigned</span>
                      ) : ts.map((t) => (
                        <Badge key={t.id} variant="outline" className="text-[10px]">{t.full_name}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex gap-2 items-center">
                        <Badge variant={full ? "destructive" : "secondary"}>
                          <Users className="h-3 w-3 mr-1" />{count}/{w.capacity}
                        </Badge>
                        {!w.is_active && <Badge variant="outline">Inactive</Badge>}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setSignupsOpen(w.id)}>
                        View signups
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Workout dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit workout" : "New workout"}</DialogTitle>
            <DialogDescription>Define a workout, the weekdays it runs, capacity and assigned teachers.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Strength & Conditioning" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Days of the week</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {WEEKDAYS.map((d) => {
                  const on = form.days_of_week.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className={`px-3 py-1.5 rounded-md text-xs border transition ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:border-primary/50"}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Capacity (max participants)</Label>
              <Input
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </div>
            <div>
              <Label>Assigned teachers</Label>
              <div className="border rounded-md max-h-44 overflow-y-auto p-1 mt-1">
                {teachers.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2">No teachers found.</p>
                ) : teachers.map((t) => {
                  const on = form.teacher_ids.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTeacher(t.id)}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between ${on ? "bg-primary/10" : "hover:bg-muted"}`}
                    >
                      <span>{t.full_name}</span>
                      {on && <Badge className="text-[10px]">Selected</Badge>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Active (visible to students)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signups dialog */}
      <Dialog open={!!signupsOpen} onOpenChange={(o) => {
        if (o && signupsOpen) {
          loadAttendance(signupsOpen);
        } else {
          setSignupsOpen(null);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enrollment & Attendance</DialogTitle>
            <DialogDescription>{workouts.find((w) => w.id === signupsOpen)?.name}</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {signups.filter((s) => s.workout_id === signupsOpen).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No signups yet.</p>
            ) : (
              signups.filter((s) => s.workout_id === signupsOpen).map((s) => {
                const p = profiles[s.student_id];
                const elapsed = daysSince(s.created_at);
                const locked = elapsed < COOLDOWN_DAYS;
                const daysLeft = COOLDOWN_DAYS - elapsed;
                const att = attendance[s.student_id];
                const statusColor = att?.status === 'present' ? 'bg-green-100 text-green-800' :
                  att?.status === 'absent' ? 'bg-red-100 text-red-800' :
                  att?.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                  att?.status === 'excused' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';

                return (
                  <div key={s.id} className="flex items-center justify-between border rounded-md p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p?.full_name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground truncate">{p?.email}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {locked ? (
                          <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600 dark:text-amber-400">
                            🔒 {daysLeft}d cooldown
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">✓ Cleared</Badge>
                        )}
                        {att && (
                          <Badge className={`text-[10px] ${statusColor}`}>
                            {att.status.charAt(0).toUpperCase() + att.status.slice(1)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end ml-2">
                      <Button
                        size="xs"
                        variant={att?.status === 'present' ? 'default' : 'outline'}
                        onClick={() => markAttendance(s.student_id, 'present', signupsOpen!)}
                        className="text-[11px]"
                      >
                        Present
                      </Button>
                      <Button
                        size="xs"
                        variant={att?.status === 'absent' ? 'destructive' : 'outline'}
                        onClick={() => markAttendance(s.student_id, 'absent', signupsOpen!)}
                        className="text-[11px]"
                      >
                        Absent
                      </Button>
                      <Button
                        size="xs"
                        variant={att?.status === 'late' ? 'secondary' : 'outline'}
                        onClick={() => markAttendance(s.student_id, 'late', signupsOpen!)}
                        className="text-[11px]"
                      >
                        Late
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeSignup(s, p?.full_name || "this student")}
                        title={locked ? "Override cooldown and remove" : "Remove signup"}
                      >
                        <Trash className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminWorkouts;
