import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Save, Upload, BookOpen, CalendarCheck, AlertCircle } from "lucide-react";
import type { AcademicPeriod, TimetableSlot } from "@/types/academic";
import { ACADEMIC_DAYS, textColorForBg } from "@/types/academic";
import QRScanner from "@/components/attendance/QRScanner";
import BulkActions from "@/components/attendance/BulkActions";

interface StudentRecord {
  student_id: string;
  student_name: string;
  student_email: string;
}

interface AttendanceRecord {
  student_id: string;
  status: "present" | "late" | "absent" | "excused";
}

const TeacherAcademic = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [userId, setUserId] = useState<string>("");
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [mySlots, setMySlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);

  // Attendance tab state
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [attendance, setAttendance] = useState<Map<string, AttendanceRecord>>(new Map());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [periodsRes, slotsRes] = await Promise.all([
      (supabase as any).from("academic_periods").select("*").order("period_number"),
      (supabase as any)
        .from("timetable_slots")
        .select("*, academic_subjects(*), class_groups(*)")
        .eq("teacher_id", user.id)
        .order("day_of_week")
        .order("period_number")
        .limit(200),
    ]);

    setPeriods(periodsRes.data || []);
    setMySlots(slotsRes.data || []);
    setLoading(false);
  };

  // When slot changes: load/create session + fetch students
  useEffect(() => {
    if (!selectedSlotId || !userId) return;
    loadSessionAndStudents(selectedSlotId);
  }, [selectedSlotId, userId]);

  const loadSessionAndStudents = async (slotId: string) => {
    const slot = mySlots.find(s => s.id === slotId);
    if (!slot) return;

    const today = new Date().toISOString().split("T")[0];

    // Idempotent: check for existing session first
    const { data: existing } = await (supabase as any)
      .from("academic_sessions")
      .select("id, status")
      .eq("slot_id", slotId)
      .eq("session_date", today)
      .maybeSingle();

    let sid = existing?.id;
    if (!sid) {
      const { data: newSession, error } = await (supabase as any)
        .from("academic_sessions")
        .insert({ slot_id: slotId, session_date: today, teacher_id: userId, status: "open" })
        .select()
        .single();
      if (error) {
        toast({ variant: "destructive", title: "Error", description: "Could not create session" });
        return;
      }
      sid = newSession.id;
    }
    setSessionId(sid);

    // Load student list based on slot type
    let studentIds: string[] = [];
    if (!slot.is_elective && slot.class_group_id) {
      const { data: members } = await (supabase as any)
        .from("class_group_members")
        .select("student_id")
        .eq("class_group_id", slot.class_group_id)
        .limit(500);
      studentIds = (members || []).map((m: any) => m.student_id);
    } else {
      const { data: enrolled } = await (supabase as any)
        .from("timetable_enrollments")
        .select("student_id")
        .eq("slot_id", slotId)
        .limit(500);
      studentIds = (enrolled || []).map((e: any) => e.student_id);
    }

    if (studentIds.length === 0) {
      setStudents([]);
      setAttendance(new Map());
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", studentIds);

    const list: StudentRecord[] = (profiles || []).map(p => ({
      student_id: p.id,
      student_name: p.full_name || "Unknown",
      student_email: p.email || "",
    }));
    setStudents(list);

    // Load existing attendance
    const newAtt = new Map<string, AttendanceRecord>();
    list.forEach(s => newAtt.set(s.student_id, { student_id: s.student_id, status: "absent" }));

    const { data: existingAtt } = await (supabase as any)
      .from("academic_attendance")
      .select("student_id, status")
      .eq("session_id", sid);

    (existingAtt || []).forEach((r: any) => {
      newAtt.set(r.student_id, { student_id: r.student_id, status: r.status });
    });
    setAttendance(newAtt);
  };

  const markAttendance = (studentId: string, status: "present" | "late" | "absent" | "excused") => {
    const newAtt = new Map(attendance);
    newAtt.set(studentId, { student_id: studentId, status });
    setAttendance(newAtt);
  };

  const handleQRScanned = (studentId: string) => {
    markAttendance(studentId, "present");
  };

  const handleBulkMark = (status: "present" | "absent") => {
    const newAtt = new Map(attendance);
    students.forEach(s => {
      if (newAtt.get(s.student_id)?.status !== "excused") {
        newAtt.set(s.student_id, { student_id: s.student_id, status });
      }
    });
    setAttendance(newAtt);
  };

  const saveDraft = async () => {
    if (!sessionId) return;
    setSaving(true);
    try {
      const records = Array.from(attendance.values()).map(r => ({
        session_id: sessionId,
        student_id: r.student_id,
        status: r.status,
        marked_by: userId,
      }));

      await (supabase as any).from("academic_attendance").delete().eq("session_id", sessionId);
      const { error } = await (supabase as any).from("academic_attendance").insert(records);
      if (error) throw error;
      toast({ title: "Draft saved" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const finalizeSession = async () => {
    if (!sessionId) return;
    setSaving(true);
    try {
      await saveDraft();
      const { error } = await (supabase as any)
        .from("academic_sessions")
        .update({ status: "finalized", finalized_at: new Date().toISOString() })
        .eq("id", sessionId);
      if (error) throw error;
      const absentCount = Array.from(attendance.values()).filter(r => r.status === "absent").length;
      toast({ title: "Attendance finalized", description: `${absentCount} student(s) absent` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Timetable grid helpers
  const lessonPeriods = periods.filter(p => !p.is_break);
  const slotMap = new Map<string, TimetableSlot>();
  mySlots.forEach(s => slotMap.set(`${s.day_of_week}-${s.period_number}`, s));

  const presentCount = Array.from(attendance.values()).filter(r => r.status === "present").length;
  const lateCount = Array.from(attendance.values()).filter(r => r.status === "late").length;
  const absentCount = Array.from(attendance.values()).filter(r => r.status === "absent").length;
  const excusedCount = Array.from(attendance.values()).filter(r => r.status === "excused").length;

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
          <Button variant="ghost" size="icon" onClick={() => navigate("/teacher")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Academic Classes</h1>
            <p className="text-sm text-muted-foreground">My lessons &amp; attendance</p>
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
              <CalendarCheck className="w-4 h-4 mr-2" />
              Take Attendance
            </TabsTrigger>
          </TabsList>

          {/* ── My Timetable ── */}
          <TabsContent value="timetable">
            {mySlots.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <BookOpen className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="font-medium">No lessons assigned</p>
                  <p className="text-sm text-muted-foreground mt-1">Contact admin to set up your timetable</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-3 w-28 font-medium text-muted-foreground">Period</th>
                        {ACADEMIC_DAYS.map(day => (
                          <th key={day} className="text-center px-2 py-3 font-medium min-w-[120px]">{day}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map(period => (
                        <tr key={period.id} className={`border-b ${period.is_break ? "bg-muted/30" : ""}`}>
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
                              const slot = slotMap.get(`${day}-${period.period_number}`);
                              const subj = slot?.academic_subjects;
                              return (
                                <td key={day} className="px-2 py-2 text-center">
                                  {slot && subj ? (
                                    <div
                                      className="rounded px-2 py-2 text-left"
                                      style={{ backgroundColor: subj.color, color: textColorForBg(subj.color) }}
                                    >
                                      <div className="font-semibold text-xs leading-tight">{subj.name}</div>
                                      {slot.class_groups && (
                                        <div className="text-xs opacity-80">{slot.class_groups.name}</div>
                                      )}
                                      {slot.room && <div className="text-xs opacity-70">{slot.room}</div>}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground/30 text-xs">—</span>
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
          </TabsContent>

          {/* ── Take Attendance ── */}
          <TabsContent value="attendance" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Select Lesson (today)</CardTitle></CardHeader>
              <CardContent>
                <Select value={selectedSlotId} onValueChange={setSelectedSlotId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a lesson…" />
                  </SelectTrigger>
                  <SelectContent>
                    {mySlots.map(slot => (
                      <SelectItem key={slot.id} value={slot.id}>
                        {slot.academic_subjects?.name} — {slot.day_of_week} P{slot.period_number}
                        {slot.class_groups ? ` (${slot.class_groups.name})` : " (Elective)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {selectedSlotId && students.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>No students enrolled in this lesson yet.</AlertDescription>
              </Alert>
            )}

            {selectedSlotId && students.length > 0 && (
              <>
                {absentCount > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {absentCount} student(s) currently marked absent.
                    </AlertDescription>
                  </Alert>
                )}

                <BulkActions
                  studentCount={students.length}
                  onMarkAll={handleBulkMark}
                  presentCount={presentCount}
                  lateCount={lateCount}
                  absentCount={absentCount}
                  excusedCount={excusedCount}
                />

                <QRScanner
                  students={students}
                  attendance={attendance}
                  onStudentScanned={handleQRScanned}
                />

                <Card>
                  <CardHeader><CardTitle>Manual Attendance</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {students.map(student => {
                        const record = attendance.get(student.student_id);
                        return (
                          <div key={student.student_id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={record?.status === "present"}
                                onCheckedChange={checked =>
                                  markAttendance(student.student_id, checked ? "present" : "absent")
                                }
                              />
                              <div>
                                <p className="font-medium text-sm">{student.student_name}</p>
                                <p className="text-xs text-muted-foreground">{student.student_email}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {(["present", "late", "absent", "excused"] as const).map(s => (
                                <Badge
                                  key={s}
                                  variant={record?.status === s ? "default" : "outline"}
                                  className={`cursor-pointer text-xs ${
                                    s === "late" ? "bg-amber-100 text-amber-800 border-amber-200" :
                                    s === "excused" ? "bg-blue-100 text-blue-800 border-blue-200" :
                                    s === "absent" && record?.status === s ? "bg-destructive text-destructive-foreground" : ""
                                  }`}
                                  onClick={() => markAttendance(student.student_id, s)}
                                >
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-4">
                  <Button variant="outline" className="flex-1" onClick={saveDraft} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Draft
                  </Button>
                  <Button className="flex-1" onClick={finalizeSession} disabled={saving}>
                    <Upload className="w-4 h-4 mr-2" />
                    Finalize
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default TeacherAcademic;
