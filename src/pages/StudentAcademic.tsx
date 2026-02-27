import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, BookOpen, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import type { AcademicPeriod, TimetableSlot } from "@/types/academic";
import { AcademicWeeklyGrid } from "@/components/student/AcademicWeeklyGrid";

interface AttendanceEntry {
  id: string;
  status: "present" | "late" | "absent" | "excused";
  marked_at: string | null;
  session_date: string;
  period_number: number;
  day_of_week: string;
  subject_name: string;
  subject_color: string;
  class_name: string;
}

const STATUS_COLORS: Record<string, string> = {
  present: "bg-green-100 text-green-800",
  late: "bg-amber-100 text-amber-800",
  absent: "bg-red-100 text-red-800",
  excused: "bg-blue-100 text-blue-800",
};

const StudentAcademic = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string>("");
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: periodsData } = await (supabase as any)
      .from("academic_periods")
      .select("*")
      .order("period_number");
    setPeriods(periodsData || []);

    await Promise.all([
      loadMySlots(user.id),
      loadAttendance(user.id),
    ]);
    setLoading(false);
  };

  const loadMySlots = async (uid: string) => {
    // Step 1: Get student's class group memberships
    const { data: memberships } = await (supabase as any)
      .from("class_group_members")
      .select("class_group_id")
      .eq("student_id", uid)
      .limit(50);

    const groupIds = (memberships || []).map((m: any) => m.class_group_id);

    // Step 2: Get class group slots (shared lessons)
    let groupSlots: TimetableSlot[] = [];
    if (groupIds.length > 0) {
      const { data } = await (supabase as any)
        .from("timetable_slots")
        .select(`
          *,
          academic_subjects(*),
          class_groups(*),
          teacher_profile:profiles!timetable_slots_teacher_id_fkey(full_name, email)
        `)
        .in("class_group_id", groupIds)
        .limit(500);
      groupSlots = data || [];
    }

    // Step 3: Get elective enrollments
    const { data: enrollments } = await (supabase as any)
      .from("timetable_enrollments")
      .select("slot_id")
      .eq("student_id", uid)
      .limit(50);

    const electiveSlotIds = (enrollments || []).map((e: any) => e.slot_id);
    let electiveSlots: TimetableSlot[] = [];
    if (electiveSlotIds.length > 0) {
      const { data } = await (supabase as any)
        .from("timetable_slots")
        .select(`
          *,
          academic_subjects(*),
          class_groups(*),
          teacher_profile:profiles!timetable_slots_teacher_id_fkey(full_name, email)
        `)
        .in("id", electiveSlotIds)
        .limit(200);
      electiveSlots = data || [];
    }

    // Merge and deduplicate by (day, period)
    const seen = new Set<string>();
    const all: TimetableSlot[] = [];
    [...groupSlots, ...electiveSlots].forEach(s => {
      const key = `${s.day_of_week}-${s.period_number}`;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(s);
      }
    });
    setSlots(all);
  };

  const loadAttendance = async (uid: string) => {
    const { data, error } = await (supabase as any)
      .from("academic_attendance")
      .select(`
        id, status, marked_at,
        academic_sessions!inner(
          session_date,
          timetable_slots!inner(
            period_number, day_of_week,
            academic_subjects(name, color),
            class_groups(name)
          )
        )
      `)
      .eq("student_id", uid)
      .order("academic_sessions.session_date", { ascending: false })
      .limit(300);

    if (error) { console.error(error); return; }

    const entries: AttendanceEntry[] = (data || []).map((r: any) => {
      const slot = r.academic_sessions?.timetable_slots;
      return {
        id: r.id,
        status: r.status,
        marked_at: r.marked_at,
        session_date: r.academic_sessions?.session_date || "",
        period_number: slot?.period_number || 0,
        day_of_week: slot?.day_of_week || "",
        subject_name: slot?.academic_subjects?.name || "—",
        subject_color: slot?.academic_subjects?.color || "#6366f1",
        class_name: slot?.class_groups?.name || "Elective",
      };
    });
    setAttendanceHistory(entries);
  };

  // Per-subject attendance summary
  const subjectSummary = (() => {
    const map: Record<string, { name: string; color: string; total: number; present: number }> = {};
    attendanceHistory.forEach(e => {
      if (!map[e.subject_name]) {
        map[e.subject_name] = { name: e.subject_name, color: e.subject_color, total: 0, present: 0 };
      }
      map[e.subject_name].total++;
      if (e.status === "present" || e.status === "late") map[e.subject_name].present++;
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  })();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/student")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Academic</h1>
            <p className="text-sm text-muted-foreground">My timetable &amp; attendance</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="timetable">
          <TabsList className="mb-6">
            <TabsTrigger value="timetable">
              <BookOpen className="w-4 h-4 mr-2" />
              My Timetable
            </TabsTrigger>
            <TabsTrigger value="attendance">
              <ClipboardCheck className="w-4 h-4 mr-2" />
              My Attendance
            </TabsTrigger>
          </TabsList>

          {/* ── Timetable ── */}
          <TabsContent value="timetable">
            {slots.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <BookOpen className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="font-medium">No timetable yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your timetable will appear here once admin sets it up
                  </p>
                </CardContent>
              </Card>
            ) : (
              <AcademicWeeklyGrid periods={periods} slots={slots} />
            )}
          </TabsContent>

          {/* ── Attendance ── */}
          <TabsContent value="attendance" className="space-y-6">
            {/* Per-subject summary */}
            {subjectSummary.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {subjectSummary.map(s => {
                  const pct = s.total > 0 ? Math.round((s.present / s.total) * 100) : 0;
                  return (
                    <Card key={s.name} className="overflow-hidden">
                      <div className="h-1.5" style={{ backgroundColor: s.color }} />
                      <CardContent className="pt-3 pb-3">
                        <p className="font-medium text-sm truncate">{s.name}</p>
                        <p className="text-2xl font-bold mt-1">{pct}%</p>
                        <p className="text-xs text-muted-foreground">{s.present}/{s.total} sessions</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {attendanceHistory.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <ClipboardCheck className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="font-medium">No attendance records yet</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Attendance History</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attendanceHistory.map(e => (
                          <TableRow key={e.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: e.subject_color }}
                                />
                                <span className="font-medium text-sm">{e.subject_name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{e.class_name}</TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {e.session_date ? format(new Date(e.session_date), "dd MMM yyyy") : "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              <span className="text-xs text-muted-foreground">{e.day_of_week}</span>
                              <br />
                              P{e.period_number}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${STATUS_COLORS[e.status]} border-0 text-xs`}>
                                {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default StudentAcademic;
