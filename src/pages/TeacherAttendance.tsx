import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Upload, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SESSION_STATUS, ATTENDANCE_STATUS, USER_ROLES, LATE_GRACE_PERIOD_MINUTES, ABSENT_THRESHOLD_MINUTES } from "@/lib/constants";
import QRScanner from "@/components/attendance/QRScanner";
import BulkActions from "@/components/attendance/BulkActions";

interface Activity {
  id: string;
  title: string;
  days_of_week: string[];
  schedule: string;
}

interface Student {
  student_id: string;
  student_name: string;
  student_email: string;
}

interface AttendanceRecord {
  student_id: string;
  status: "present" | "late" | "absent" | "excused";
  scanned_at?: string;
}

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// "Wednesday Slot 1" → "Wednesday", "Monday" → "Monday"
const normalizeDay = (d: string) => d.replace(/\s+Slot\s+\d+$/, "");

const sortDays = (days: string[]) =>
  [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));

/** Parse the first or last time from "3:00 PM - 4:00 PM". pass index=-1 for end time. */
const parseScheduleTime = (schedule: string, index: 0 | -1): Date | null => {
  const matches = [...schedule.matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi)];
  const m = index === 0 ? matches[0] : matches[matches.length - 1];
  if (!m) return null;
  let hours = parseInt(m[1]);
  const minutes = parseInt(m[2]);
  const ampm = m[3].toUpperCase();
  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
};

/** Determine auto status based on scan time vs activity start */
const getAutoStatus = (scannedAt: string, activitySchedule: string): "present" | "late" => {
  const startTime = parseScheduleTime(activitySchedule, 0);
  if (!startTime) return "present";

  const scanTime = new Date(scannedAt);
  const diffMinutes = (scanTime.getTime() - startTime.getTime()) / (1000 * 60);

  if (diffMinutes <= LATE_GRACE_PERIOD_MINUTES) return "present";
  return "late"; // Scanned after grace period (including after session ended) = late
};

