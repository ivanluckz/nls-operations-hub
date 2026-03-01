import { useState, useEffect, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { isLightColor, DAY_LABELS } from "@/lib/academic-utils";
import { Copy, ClipboardPaste, Trash2, AlertTriangle } from "lucide-react";
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
  const [allSlots, setAllSlots] = useState<Slot[]>([]); // All slots across all classes for conflict detection
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cellDay, setCellDay] = useState(1);
  const [cellPeriod, setCellPeriod] = useState(1);
  const [form, setForm] = useState({ subject_id: "", teacher_id: "", room: "", is_elective: false });
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);

  // Clipboard for copy/paste
  const [clipboard, setClipboard] = useState<{ subject_id: string; teacher_id: string | null; room: string | null; is_elective: boolean } | null>(null);

  // Drag-and-drop state
  const [dragSlot, setDragSlot] = useState<Slot | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const [p, s, c, t, all] = await Promise.all([
        (supabase as any).from("academic_periods").select("*").order("sort_order"),
        (supabase as any).from("academic_subjects").select("*").order("name"),
        (supabase as any).from("class_groups").select("*").order("name"),
        (async () => {
          const { data: roleData } = await supabase.from("user_roles").select("user_id").in("role", ["teacher", "admin", "moderator"]);
          if (!roleData?.length) return [];
          const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", roleData.map(r => r.user_id));
          return profiles || [];
        })(),
        (supabase as any).from("timetable_slots").select("*"),
      ]);
      setPeriods(p.data || []);
      setSubjects(s.data || []);
      setClasses(c.data || []);
      setTeachers(t);
      setAllSlots(all.data || []);
      if (c.data?.length) setSelectedClass(c.data[0].id);
    };
    fetch();
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    setSlots(allSlots.filter(s => s.class_group_id === selectedClass));
  }, [selectedClass, allSlots]);

  const getSlot = (day: number, periodNum: number) => slots.find(s => s.day_of_week === day && s.period_number === periodNum);
  const getSubject = (id: string) => subjects.find(s => s.id === id);
  const getTeacher = (id: string | null) => id ? teachers.find(t => t.id === id) : null;

  // Conflict detection: find teachers double-booked across classes
  const conflicts = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of allSlots) {
      if (!slot.teacher_id) continue;
      const key = `${slot.teacher_id}-${slot.day_of_week}-${slot.period_number}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(slot);
    }
    const conflictSet = new Set<string>();
    for (const [, slots] of map) {
      if (slots.length > 1) {
        for (const s of slots) conflictSet.add(s.id);
      }
    }
    return conflictSet;
  }, [allSlots]);

  // Slot count summary per subject
  const slotCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of slots) {
      counts[s.subject_id] = (counts[s.subject_id] || 0) + 1;
    }
    return counts;
  }, [slots]);

  const openCell = (day: number, periodNum: number) => {
    const existing = getSlot(day, periodNum);
    setCellDay(day);
    setCellPeriod(periodNum);
    if (existing) {
      setEditingSlot(existing);
      setForm({ subject_id: existing.subject_id, teacher_id: existing.teacher_id || "", room: existing.room || "", is_elective: existing.is_elective });
    } else if (clipboard) {
      // Auto-fill from clipboard
      setEditingSlot(null);
      setForm({ subject_id: clipboard.subject_id, teacher_id: clipboard.teacher_id || "", room: clipboard.room || "", is_elective: clipboard.is_elective });
    } else {
      setEditingSlot(null);
      setForm({ subject_id: "", teacher_id: "", room: "", is_elective: false });
    }
    setDialogOpen(true);
  };

  const handleCopy = (slot: Slot) => {
    setClipboard({ subject_id: slot.subject_id, teacher_id: slot.teacher_id, room: slot.room, is_elective: slot.is_elective });
    toast({ title: "Slot copied", description: "Click an empty cell to paste" });
  };

  const handleDragStart = (e: React.DragEvent, slot: Slot) => {
    setDragSlot(slot);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", slot.id);
  };

  const handleDragOver = (e: React.DragEvent, day: number, periodNum: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCell(`${day}-${periodNum}`);
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = async (e: React.DragEvent, day: number, periodNum: number) => {
    e.preventDefault();
    setDragOverCell(null);
    if (!dragSlot) return;

    // Don't drop on itself
    if (dragSlot.day_of_week === day && dragSlot.period_number === periodNum) {
      setDragSlot(null);
      return;
    }

    // Check if target cell already has a slot
    const existing = getSlot(day, periodNum);
    try {
      if (existing) {
        // Swap: update both slots
        const [r1, r2] = await Promise.all([
          (supabase as any).from("timetable_slots").update({ day_of_week: day, period_number: periodNum }).eq("id", dragSlot.id),
          (supabase as any).from("timetable_slots").update({ day_of_week: dragSlot.day_of_week, period_number: dragSlot.period_number }).eq("id", existing.id),
        ]);
        if (r1.error) throw r1.error;
        if (r2.error) throw r2.error;
        toast({ title: "Slots swapped" });
      } else {
        // Move to empty cell
        const { error } = await (supabase as any).from("timetable_slots").update({ day_of_week: day, period_number: periodNum }).eq("id", dragSlot.id);
        if (error) throw error;
        toast({ title: "Slot moved" });
      }
      await refreshSlots();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error moving slot", description: error.message });
    }
    setDragSlot(null);
  };

  const refreshSlots = async () => {
    const { data } = await (supabase as any).from("timetable_slots").select("*");
    setAllSlots(data || []);
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
      await refreshSlots();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleDelete = async () => {
    if (!editingSlot) return;
    await (supabase as any).from("timetable_slots").delete().eq("id", editingSlot.id);
    setDialogOpen(false);
    await refreshSlots();
  };

  const handleClearAll = async () => {
    const { error } = await (supabase as any).from("timetable_slots").delete().eq("class_group_id", selectedClass);
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    toast({ title: "Timetable cleared" });
    await refreshSlots();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold">Timetable Builder</h1>
          <div className="flex items-center gap-3">
            {clipboard && (
              <Badge variant="secondary" className="gap-1.5 py-1.5">
                <ClipboardPaste className="w-3 h-3" />
                Copied: {getSubject(clipboard.subject_id)?.code || getSubject(clipboard.subject_id)?.name.slice(0, 6)}
                <button onClick={() => setClipboard(null)} className="ml-1 hover:text-destructive">×</button>
              </Badge>
            )}
            {selectedClass && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4 mr-2" />Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear entire timetable?</AlertDialogTitle>
                    <AlertDialogDescription>This will remove all slots for {classes.find(c => c.id === selectedClass)?.name}. This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Clear All</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-60"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {!selectedClass ? (
          <p className="text-muted-foreground text-center py-12">Create a class group first, then build the timetable here.</p>
        ) : (
          <>
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full border-collapse min-w-[700px]">
                  <thead>
                    <tr>
                      <th className="border p-2 bg-muted text-xs font-medium w-24">Period</th>
                      {DAY_LABELS.map(d => <th key={d} className="border p-2 bg-muted text-xs font-medium">{d}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map(period => {
                      if (period.is_break) {
                        return (
                          <tr key={period.id}>
                            <td colSpan={6} className="border p-2 bg-muted/50 text-center text-xs text-muted-foreground font-medium">
                              {period.label} ({period.start_time?.slice(0, 5)}–{period.end_time?.slice(0, 5)})
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={period.id}>
                          <td className="border p-2 text-xs font-medium text-center bg-muted/30">
                            {period.label}<br /><span className="text-muted-foreground">{period.start_time?.slice(0, 5)}–{period.end_time?.slice(0, 5)}</span>
                          </td>
                          {[1, 2, 3, 4, 5].map(day => {
                            const slot = getSlot(day, period.sort_order);
                            const sub = slot ? getSubject(slot.subject_id) : null;
                            const teacher = slot ? getTeacher(slot.teacher_id) : null;
                            const hasConflict = slot && conflicts.has(slot.id);
                            const isDragOver = dragOverCell === `${day}-${period.sort_order}`;
                            return (
                              <td key={day}
                                className={`border p-1 cursor-pointer transition-colors h-16 relative ${hasConflict ? "ring-2 ring-inset ring-destructive/60" : ""} ${isDragOver ? "bg-primary/10 ring-2 ring-inset ring-primary/40" : "hover:bg-muted/30"}`}
                                onClick={() => openCell(day, period.sort_order)}
                                onDragOver={e => handleDragOver(e, day, period.sort_order)}
                                onDragLeave={handleDragLeave}
                                onDrop={e => handleDrop(e, day, period.sort_order)}>
                                {sub ? (
                                  <div
                                    className="rounded-md p-1.5 h-full flex flex-col justify-center text-center relative group cursor-grab active:cursor-grabbing"
                                    style={{ backgroundColor: sub.color + "30", color: isLightColor(sub.color) ? '#1a1a1a' : undefined }}
                                    draggable
                                    onDragStart={e => handleDragStart(e, slot!)}>
                                    <span className="text-xs font-semibold truncate">{sub.code || sub.name.slice(0, 8)}</span>
                                    {teacher && <span className="text-[10px] text-muted-foreground truncate">{teacher.full_name.split(" ")[0]}</span>}
                                    {slot?.room && <span className="text-[10px] text-muted-foreground">{slot.room}</span>}
                                    {hasConflict && (
                                      <div className="absolute -top-1 -right-1">
                                        <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                                      </div>
                                    )}
                                    <button
                                      className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-background/50"
                                      onClick={e => { e.stopPropagation(); handleCopy(slot!); }}
                                      title="Copy slot">
                                      <Copy className="w-3 h-3 text-muted-foreground" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="h-full flex items-center justify-center">
                                    <span className="text-xs text-muted-foreground/50">{isDragOver ? "⬇" : clipboard ? "📋" : "+"}</span>
                                  </div>
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

            {/* Slot count summary */}
            {Object.keys(slotCounts).length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Weekly Slot Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(slotCounts).map(([subjectId, count]) => {
                      const sub = getSubject(subjectId);
                      if (!sub) return null;
                      return (
                        <Badge key={subjectId} variant="secondary" className="gap-1.5 py-1"
                          style={{ backgroundColor: sub.color + "20", borderColor: sub.color + "40" }}>
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sub.color }} />
                          {sub.code || sub.name.slice(0, 8)}: {count}
                        </Badge>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {conflicts.size > 0 && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Teacher conflicts detected — highlighted cells have a teacher double-booked in another class at the same time.</span>
              </div>
            )}
          </>
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
