import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Plus, Trash2, Search } from "lucide-react";
import type { AcademicPeriod, AcademicSubject, ClassGroup, TimetableSlot } from "@/types/academic";
import { ACADEMIC_DAYS, textColorForBg } from "@/types/academic";

interface TeacherOption {
  id: string;
  full_name: string;
  email: string;
}

const AcademicTimetableAdmin = () => {
  const { toast } = useToast();
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [slots, setSlots] = useState<Map<string, TimetableSlot>>(new Map());
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ day: string; period: number } | null>(null);
  const [existingSlot, setExistingSlot] = useState<TimetableSlot | null>(null);
  const [formData, setFormData] = useState({
    subject_id: "",
    teacher_id: "",
    room: "",
    is_elective: false,
    class_group_id: "",
  });
  const [teacherSearch, setTeacherSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    if (!loading) loadSlots();
  }, [selectedGroupId, loading]);

  const loadBaseData = async () => {
    try {
      const [periodsRes, subjectsRes, groupsRes] = await Promise.all([
        (supabase as any).from("academic_periods").select("*").order("period_number"),
        (supabase as any).from("academic_subjects").select("*").order("name").limit(200),
        (supabase as any).from("class_groups").select("*").order("name").limit(200),
      ]);

      setPeriods(periodsRes.data || []);
      setSubjects(subjectsRes.data || []);
      setClassGroups(groupsRes.data || []);

      // Load teachers (two-step)
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "teacher")
        .limit(500);
      const teacherIds = (roleData || []).map(r => r.user_id);
      if (teacherIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", teacherIds)
          .order("full_name");
        setTeachers((profiles || []).map(p => ({ id: p.id, full_name: p.full_name, email: p.email })));
      }
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: "Failed to load timetable data" });
    } finally {
      setLoading(false);
    }
  };

  const loadSlots = useCallback(async () => {
    try {
      let query = (supabase as any)
        .from("timetable_slots")
        .select("*, academic_subjects(*), class_groups(*)")
        .limit(1000);

      if (selectedGroupId !== "all") {
        query = query.eq("class_group_id", selectedGroupId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const map = new Map<string, TimetableSlot>();
      (data || []).forEach((slot: TimetableSlot) => {
        map.set(`${slot.day_of_week}-${slot.period_number}`, slot);
      });
      setSlots(map);
    } catch (err) {
      console.error(err);
    }
  }, [selectedGroupId]);

  const openCell = (day: string, period: number) => {
    const key = `${day}-${period}`;
    const slot = slots.get(key) || null;
    setSelectedCell({ day, period });
    setExistingSlot(slot);
    setFormData({
      subject_id: slot?.subject_id || "",
      teacher_id: slot?.teacher_id || "",
      room: slot?.room || "",
      is_elective: slot?.is_elective || false,
      class_group_id: slot?.class_group_id || (selectedGroupId !== "all" ? selectedGroupId : ""),
    });
    setTeacherSearch("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.subject_id || !formData.teacher_id) {
      toast({ variant: "destructive", title: "Missing fields", description: "Subject and teacher are required" });
      return;
    }
    if (!formData.is_elective && !formData.class_group_id) {
      toast({ variant: "destructive", title: "Missing fields", description: "Class group is required for non-elective lessons" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        subject_id: formData.subject_id,
        teacher_id: formData.teacher_id,
        class_group_id: formData.is_elective ? null : formData.class_group_id || null,
        day_of_week: selectedCell!.day,
        period_number: selectedCell!.period,
        room: formData.room.trim() || null,
        is_elective: formData.is_elective,
      };

      if (existingSlot) {
        const { error } = await (supabase as any)
          .from("timetable_slots")
          .update(payload)
          .eq("id", existingSlot.id);
        if (error) throw error;
        toast({ title: "Slot updated" });
      } else {
        const { error } = await (supabase as any)
          .from("timetable_slots")
          .insert(payload);
        if (error) throw error;
        toast({ title: "Slot created" });
      }

      setDialogOpen(false);
      loadSlots();
    } catch (err: any) {
      if (err.code === "23505") {
        if (err.message?.includes("teacher")) {
          toast({ variant: "destructive", title: "Double booking", description: "This teacher already has a lesson in this period" });
        } else {
          toast({ variant: "destructive", title: "Conflict", description: "This group already has a lesson in this period" });
        }
      } else {
        toast({ variant: "destructive", title: "Error", description: err.message || "Failed to save slot" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingSlot) return;
    const { error } = await (supabase as any)
      .from("timetable_slots")
      .delete()
      .eq("id", existingSlot.id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Slot removed" });
      setDialogOpen(false);
      loadSlots();
    }
  };

  const filteredTeachers = teachers.filter(
    t => !teacherSearch || t.full_name.toLowerCase().includes(teacherSearch.toLowerCase())
      || t.email.toLowerCase().includes(teacherSearch.toLowerCase())
  );

  const lessonPeriods = periods.filter(p => !p.is_break);
  const selectedPeriod = selectedCell ? periods.find(p => p.period_number === selectedCell.period) : null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Master Timetable</h1>
            <p className="text-muted-foreground">Build and manage the school timetable</p>
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium shrink-0">View class:</Label>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classGroups.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-3 py-3 w-28 font-medium text-muted-foreground">Period</th>
                    {ACADEMIC_DAYS.map(day => (
                      <th key={day} className="text-center px-2 py-3 font-medium min-w-[130px]">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map(period => (
                    <tr key={period.id} className={`border-b ${period.is_break ? "bg-muted/30" : "hover:bg-muted/10"}`}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-xs">{period.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {period.start_time.slice(0, 5)}–{period.end_time.slice(0, 5)}
                        </div>
                      </td>
                      {period.is_break ? (
                        <td colSpan={5} className="text-center text-xs text-muted-foreground py-2">
                          {period.label}
                        </td>
                      ) : (
                        ACADEMIC_DAYS.map(day => {
                          const slot = slots.get(`${day}-${period.period_number}`);
                          const subj = slot?.academic_subjects;
                          return (
                            <td key={day} className="px-2 py-2 text-center">
                              {slot && subj ? (
                                <button
                                  onClick={() => openCell(day, period.period_number)}
                                  className="w-full rounded px-2 py-2 text-left transition-opacity hover:opacity-80"
                                  style={{ backgroundColor: subj.color, color: textColorForBg(subj.color) }}
                                >
                                  <div className="font-semibold text-xs leading-tight truncate">{subj.name}</div>
                                  {slot.room && <div className="text-xs opacity-80 truncate">{slot.room}</div>}
                                  {slot.is_elective && <div className="text-xs opacity-70">Elective</div>}
                                </button>
                              ) : (
                                <button
                                  onClick={() => openCell(day, period.period_number)}
                                  className="w-full h-14 rounded border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 flex items-center justify-center transition-colors"
                                >
                                  <Plus className="w-4 h-4 text-muted-foreground" />
                                </button>
                              )}
                            </td>
                          );
                        })
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Slot Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedCell?.day} — {selectedPeriod?.label}{" "}
                <span className="text-muted-foreground font-normal text-sm">
                  ({selectedPeriod?.start_time.slice(0, 5)}–{selectedPeriod?.end_time.slice(0, 5)})
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              {/* Subject */}
              <div>
                <Label>Subject *</Label>
                <Select value={formData.subject_id} onValueChange={v => setFormData(f => ({ ...f, subject_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          {s.name} {s.code ? `(${s.code})` : ""}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Teacher */}
              <div>
                <Label>Teacher *</Label>
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Filter teachers…"
                      value={teacherSearch}
                      onChange={e => setTeacherSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="border rounded-md max-h-36 overflow-y-auto">
                    {filteredTeachers.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setFormData(f => ({ ...f, teacher_id: t.id }))}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-accent ${
                          formData.teacher_id === t.id ? "bg-primary/10 font-medium" : ""
                        }`}
                      >
                        {t.full_name}
                        <span className="text-xs text-muted-foreground ml-2">{t.email}</span>
                      </button>
                    ))}
                    {filteredTeachers.length === 0 && (
                      <p className="text-sm text-muted-foreground px-3 py-2">No teachers found</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Elective toggle */}
              <div className="flex items-center gap-3">
                <Switch
                  id="elective"
                  checked={formData.is_elective}
                  onCheckedChange={v => setFormData(f => ({ ...f, is_elective: v }))}
                />
                <Label htmlFor="elective">Elective lesson (individual enrollment)</Label>
              </div>

              {/* Class group — hidden for electives */}
              {!formData.is_elective && (
                <div>
                  <Label>Class Group *</Label>
                  <Select
                    value={formData.class_group_id}
                    onValueChange={v => setFormData(f => ({ ...f, class_group_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class group" />
                    </SelectTrigger>
                    <SelectContent>
                      {classGroups.map(g => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Room */}
              <div>
                <Label>Room (optional)</Label>
                <Input
                  placeholder="e.g. Room 12, Lab A"
                  value={formData.room}
                  onChange={e => setFormData(f => ({ ...f, room: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-2">
                {existingSlot && (
                  <Button variant="destructive" size="sm" onClick={handleDelete}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                )}
                <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : existingSlot ? "Update" : "Add Lesson"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AcademicTimetableAdmin;
