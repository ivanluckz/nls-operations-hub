import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BookOpen, Calendar, Clock, BarChart3, GraduationCap } from "lucide-react";
import { isLightColor, DAY_LABELS } from "@/lib/academic-utils";
import { isDevUser } from "@/lib/dev-badge";
import FloatingChatButton from "@/components/student/FloatingChatButton";
import { format } from "date-fns";

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
  const [attendance, setAttendance] = useState<{ subject: string; subjectColor: string; total: number; present: number }[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [hasDev, setHasDev] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check Dev badge
      const { data: devBadge } = await (supabase as any).from("user_badges").select("id").eq("user_id", user.id).eq("badge_name", "Dev").maybeSingle();
      setHasDev(!!devBadge);

      const [p, s] = await Promise.all([
        (supabase as any).from("academic_periods").select("*").order("sort_order"),
        (supabase as any).from("academic_subjects").select("*"),
      ]);
      setPeriods(p.data || []);
      setSubjects(s.data || []);

      // Get student's class group
      const { data: membership } = await (supabase as any).from("class_group_members").select("class_group_id").eq("student_id", user.id);
      const groupIds = membership?.map((m: any) => m.class_group_id) || [];

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

      const teacherIds = [...new Set(allSlots.map(sl => sl.teacher_id).filter(Boolean))] as string[];
      if (teacherIds.length) {
        const { data: tProfiles } = await supabase.from("profiles").select("id, full_name").in("id", teacherIds);
        setTeachers(tProfiles || []);
      }

      // Attendance
      const slotIds = allSlots.map(sl => sl.id);
      if (slotIds.length) {
        const { data: sessions } = await (supabase as any).from("academic_sessions").select("id, slot_id").in("slot_id", slotIds);
        const sessionIds = sessions?.map((ss: any) => ss.id) || [];
        if (sessionIds.length) {
          const { data: att } = await (supabase as any).from("academic_attendance").select("session_id, status").eq("student_id", user.id).in("session_id", sessionIds);
          setRecords(att || []);

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
            return { subject: sub?.name || "?", subjectColor: sub?.color || "#6366f1", ...v };
          }));
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  const getSub = (id: string) => subjects.find(s => s.id === id);
  const getTeacher = (id: string | null) => id ? teachers.find(t => t.id === id) : null;

  // Upcoming classes: today's remaining + tomorrow's
  const upcomingClasses = useMemo(() => {
    const now = new Date();
    const todayDow = now.getDay(); // 0=Sun
    const currentTime = format(now, "HH:mm");

    const results: { slot: Slot; period: Period; subject: Subject; teacher: Teacher | null; isToday: boolean }[] = [];

    for (const day of [todayDow, todayDow + 1]) {
      const mappedDay = day === 0 || day > 5 ? null : day;
      if (!mappedDay) continue;
      const daySlots = slots.filter(s => s.day_of_week === mappedDay);
      for (const slot of daySlots) {
        const period = periods.find(p => p.sort_order === slot.period_number);
        const sub = getSub(slot.subject_id);
        if (!period || !sub || period.is_break) continue;
        const isToday = day === todayDow;
        if (isToday && period.start_time && period.start_time.slice(0, 5) < currentTime) continue;
        results.push({ slot, period, subject: sub, teacher: getTeacher(slot.teacher_id) || null, isToday });
      }
    }
    return results.sort((a, b) => {
      if (a.isToday !== b.isToday) return a.isToday ? -1 : 1;
      return a.period.sort_order - b.period.sort_order;
    }).slice(0, 6);
  }, [slots, periods, subjects, teachers]);

  // Unique subjects the student takes
  const mySubjects = useMemo(() => {
    const subjectIds = [...new Set(slots.map(s => s.subject_id))];
    return subjectIds.map(id => getSub(id)).filter(Boolean) as Subject[];
  }, [slots, subjects]);

  const overallAttendance = useMemo(() => {
    const total = records.length;
    const present = records.filter(r => r.status === "present").length;
    return total > 0 ? Math.round((present / total) * 100) : null;
  }, [records]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading academic data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="relative overflow-hidden border-b bg-gradient-to-r from-primary/8 via-background to-accent/8">
        <div className="absolute top-0 right-0 w-72 h-72 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="container relative mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/student")} className="hover:bg-primary/10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/25">
                <GraduationCap className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Academic</h1>
                <p className="text-xs text-muted-foreground">Your classes & progress</p>
              </div>
            </div>
            {hasDev && (
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 shadow-lg shadow-purple-500/25 animate-pulse">
                ⚡ DEV Respect
              </Badge>
            )}
          </div>

          {/* Quick stats bar */}
          <div className="flex gap-4 mt-4 flex-wrap">
            <div className="flex items-center gap-2 bg-card/80 backdrop-blur rounded-xl px-4 py-2 border shadow-sm">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{mySubjects.length} subjects</span>
            </div>
            <div className="flex items-center gap-2 bg-card/80 backdrop-blur rounded-xl px-4 py-2 border shadow-sm">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{slots.length} classes/week</span>
            </div>
            {overallAttendance !== null && (
              <div className="flex items-center gap-2 bg-card/80 backdrop-blur rounded-xl px-4 py-2 border shadow-sm">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{overallAttendance}% attendance</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <Tabs defaultValue="upcoming" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-lg mx-auto h-11 bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="upcoming" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <Clock className="w-3.5 h-3.5 mr-1 hidden sm:inline" />Upcoming
            </TabsTrigger>
            <TabsTrigger value="timetable" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <Calendar className="w-3.5 h-3.5 mr-1 hidden sm:inline" />Timetable
            </TabsTrigger>
            <TabsTrigger value="subjects" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <BookOpen className="w-3.5 h-3.5 mr-1 hidden sm:inline" />Subjects
            </TabsTrigger>
            <TabsTrigger value="attendance" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <BarChart3 className="w-3.5 h-3.5 mr-1 hidden sm:inline" />Attendance
            </TabsTrigger>
          </TabsList>

          {/* UPCOMING CLASSES */}
          <TabsContent value="upcoming" className="space-y-4">
            {upcomingClasses.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Clock className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium">No upcoming classes</p>
                  <p className="text-xs text-muted-foreground mt-1">Enjoy your free time!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {upcomingClasses.map((cls, i) => (
                  <Card key={i} className="overflow-hidden hover:shadow-md transition-shadow group">
                    <div className="flex">
                      <div className="w-1.5 shrink-0" style={{ backgroundColor: cls.subject.color }} />
                      <CardContent className="flex-1 p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm"
                            style={{ backgroundColor: cls.subject.color + "20", color: cls.subject.color }}>
                            {cls.subject.code || cls.subject.name.slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{cls.subject.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              {cls.teacher && <span>{cls.teacher.full_name}</span>}
                              {cls.slot.room && <span>• {cls.slot.room}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <Badge variant={cls.isToday ? "default" : "secondary"} className="text-[10px] mb-1">
                            {cls.isToday ? "Today" : "Tomorrow"}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {cls.period.start_time?.slice(0, 5)} – {cls.period.end_time?.slice(0, 5)}
                          </p>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TIMETABLE */}
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
                              ☕ {period.label} ({period.start_time?.slice(0, 5)} – {period.end_time?.slice(0, 5)})
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={period.id} className="group hover:bg-muted/20 transition-colors">
                          <td className="border-b border-r p-2 text-center">
                            <span className="text-xs font-medium">{period.label}</span>
                            <br />
                            <span className="text-[10px] text-muted-foreground">{period.start_time?.slice(0, 5)}–{period.end_time?.slice(0, 5)}</span>
                          </td>
                          {[1, 2, 3, 4, 5].map(day => {
                            const slot = slots.find(s => s.day_of_week === day && s.period_number === period.sort_order);
                            const sub = slot ? getSub(slot.subject_id) : null;
                            const teacher = slot ? getTeacher(slot.teacher_id) : null;
                            return (
                              <td key={day} className="border-b p-1 h-[4.5rem]">
                                {sub ? (
                                  <div className="rounded-lg p-2 h-full flex flex-col justify-center transition-transform hover:scale-[1.02]"
                                    style={{ backgroundColor: sub.color, color: isLightColor(sub.color) ? '#1a1a1a' : '#fff' }}>
                                    <span className="text-xs font-bold truncate">{sub.code || sub.name.slice(0, 10)}</span>
                                    {teacher && <span className="text-[10px] opacity-80 truncate">{teacher.full_name.split(" ")[0]}</span>}
                                    {slot?.room && <span className="text-[10px] opacity-60">{slot.room}</span>}
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

          {/* SUBJECTS */}
          <TabsContent value="subjects" className="space-y-3">
            {mySubjects.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium">No subjects enrolled</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {mySubjects.map(sub => {
                  const subSlots = slots.filter(s => s.subject_id === sub.id);
                  const subTeacherIds = [...new Set(subSlots.map(s => s.teacher_id).filter(Boolean))];
                  const subTeachers = subTeacherIds.map(id => getTeacher(id)).filter(Boolean);
                  const att = attendance.find(a => a.subject === sub.name);
                  const pct = att && att.total > 0 ? Math.round((att.present / att.total) * 100) : null;

                  return (
                    <Card key={sub.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      <div className="h-2" style={{ backgroundColor: sub.color }} />
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-sm">{sub.name}</h3>
                            {sub.code && <p className="text-xs text-muted-foreground">{sub.code}</p>}
                          </div>
                          {pct !== null && (
                            <Badge variant={pct >= 80 ? "default" : pct >= 60 ? "secondary" : "destructive"} className="text-[10px] shrink-0">
                              {pct}%
                            </Badge>
                          )}
                        </div>
                        <div className="mt-3 space-y-1">
                          <p className="text-xs text-muted-foreground">
                            {subSlots.length} class{subSlots.length !== 1 ? "es" : ""}/week
                          </p>
                          {subTeachers.map(t => (
                            <p key={t!.id} className="text-xs text-muted-foreground">👤 {t!.full_name}</p>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ATTENDANCE */}
          <TabsContent value="attendance" className="space-y-6">
            {/* Overall summary */}
            {overallAttendance !== null && (
              <Card className="bg-gradient-to-r from-primary/5 via-background to-primary/5 border-primary/20">
                <CardContent className="py-6 text-center">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Overall Attendance</p>
                  <p className={`text-5xl font-black mt-2 ${overallAttendance >= 80 ? "text-green-600 dark:text-green-400" : overallAttendance >= 60 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                    {overallAttendance}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {records.filter(r => r.status === "present").length} present out of {records.length} sessions
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Per-subject breakdown */}
            {attendance.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {attendance.map(a => {
                  const pct = a.total > 0 ? Math.round((a.present / a.total) * 100) : 0;
                  return (
                    <Card key={a.subject} className="overflow-hidden hover:shadow-md transition-shadow">
                      <div className="h-1" style={{ backgroundColor: a.subjectColor }} />
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground truncate font-medium">{a.subject}</p>
                        <p className={`text-3xl font-black mt-2 ${pct >= 80 ? "text-green-600 dark:text-green-400" : pct >= 60 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                          {pct}%
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">{a.present}/{a.total} present</p>
                        {/* Mini progress bar */}
                        <div className="w-full h-1.5 rounded-full bg-muted mt-3 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: a.subjectColor }} />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium">No attendance records yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Records will appear once teachers mark attendance</p>
                </CardContent>
              </Card>
            )}

            {/* Summary stats */}
            {records.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Breakdown</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">{records.filter(r => r.status === "present").length}</p>
                      <p className="text-xs text-muted-foreground">Present</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">{records.filter(r => r.status === "absent").length}</p>
                      <p className="text-xs text-muted-foreground">Absent</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{records.filter(r => r.status === "late").length}</p>
                      <p className="text-xs text-muted-foreground">Late</p>
                    </div>
                  </div>
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