const TeacherAttendance = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<number>(1);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Map<string, AttendanceRecord>>(new Map());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<string>(USER_ROLES.TEACHER);

  const canExcuseStudents = userRole === USER_ROLES.ADMIN || userRole === USER_ROLES.MODERATOR;

  const selectedActivityData = activities.find(a => a.id === selectedActivity);

  const activityDayOptions = useMemo(() => {
    if (!selectedActivityData) return [];
    const uniqueDays = [...new Set((selectedActivityData.days_of_week || []).map(normalizeDay))];
    return sortDays(uniqueDays.length > 0 ? uniqueDays : DAY_ORDER);
  }, [selectedActivityData]);

  const daySlotCount = selectedActivityData && selectedDay
    ? selectedActivityData.days_of_week.filter(d => normalizeDay(d) === selectedDay).length
    : 0;

  const fetchActivities = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const fetchedUserRole = roleData?.role;
      setUserRole(fetchedUserRole || USER_ROLES.TEACHER);
      const isAdminOrMod = fetchedUserRole === USER_ROLES.ADMIN || fetchedUserRole === USER_ROLES.MODERATOR;

      let query = supabase
        .from("activities")
        .select("id, title, days_of_week, schedule, teacher_id, teacher_in_charge")
        .order("title");

      // Admins/mods see all activities; teachers/RL coaches see only their assigned activities
      if (!isAdminOrMod) {
        query = query
          .eq("is_active", true)
          .eq("teacher_id", user.id);
      }

      const { data } = await query;
      setActivities(data || []);
    } catch (error) {
      console.error("Error fetching activities:", error);
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      const dayVariants = selectedDay === "Wednesday"
        ? ["Wednesday", `Wednesday Slot ${selectedSlot}`]
        : [selectedDay];

      const { data: allocations } = await supabase
        .from("allocations")
        .select("student_id")
        .eq("activity_id", selectedActivity)
        .in("day_of_week", dayVariants)
        .eq("slot_number", selectedSlot);

      const studentIds = [...new Set((allocations || []).map((a: any) => a.student_id))];

      if (studentIds.length === 0) {
        setStudents([]);
        setAttendance(new Map());
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", studentIds);

      const studentList: Student[] = (profiles || []).map(p => ({
        student_id: p.id,
        student_name: p.full_name || 'Unknown',
        student_email: p.email || '',
      }));

      setStudents(studentList);

      const newAttendance = new Map<string, AttendanceRecord>();
      studentList.forEach(student => {
        newAttendance.set(student.student_id, {
          student_id: student.student_id,
          status: ATTENDANCE_STATUS.ABSENT as "absent"
        });
      });
      setAttendance(newAttendance);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  }, [selectedActivity, selectedDay, selectedSlot]);

  const createOrLoadSession = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];

      const { data: existingSession } = await supabase
        .from("attendance_sessions")
        .select("id, status")
        .eq("activity_id", selectedActivity)
        .eq("teacher_id", user.id)
        .eq("session_date", today)
        .eq("day_of_week", selectedDay)
        .eq("slot_number", selectedSlot)
        .eq("status", SESSION_STATUS.DRAFT)
        .maybeSingle();

      if (existingSession) {
        setSessionId(existingSession.id);
        await loadExistingAttendance(existingSession.id);
      } else {
        const { data: newSession, error } = await supabase
          .from("attendance_sessions")
          .insert({
            activity_id: selectedActivity,
            teacher_id: user.id,
            session_date: today,
            day_of_week: selectedDay,
            slot_number: selectedSlot,
            status: SESSION_STATUS.DRAFT
          })
          .select()
          .single();

        if (error) throw error;
        setSessionId(newSession.id);
      }
    } catch (error) {
      console.error("Error creating session:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create attendance session",
      });
    }
  }, [selectedActivity, selectedDay, selectedSlot, toast]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // When activity or day changes, reset slot to 1
  useEffect(() => {
    setSelectedSlot(1);
  }, [selectedActivity, selectedDay]);

  useEffect(() => {
    if (selectedActivity && selectedDay) {
      const init = async () => {
        await fetchStudents();
        await createOrLoadSession();
      };
      init();
    }
  }, [selectedActivity, selectedDay, selectedSlot, fetchStudents, createOrLoadSession]);

  const loadExistingAttendance = async (sid: string) => {
    try {
      const { data } = await supabase
        .from("attendance_records")
        .select("student_id, status")
        .eq("session_id", sid);

      if (data && data.length > 0) {
        setAttendance(prev => {
          const updated = new Map(prev);
          data.forEach(record => {
            updated.set(record.student_id, {
              student_id: record.student_id,
              status: record.status as "present" | "late" | "absent" | "excused"
            });
          });
          return updated;
        });
      }
    } catch (error) {
      console.error("Error loading attendance:", error);
    }
  };

  const handleQRScanned = (studentId: string, scannedAt: string) => {
    const schedule = selectedActivityData?.schedule || "";
    const autoStatus = getAutoStatus(scannedAt, schedule);
    markAttendance(studentId, autoStatus, scannedAt);
  };

  const markAttendance = (studentId: string, status: "present" | "late" | "absent" | "excused", scannedAt?: string) => {
    if (status === ATTENDANCE_STATUS.EXCUSED && !canExcuseStudents) {
      toast({
        variant: "destructive",
        title: "Not Authorized",
        description: "Only administrators and moderators can excuse students.",
      });
      return;
    }

    const newAttendance = new Map(attendance);
    newAttendance.set(studentId, { student_id: studentId, status, scanned_at: scannedAt });
    setAttendance(newAttendance);
  };

  const handleBulkMark = (status: "present" | "absent") => {
    const newAttendance = new Map(attendance);
    students.forEach(student => {
      const existing = newAttendance.get(student.student_id);
      // Don't override excused students
      if (existing?.status !== ATTENDANCE_STATUS.EXCUSED) {
        newAttendance.set(student.student_id, {
          student_id: student.student_id,
          status,
        });
      }
    });
    setAttendance(newAttendance);
    toast({
      title: `All Marked ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      description: `${students.length} student(s) marked as ${status}`,
    });
  };

  const saveDraft = async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const records = Array.from(attendance.values()).map(record => ({
        session_id: sessionId,
        student_id: record.student_id,
        status: record.status,
        marked_by: user.id
      }));

      await supabase
        .from("attendance_records")
        .delete()
        .eq("session_id", sessionId);

      const { error } = await supabase
        .from("attendance_records")
        .insert(records);

      if (error) throw error;

      toast({ title: "Draft Saved", description: "Attendance saved as draft" });
    } catch (error) {
      console.error("Error saving draft:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save draft" });
    } finally {
      setLoading(false);
    }
  };

  const finalizeAttendance = async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      await saveDraft();

      const { error } = await supabase
        .from("attendance_sessions")
        .update({
          status: SESSION_STATUS.SUBMITTED,
          finalized_at: new Date().toISOString()
        })
        .eq("id", sessionId);

      if (error) throw error;

      const absentStudents = Array.from(attendance.values())
        .filter(r => r.status === ATTENDANCE_STATUS.ABSENT);

      toast({
        title: "Attendance Finalized",
        description: `Finalized with ${absentStudents.length} absent student(s)`,
      });

      navigate(`/${userRole}`);
    } catch (error) {
      console.error("Error finalizing attendance:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to finalize attendance" });
    } finally {
      setLoading(false);
    }
  };

  const presentCount = Array.from(attendance.values()).filter(r => r.status === ATTENDANCE_STATUS.PRESENT).length;
  const lateCount = Array.from(attendance.values()).filter(r => r.status === ATTENDANCE_STATUS.LATE).length;
  const absentCount = Array.from(attendance.values()).filter(r => r.status === ATTENDANCE_STATUS.ABSENT).length;
  const excusedCount = Array.from(attendance.values()).filter(r => r.status === ATTENDANCE_STATUS.EXCUSED).length;

  const sessionEnded = selectedActivityData?.schedule
    ? (() => { const t = parseScheduleTime(selectedActivityData.schedule, -1); return t ? new Date() > t : false; })()
    : false;

  return (
    <div className="min-h-screen bg-transparent">
      <header className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/${userRole}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Take Attendance</h1>
            <p className="text-sm text-muted-foreground">Scan QR or mark manually</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Select Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Activity</label>
                <Select value={selectedActivity} onValueChange={setSelectedActivity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select activity" />
                  </SelectTrigger>
                  <SelectContent>
                    {activities.map(activity => (
                      <SelectItem key={activity.id} value={activity.id}>
                        {activity.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Day</label>
                <Select value={selectedDay} onValueChange={setSelectedDay} disabled={!selectedActivity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {activityDayOptions.map(day => (
                      <SelectItem key={day} value={day}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {daySlotCount > 1 && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Slot</label>
                  <Select value={String(selectedSlot)} onValueChange={v => setSelectedSlot(Number(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select slot" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: daySlotCount }, (_, i) => i + 1).map(slot => (
                        <SelectItem key={slot} value={String(slot)}>
                          Slot {slot}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedActivity && selectedDay && students.length > 0 && (
          <>
            {sessionEnded && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Session ended.</strong> Students not scanned are automatically marked absent.
                  Any student who scans now will be marked <strong>late</strong>.
                </AlertDescription>
              </Alert>
            )}

            {!sessionEnded && absentCount > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {absentCount} student(s) marked as absent. Review before finalizing.
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

            {selectedActivityData?.schedule && !sessionEnded && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Auto-late detection active — Students scanned more than {LATE_GRACE_PERIOD_MINUTES} min after the start of {selectedActivityData.schedule} are automatically marked late.
                </AlertDescription>
              </Alert>
            )}

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Manual Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {students.map(student => {
                    const record = attendance.get(student.student_id);
                    return (
                      <div key={student.student_id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <Checkbox
                            checked={record?.status === ATTENDANCE_STATUS.PRESENT}
                            onCheckedChange={(checked) =>
                              markAttendance(student.student_id, checked ? ATTENDANCE_STATUS.PRESENT as "present" : ATTENDANCE_STATUS.ABSENT as "absent")
                            }
                          />
                          <div>
                            <p className="font-medium">{student.student_name}</p>
                            <p className="text-sm text-muted-foreground">{student.student_email}</p>
                            {record?.scanned_at && (
                              <p className="text-xs text-muted-foreground">
                                Scanned: {new Date(record.scanned_at).toLocaleTimeString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            variant={record?.status === ATTENDANCE_STATUS.PRESENT ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => markAttendance(student.student_id, ATTENDANCE_STATUS.PRESENT as "present")}
                          >
                            Present
                          </Badge>
                          <Badge
                            variant={record?.status === ATTENDANCE_STATUS.LATE ? "default" : "outline"}
                            className="cursor-pointer bg-amber-100 text-amber-800 hover:bg-amber-200"
                            onClick={() => markAttendance(student.student_id, ATTENDANCE_STATUS.LATE as "late")}
                          >
                            Late
                          </Badge>
                          <Badge
                            variant={record?.status === ATTENDANCE_STATUS.ABSENT ? "destructive" : "outline"}
                            className="cursor-pointer"
                            onClick={() => markAttendance(student.student_id, ATTENDANCE_STATUS.ABSENT as "absent")}
                          >
                            Absent
                          </Badge>
                          {canExcuseStudents && (
                            <Badge
                              variant={record?.status === ATTENDANCE_STATUS.EXCUSED ? "default" : "outline"}
                              className="cursor-pointer bg-blue-100 text-blue-800 hover:bg-blue-200"
                              onClick={() => markAttendance(student.student_id, ATTENDANCE_STATUS.EXCUSED as "excused")}
                            >
                              Excused
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button onClick={saveDraft} variant="outline" className="flex-1" disabled={loading}>
                <Save className="w-4 h-4 mr-2" />
                Save Draft
              </Button>
              <Button onClick={finalizeAttendance} className="flex-1" disabled={loading}>
                <Upload className="w-4 h-4 mr-2" />
                Finalize & Upload
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default TeacherAttendance;
