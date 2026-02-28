import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { isLightColor, DAY_LABELS } from "@/lib/academic-utils";
import FloatingChatButton from "@/components/student/FloatingChatButton";

interface Period { id: number; label: string; start_time: string; end_time: string; is_break: boolean; sort_order: number; }
interface Subject { id: string; name: string; code: string | null; color: string; }
interface ClassGroup { id: string; name: string; }
interface Slot { id: string; subject_id: string; teacher_id: string | null; class_group_id: string | null; day_of_week: number; period_number: number; room: string | null; is_elective: boolean; }
interface Teacher { id: string; full_name: string; }

const AcademicTimetable = () => {
  const { toast } = useToast();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cellDay, setCellDay] = useState(1);
  const [cellPeriod, setCellPeriod] = useState(1);
  const [form, setForm] = useState({ subject_id: "", teacher_id: "", room: "", is_elective: false });
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const [p, s, c, t] = await Promise.all([
        (supabase as any).from("academic_periods").select("*").order("sort_order"),
        (supabase as any).from("academic_subjects").select("*").order("name"),
        (supabase as any).from("class_groups").select("*").order("name"),
        (async () => {
          const { data: roleData } = await supabase.from("user_roles").select("user_id").in("role", ["teacher", "admin", "moderator"]);
          if (!roleData?.length) return [];
          const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", roleData.map(r => r.user_id));
          return profiles || [];
        })(),
      ]);
      setPeriods(p.data || []);
      setSubjects(s.data || []);
      setClasses(c.data || []);
      setTeachers(t);
      if (c.data?.length) setSelectedClass(c.data[0].id);
    };
    fetch();
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    const fetchSlots = async () => {
      const { data } = await (supabase as any).from("timetable_slots").select("*").eq("class_group_id", selectedClass);
      setSlots(data || []);
    };
    fetchSlots();
  }, [selectedClass]);

  const getSlot = (day: number, periodNum: number) => slots.find(s => s.day_of_week === day && s.period_number === periodNum);
  const getSubject = (id: string) => subjects.find(s => s.id === id);
  const getTeacher = (id: string | null) => id ? teachers.find(t => t.id === id) : null;

  const openCell = (day: number, periodNum: number) => {
    const existing = getSlot(day, periodNum);
    setCellDay(day);
    setCellPeriod(periodNum);
    if (existing) {
      setEditingSlot(existing);
      setForm({ subject_id: existing.subject_id, teacher_id: existing.teacher_id || "", room: existing.room || "", is_elective: existing.is_elective });
    } else {
      setEditingSlot(null);
      setForm({ subject_id: "", teacher_id: "", room: "", is_elective: false });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        subject_id: form.subject_id,
        teacher_id: form.teacher_id || null,
        class_group_id: selectedClass,
        day_of_week: cellDay,
        period_number: cellPeriod,
        room: form.room || null,
        is_elective: form.is_elective,
      };
      if (editingSlot) {
        const { error } = await (supabase as any).from("timetable_slots").update(payload).eq("id", editingSlot.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("timetable_slots").insert(payload);
        if (error) {
          if (error.code === "23505") { toast({ variant: "destructive", title: "Conflict", description: "This period is already taken (teacher or class)." }); return; }
          throw error;
        }
      }
      toast({ title: "Slot saved" });
      setDialogOpen(false);
      // refresh
      const { data } = await (supabase as any).from("timetable_slots").select("*").eq("class_group_id", selectedClass);
      setSlots(data || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleDelete = async () => {
    if (!editingSlot) return;
    await (supabase as any).from("timetable_slots").delete().eq("id", editingSlot.id);
    setDialogOpen(false);
    const { data } = await (supabase as any).from("timetable_slots").select("*").eq("class_group_id", selectedClass);
    setSlots(data || []);
  };

  const teachablePeriods = periods.filter(p => !p.is_break);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold">Timetable Builder</h1>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-60"><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {!selectedClass ? (
          <p className="text-muted-foreground text-center py-12">Create a class group first, then build the timetable here.</p>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full border-collapse min-w-[700px]">
                <thead>
                  <tr>
                    <th className="border p-2 bg-muted text-xs font-medium w-24">Period</th>
                    {DAY_LABELS.map((d, i) => <th key={d} className="border p-2 bg-muted text-xs font-medium">{d}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {periods.map(period => {
                    if (period.is_break) {
                      return (
                        <tr key={period.id}>
                          <td colSpan={6} className="border p-2 bg-muted/50 text-center text-xs text-muted-foreground font-medium">
                            {period.label} ({period.start_time?.slice(0,5)}–{period.end_time?.slice(0,5)})
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={period.id}>
                        <td className="border p-2 text-xs font-medium text-center bg-muted/30">
                          {period.label}<br/><span className="text-muted-foreground">{period.start_time?.slice(0,5)}–{period.end_time?.slice(0,5)}</span>
                        </td>
                        {[1,2,3,4,5].map(day => {
                          const slot = getSlot(day, period.sort_order);
                          const sub = slot ? getSubject(slot.subject_id) : null;
                          const teacher = slot ? getTeacher(slot.teacher_id) : null;
                          return (
                            <td key={day} className="border p-1 cursor-pointer hover:bg-muted/30 transition-colors h-16" onClick={() => openCell(day, period.sort_order)}>
                              {sub ? (
                                <div className="rounded-md p-1.5 h-full flex flex-col justify-center text-center" style={{ backgroundColor: sub.color + "22", borderLeft: `3px solid ${sub.color}` }}>
                                  <span className="text-xs font-semibold truncate">{sub.code || sub.name.slice(0, 8)}</span>
                                  {teacher && <span className="text-[10px] text-muted-foreground truncate">{teacher.full_name.split(" ")[0]}</span>}
                                  {slot?.room && <span className="text-[10px] text-muted-foreground">{slot.room}</span>}
                                </div>
                              ) : (
                                <div className="h-full flex items-center justify-center"><span className="text-xs text-muted-foreground/50">+</span></div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingSlot ? "Edit" : "Assign"} Slot — {DAY_LABELS[cellDay - 1]}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Subject</Label>
                <Select value={form.subject_id} onValueChange={v => setForm(f => ({ ...f, subject_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pick subject" /></SelectTrigger>
                  <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Teacher</Label>
                <Select value={form.teacher_id} onValueChange={v => setForm(f => ({ ...f, teacher_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pick teacher" /></SelectTrigger>
                  <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Room</Label><Input value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} placeholder="e.g. Room 204" /></div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_elective} onCheckedChange={v => setForm(f => ({ ...f, is_elective: v }))} />
                <Label>Elective slot (individual enrollment)</Label>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} className="flex-1" disabled={!form.subject_id}>Save</Button>
                {editingSlot && <Button variant="destructive" onClick={handleDelete}>Remove</Button>}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <FloatingChatButton />
    </AdminLayout>
  );
};

export default AcademicTimetable;
