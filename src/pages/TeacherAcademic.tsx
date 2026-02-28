import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, CheckCircle } from "lucide-react";
import { isLightColor, DAY_LABELS, DAY_MAP } from "@/lib/academic-utils";
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
    const fetch = async () => {
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
    fetch();
  }, []);

  const getSub = (id: string) => subjects.find(s => s.id === id);
  const getCG = (id: string | null) => id ? classGroups.find(c => c.id === id) : null;

  // Today's slots
  const todayDow = new Date().getDay(); // 0=Sun
  const todayNum = todayDow === 0 ? null : todayDow; // 1=Mon..5=Fri
  const todaySlots = todayNum ? slots.filter(s => s.day_of_week === todayNum) : [];
  const today = format(new Date(), "yyyy-MM-dd");

  const loadAttendance = async (slotId: string) => {
    setSelectedSlot(slotId);
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return;

    // Get or create session
    let { data: session } = await (supabase as any).from("academic_sessions").select("*").eq("slot_id", slotId).eq("session_date", today).maybeSingle();
    if (!session) {
      const { data: newSession, error } = await (supabase as any).from("academic_sessions").insert({ slot_id: slotId, session_date: today, status: "open" }).select().single();
      if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
      session = newSession;
    }
    setSessionId(session.id);
    setSessionStatus(session.status);

    // Get students
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

  const statusColors: Record<string, string> = {
    present: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    absent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    late: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    excused: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/teacher")}><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="text-xl font-bold">Academic Classes</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <Tabs defaultValue="timetable">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="timetable">My Timetable</TabsTrigger>
            <TabsTrigger value="attendance">Take Attendance</TabsTrigger>
          </TabsList>

          <TabsContent value="timetable" className="mt-6">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full border-collapse min-w-[600px]">
                  <thead>
                    <tr>
                      <th className="border p-2 bg-muted text-xs w-20">Period</th>
                      {DAY_LABELS.map(d => <th key={d} className="border p-2 bg-muted text-xs">{d}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map(period => {
                      if (period.is_break) {
                        return <tr key={period.id}><td colSpan={6} className="border p-1.5 bg-muted/50 text-center text-xs text-muted-foreground">{period.label}</td></tr>;
                      }
                      return (
                        <tr key={period.id}>
                          <td className="border p-1.5 text-xs text-center bg-muted/30">{period.label}</td>
                          {[1,2,3,4,5].map(day => {
                            const slot = slots.find(s => s.day_of_week === day && s.period_number === period.sort_order);
                            const sub = slot ? getSub(slot.subject_id) : null;
                            const cg = slot ? getCG(slot.class_group_id) : null;
                            return (
                              <td key={day} className="border p-1 h-14">
                                {sub ? (
                                  <div className="rounded p-1 h-full flex flex-col justify-center text-center" style={{ backgroundColor: sub.color + "22", borderLeft: `3px solid ${sub.color}` }}>
                                    <span className="text-xs font-semibold">{sub.code || sub.name.slice(0,8)}</span>
                                    {cg && <span className="text-[10px] text-muted-foreground">{cg.name}</span>}
                                    {slot?.room && <span className="text-[10px] text-muted-foreground">{slot.room}</span>}
                                  </div>
                                ) : null}
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

          <TabsContent value="attendance" className="mt-6 space-y-4">
            {!todayNum ? (
              <p className="text-muted-foreground text-center py-8">No classes on weekends.</p>
            ) : todaySlots.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">You have no classes today.</p>
            ) : (
              <>
                <div>
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
                </div>

                {selectedSlot && students.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>Mark Attendance ({students.length} students)</span>
                        {sessionStatus === "finalized" && <Badge variant="secondary">Finalized</Badge>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {students.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-2 rounded-lg border">
                          <span className="text-sm font-medium">{s.name}</span>
                          <div className="flex gap-1">
                            {(["present","absent","late","excused"] as const).map(st => (
                              <button key={st} onClick={() => setStatus(s.id, st)} disabled={sessionStatus === "finalized"}
                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${s.status === st ? statusColors[st] : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                                {st.charAt(0).toUpperCase() + st.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      {sessionStatus !== "finalized" && (
                        <div className="flex gap-2 pt-4">
                          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}><Save className="w-4 h-4 mr-2" />Save Draft</Button>
                          <Button onClick={() => handleSave(true)} disabled={saving}><CheckCircle className="w-4 h-4 mr-2" />Finalize</Button>
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
