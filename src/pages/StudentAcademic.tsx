import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { isLightColor, DAY_LABELS } from "@/lib/academic-utils";
import FloatingChatButton from "@/components/student/FloatingChatButton";

interface Period { id: number; label: string; start_time: string; end_time: string; is_break: boolean; sort_order: number; }
interface Subject { id: string; name: string; code: string | null; color: string; }
interface Slot { id: string; subject_id: string; teacher_id: string | null; day_of_week: number; period_number: number; room: string | null; }
interface Teacher { id: string; full_name: string; }

const StudentAcademic = () => {
  const navigate = useNavigate();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [attendance, setAttendance] = useState<{ subject: string; total: number; present: number }[]>([]);
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [p, s] = await Promise.all([
        (supabase as any).from("academic_periods").select("*").order("sort_order"),
        (supabase as any).from("academic_subjects").select("*"),
      ]);
      setPeriods(p.data || []);
      setSubjects(s.data || []);

      // Get student's class group
      const { data: membership } = await (supabase as any).from("class_group_members").select("class_group_id").eq("student_id", user.id);
      const groupIds = membership?.map((m: any) => m.class_group_id) || [];

      // Get class slots + elective enrollments
      let allSlots: Slot[] = [];
      if (groupIds.length) {
        const { data: classSlots } = await (supabase as any).from("timetable_slots").select("*").in("class_group_id", groupIds).eq("is_elective", false);
        allSlots = classSlots || [];
      }
      const { data: enrollments } = await (supabase as any).from("timetable_enrollments").select("slot_id").eq("student_id", user.id);
      if (enrollments?.length) {
        const { data: electiveSlots } = await (supabase as any).from("timetable_slots").select("*").in("id", enrollments.map((e: any) => e.slot_id));
        allSlots = [...allSlots, ...(electiveSlots || [])];
      }
      setSlots(allSlots);

      // Fetch teachers for these slots
      const teacherIds = [...new Set(allSlots.map(sl => sl.teacher_id).filter(Boolean))] as string[];
      if (teacherIds.length) {
        const { data: tProfiles } = await supabase.from("profiles").select("id, full_name").in("id", teacherIds);
        setTeachers(tProfiles || []);
      }

      // Attendance records
      const slotIds = allSlots.map(sl => sl.id);
      if (slotIds.length) {
        const { data: sessions } = await (supabase as any).from("academic_sessions").select("id, slot_id").in("slot_id", slotIds);
        const sessionIds = sessions?.map((ss: any) => ss.id) || [];
        if (sessionIds.length) {
          const { data: att } = await (supabase as any).from("academic_attendance").select("session_id, status").eq("student_id", user.id).in("session_id", sessionIds);
          setRecords(att || []);

          // Build per-subject summary
          const sessionSlotMap = new Map(sessions.map((ss: any) => [ss.id, ss.slot_id]));
          const subjectMap: Record<string, { total: number; present: number }> = {};
          for (const a of (att || [])) {
            const slotId = sessionSlotMap.get(a.session_id);
            const slot = allSlots.find(sl => sl.id === slotId);
            if (!slot) continue;
            if (!subjectMap[slot.subject_id]) subjectMap[slot.subject_id] = { total: 0, present: 0 };
            subjectMap[slot.subject_id].total++;
            if (a.status === "present") subjectMap[slot.subject_id].present++;
          }
          setAttendance(Object.entries(subjectMap).map(([sid, v]) => {
            const sub = (s.data || []).find((ss: any) => ss.id === sid);
            return { subject: sub?.name || "?", ...v };
          }));
        }
      }
    };
    fetch();
  }, []);

  const getSub = (id: string) => subjects.find(s => s.id === id);
  const getTeacher = (id: string | null) => id ? teachers.find(t => t.id === id) : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/student")}><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="text-xl font-bold">Academic</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
        <Tabs defaultValue="timetable">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="timetable">My Timetable</TabsTrigger>
            <TabsTrigger value="attendance">My Attendance</TabsTrigger>
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
                        return <tr key={period.id}><td colSpan={6} className="border p-1.5 bg-muted/50 text-center text-xs text-muted-foreground">{period.label} ({period.start_time?.slice(0,5)}–{period.end_time?.slice(0,5)})</td></tr>;
                      }
                      return (
                        <tr key={period.id}>
                          <td className="border p-1.5 text-xs text-center bg-muted/30">
                            {period.label}<br/><span className="text-[10px] text-muted-foreground">{period.start_time?.slice(0,5)}–{period.end_time?.slice(0,5)}</span>
                          </td>
                          {[1,2,3,4,5].map(day => {
                            const slot = slots.find(s => s.day_of_week === day && s.period_number === period.sort_order);
                            const sub = slot ? getSub(slot.subject_id) : null;
                            const teacher = slot ? getTeacher(slot.teacher_id) : null;
                            return (
                              <td key={day} className="border p-1 h-16">
                                {sub ? (
                                  <div className="rounded-md p-1.5 h-full flex flex-col justify-center" style={{ backgroundColor: sub.color, color: isLightColor(sub.color) ? '#000' : '#fff' }}>
                                    <span className="text-xs font-bold truncate">{sub.code || sub.name.slice(0,10)}</span>
                                    {teacher && <span className="text-[10px] opacity-80 truncate">{teacher.full_name.split(" ")[0]}</span>}
                                    {slot?.room && <span className="text-[10px] opacity-70">{slot.room}</span>}
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
            {attendance.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {attendance.map(a => (
                  <Card key={a.subject}>
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground truncate">{a.subject}</p>
                      <p className="text-2xl font-bold mt-1">{a.total > 0 ? Math.round((a.present / a.total) * 100) : 0}%</p>
                      <p className="text-[10px] text-muted-foreground">{a.present}/{a.total} present</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {records.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No attendance records yet.</p>
            ) : (
              <Card>
                <CardHeader><CardTitle className="text-base">Recent Records</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Total: {records.length} records — {records.filter(r => r.status === "present").length} present, {records.filter(r => r.status === "absent").length} absent, {records.filter(r => r.status === "late").length} late</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <FloatingChatButton />
    </div>
  );
};

export default StudentAcademic;
