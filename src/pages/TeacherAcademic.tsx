import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, CheckCircle, GraduationCap, Calendar, ClipboardList } from "lucide-react";
import { isLightColor, DAY_LABELS } from "@/lib/academic-utils";
import { format } from "date-fns";
import FloatingChatButton from "@/components/student/FloatingChatButton";

interface Period { id: number; label: string; start_time: string; end_time: string; is_break: boolean; sort_order: number; }
interface Slot { id: string; subject_id: string; class_group_id: string | null; day_of_week: number; period_number: number; room: string | null; is_elective: boolean; }
interface Subject { id: string; name: string; code: string | null; color: string; }
interface ClassGroup { id: string; name: string; }

const TeacherAcademic = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // Attendance state
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [students, setStudents] = useState<{ id: string; name: string; status: string }[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState("open");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const [p, s, sl, cg] = await Promise.all([
        (supabase as any).from("academic_periods").select("*").order("sort_order"),
        (supabase as any).from("academic_subjects").select("*"),
        (supabase as any).from("timetable_slots").select("*").eq("teacher_id", user.id),
        (supabase as any).from("class_groups").select("*"),
      ]);
      setPeriods(p.data || []);
      setSubjects(s.data || []);
      setSlots(sl.data || []);
      setClassGroups(cg.data || []);
    };
    load();
  }, []);

  const getSub = (id: string) => subjects.find(s => s.id === id);
  const getCG = (id: string | null) => id ? classGroups.find(c => c.id === id) : null;

  const todayDow = new Date().getDay();
  const todayNum = todayDow === 0 || todayDow > 5 ? null : todayDow;
  const todaySlots = todayNum ? slots.filter(s => s.day_of_week === todayNum) : [];
  const today = format(new Date(), "yyyy-MM-dd");

  const loadAttendance = async (slotId: string) => {
    setSelectedSlot(slotId);
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return;

    let { data: session } = await (supabase as any).from("academic_sessions").select("*").eq("slot_id", slotId).eq("session_date", today).maybeSingle();
    if (!session) {
      const { data: newSession, error } = await (supabase as any).from("academic_sessions").insert({ slot_id: slotId, session_date: today, status: "open" }).select().single();
      if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
      session = newSession;
    }
    setSessionId(session.id);
    setSessionStatus(session.status);

    let studentIds: string[] = [];
    if (slot.is_elective) {
      const { data: enrollments } = await (supabase as any).from("timetable_enrollments").select("student_id").eq("slot_id", slotId);
      studentIds = enrollments?.map((e: any) => e.student_id) || [];
    } else if (slot.class_group_id) {
      const { data: members } = await (supabase as any).from("class_group_members").select("student_id").eq("class_group_id", slot.class_group_id);
      studentIds = members?.map((m: any) => m.student_id) || [];
    }

    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", studentIds);
    const { data: existing } = await (supabase as any).from("academic_attendance").select("student_id, status").eq("session_id", session.id);
    const existingMap = new Map((existing || []).map((e: any) => [e.student_id, e.status]));

    setStudents(
      (profiles || []).map(p => ({
        id: p.id,
        name: p.full_name,
        status: (existingMap.get(p.id) as string) || "present",
      })).sort((a, b) => a.name.localeCompare(b.name))
    );
  };

  const setStatus = (studentId: string, status: string) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status } : s));
  };

  const handleSave = async (finalize = false) => {
    if (!sessionId) return;
    setSaving(true);
    try {
      for (const s of students) {
        await (supabase as any).from("academic_attendance").upsert({ session_id: sessionId, student_id: s.id, status: s.status }, { onConflict: "session_id,student_id" });
      }
      if (finalize) {
        await (supabase as any).from("academic_sessions").update({ status: "finalized" }).eq("id", sessionId);
        setSessionStatus("finalized");
      }
      toast({ title: finalize ? "Attendance finalized" : "Draft saved" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
    setSaving(false);
  };

  const STATUS_OPTIONS = ["present", "absent", "late", "excused"] as const;
  const statusStyles: Record<string, string> = {
    present: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
    absent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
    late: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    excused: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="relative overflow-hidden border-b bg-gradient-to-r from-primary/8 via-background to-accent/8">
        <div className="absolute top-0 right-0 w-72 h-72 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="container relative mx-auto px-4 py-5">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/teacher")} className="hover:bg-primary/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/25">
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Academic Classes</h1>
              <p className="text-xs text-muted-foreground">Timetable & attendance management</p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex gap-4 mt-4 flex-wrap">
            <div className="flex items-center gap-2 bg-card/80 backdrop-blur rounded-xl px-4 py-2 border shadow-sm">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{slots.length} classes/week</span>
            </div>
            <div className="flex items-center gap-2 bg-card/80 backdrop-blur rounded-xl px-4 py-2 border shadow-sm">
              <ClipboardList className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{todaySlots.length} today</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-5xl">
        <Tabs defaultValue="timetable" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-sm mx-auto h-11 bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="timetable" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <Calendar className="w-4 h-4 mr-2" />My Timetable
            </TabsTrigger>
            <TabsTrigger value="attendance" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <ClipboardList className="w-4 h-4 mr-2" />Take Attendance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timetable">
            <Card className="overflow-hidden shadow-sm">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full border-collapse min-w-[640px]">
                  <thead>
                    <tr>
                      <th className="border-b border-r p-3 bg-muted/50 text-xs font-semibold text-muted-foreground w-24">Period</th>
                      {DAY_LABELS.map(d => (
                        <th key={d} className="border-b p-3 bg-muted/50 text-xs font-semibold text-muted-foreground">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map(period => {
                      if (period.is_break) {
                        return (
                          <tr key={period.id}>
                            <td colSpan={6} className="border-b p-2 bg-muted/30 text-center text-xs text-muted-foreground italic">
                              ☕ {period.label}
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={period.id} className="group hover:bg-muted/20 transition-colors">
                          <td className="border-b border-r p-2 text-center text-xs font-medium">{period.label}</td>
                          {[1, 2, 3, 4, 5].map(day => {
                            const slot = slots.find(s => s.day_of_week === day && s.period_number === period.sort_order);
                            const sub = slot ? getSub(slot.subject_id) : null;
                            const cg = slot ? getCG(slot.class_group_id) : null;
                            return (
                              <td key={day} className="border-b p-1 h-14">
                                {sub ? (
                                  <div className="rounded-lg p-1.5 h-full flex flex-col justify-center text-center transition-transform hover:scale-[1.02]"
                                    style={{ backgroundColor: sub.color + "22", borderLeft: `3px solid ${sub.color}` }}>
                                    <span className="text-xs font-semibold">{sub.code || sub.name.slice(0, 8)}</span>
                                    {cg && <span className="text-[10px] text-muted-foreground">{cg.name}</span>}
                                    {slot?.room && <span className="text-[10px] text-muted-foreground">{slot.room}</span>}
                                  </div>
                                ) : (
                                  <div className="h-full flex items-center justify-center text-muted-foreground/20 text-xs">—</div>
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
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4">
            {!todayNum ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Calendar className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium">No classes on weekends</p>
                </CardContent>
              </Card>
            ) : todaySlots.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium">You have no classes today</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Select value={selectedSlot} onValueChange={loadAttendance}>
                  <SelectTrigger className="w-full max-w-md"><SelectValue placeholder="Select today's class" /></SelectTrigger>
                  <SelectContent>
                    {todaySlots.map(sl => {
                      const sub = getSub(sl.subject_id);
                      const cg = getCG(sl.class_group_id);
                      const per = periods.find(p => p.sort_order === sl.period_number);
                      return <SelectItem key={sl.id} value={sl.id}>{per?.label} — {sub?.name || "?"} {cg ? `(${cg.name})` : ""}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>

                {selectedSlot && students.length > 0 && (
                  <Card className="overflow-hidden">
                    <CardHeader className="bg-muted/30">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>Mark Attendance ({students.length} students)</span>
                        {sessionStatus === "finalized" && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">
                            ✓ Finalized
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {students.map(s => (
                          <div key={s.id} className="flex items-center justify-between p-3 hover:bg-muted/20 transition-colors">
                            <span className="text-sm font-medium">{s.name}</span>
                            <div className="flex gap-1.5">
                              {STATUS_OPTIONS.map(st => (
                                <button key={st} onClick={() => setStatus(s.id, st)} disabled={sessionStatus === "finalized"}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all
                                    ${s.status === st ? statusStyles[st] : "bg-background text-muted-foreground border-border hover:bg-muted/50"}
                                    ${sessionStatus === "finalized" ? "opacity-60 cursor-default" : "cursor-pointer"}`}>
                                  {st.charAt(0).toUpperCase() + st.slice(1)}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      {sessionStatus !== "finalized" && (
                        <div className="flex gap-2 p-4 border-t bg-muted/20">
                          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
                            <Save className="w-4 h-4 mr-2" />Save Draft
                          </Button>
                          <Button onClick={() => handleSave(true)} disabled={saving}>
                            <CheckCircle className="w-4 h-4 mr-2" />Finalize
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <FloatingChatButton />
    </div>
  );
};

export default TeacherAcademic;