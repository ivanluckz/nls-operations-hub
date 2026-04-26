import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  QrCode, LogOut, Stethoscope, ClipboardList, ShieldCheck,
  Users, AlertTriangle, Search, AlertCircle, UserCheck, Calendar,
} from "lucide-react";
import MealQRScanner from "@/components/kitchen/MealQRScanner";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import AttendanceChart from "@/components/dashboard/AttendanceChart";
import HouseBadge from "@/components/ui/HouseBadge";
import { format } from "date-fns";
import { SESSION_STATUS, ATTENDANCE_STATUS } from "@/lib/constants";

interface Visit {
  id: string;
  student_id: string;
  condition: string;
  treatment: string | null;
  notes: string | null;
  visit_date: string;
  scanned_at: string;
  student_name?: string;
}

interface Clearance {
  id: string;
  student_id: string;
  status: string;
  restriction_reason: string | null;
  valid_until: string | null;
  created_at: string;
  student_name?: string;
}

interface Student {
  id: string;
  full_name: string;
  email: string;
}

interface Allocation {
  student_id: string;
  activity_id: string;
  day_of_week: string;
  slot_number: number;
  activity_title: string;
}

type ExcuseType = "cocurricular" | "workout";

const MedicalDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);

  // Scanning
  const [scanning, setScanning] = useState(false);
  const [scannedStudentId, setScannedStudentId] = useState<string | null>(null);
  const [scannedStudentName, setScannedStudentName] = useState("");

  // Visit form
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [condition, setCondition] = useState("");
  const [treatment, setTreatment] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Clearance form
  const [clearanceDialogOpen, setClearanceDialogOpen] = useState(false);
  const [clearanceStatus, setClearanceStatus] = useState<"cleared" | "restricted">("restricted");
  const [restrictionReason, setRestrictionReason] = useState("");
  const [validUntil, setValidUntil] = useState("");

  // Data
  const [todayVisits, setTodayVisits] = useState<Visit[]>([]);
  const [activeClearances, setActiveClearances] = useState<Clearance[]>([]);
  const [todayWorkoutCount, setTodayWorkoutCount] = useState(0);
  const [absentToday, setAbsentToday] = useState<Array<{ id: string; student_id: string; student_name: string; status: string; location: string }>>([]);

  // Excuse tab state
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [excuseType, setExcuseType] = useState<ExcuseType>("cocurricular");
  const [excuseSearch, setExcuseSearch] = useState("");
  const [excuseStudentId, setExcuseStudentId] = useState("");
  const [excuseAllocations, setExcuseAllocations] = useState<Allocation[]>([]);
  const [excuseLoadingAllocs, setExcuseLoadingAllocs] = useState(false);
  const [excuseActivityId, setExcuseActivityId] = useState("");
  const [excuseDay, setExcuseDay] = useState("");
  const [excuseDate, setExcuseDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [excuseReason, setExcuseReason] = useState("");
  const [excuseLoading, setExcuseLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
    fetchData();
    fetchAllStudents();
  }, []);

  useEffect(() => {
    if (excuseStudentId && excuseType === "cocurricular") {
      fetchStudentAllocations(excuseStudentId);
      setExcuseActivityId("");
      setExcuseDay("");
    } else {
      setExcuseAllocations([]);
    }
  }, [excuseStudentId, excuseType]);

  // Auto-select day when only one option
  useEffect(() => {
    if (excuseActivityId && excuseAllocations.length > 0) {
      const matching = excuseAllocations.filter(a => a.activity_id === excuseActivityId);
      if (matching.length === 1) setExcuseDay(matching[0].day_of_week);
      else if (!matching.find(a => a.day_of_week === excuseDay)) setExcuseDay("");
    }
  }, [excuseActivityId, excuseAllocations]);

  const fetchData = async () => {
    const today = new Date().toISOString().split("T")[0];

    const [{ data: visits }, { data: clearances }, { count: workoutCount }, { data: absent }] = await Promise.all([
      (supabase as any).from("medical_visits").select("*").eq("visit_date", today).order("scanned_at", { ascending: false }),
      (supabase as any).from("workout_clearances").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("workout_attendance").select("id", { count: "exact", head: true }).eq("workout_date", today),
      (supabase as any).from("workout_attendance")
        .select("id, student_id, status, location")
        .eq("workout_date", today)
        .in("status", ["absent", "late"])
        .order("scanned_at", { ascending: false }),
    ]);

    const studentIds = new Set<string>();
    (visits || []).forEach((v: any) => studentIds.add(v.student_id));
    (clearances || []).forEach((c: any) => studentIds.add(c.student_id));
    (absent || []).forEach((a: any) => studentIds.add(a.student_id));

    const nameMap: Record<string, string> = {};
    if (studentIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", Array.from(studentIds));
      (profiles || []).forEach((p) => { nameMap[p.id] = p.full_name; });
    }

    setTodayVisits((visits || []).map((v: any) => ({ ...v, student_name: nameMap[v.student_id] || "Unknown" })));
    setActiveClearances((clearances || []).map((c: any) => ({ ...c, student_name: nameMap[c.student_id] || "Unknown" })));
    setTodayWorkoutCount(workoutCount || 0);
    setAbsentToday((absent || []).map((a: any) => ({ ...a, student_name: nameMap[a.student_id] || "Unknown" })));
  };

  const fetchAllStudents = async () => {
    const { data: studentRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "student")
      .limit(500);
    const ids = (studentRoles || []).map(r => r.user_id);
    if (ids.length === 0) return;
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids)
      .order("full_name");
    setAllStudents(profiles || []);
  };

  const fetchStudentAllocations = async (studentId: string) => {
    setExcuseLoadingAllocs(true);
    try {
      const { data } = await supabase
        .from("allocations")
        .select("student_id, activity_id, day_of_week, slot_number, activities(title)")
        .eq("student_id", studentId);

      const formatted: Allocation[] = (data || []).map((item: any) => ({
        student_id: item.student_id,
        activity_id: item.activity_id,
        day_of_week: item.day_of_week,
        slot_number: item.slot_number || 1,
        activity_title: item.activities?.title || "Unknown",
      }));
      setExcuseAllocations(formatted);
    } finally {
      setExcuseLoadingAllocs(false);
    }
  };

  const handleScan = useCallback(async (studentId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", studentId)
      .single();

    setScannedStudentId(studentId);
    setScannedStudentName(profile?.full_name || "Unknown Student");
    setScanning(false);
    setVisitDialogOpen(true);
    setCondition("");
    setTreatment("");
    setVisitNotes("");
  }, []);

  const saveVisit = async () => {
    if (!scannedStudentId || !userId || !condition.trim()) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("medical_visits").insert({
        student_id: scannedStudentId,
        medical_staff_id: userId,
        condition: condition.trim(),
        treatment: treatment.trim() || null,
        notes: visitNotes.trim() || null,
      });
      if (error) throw error;
      toast({ title: "✅ Visit Recorded", description: `${scannedStudentName} - ${condition}` });
      setVisitDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const convertAbsentToMedical = async (studentId: string, studentName: string) => {
    if (!userId) return;
    if (!confirm(`Log a medical visit for ${studentName}? This will mark today's workout as 🏥 medical.`)) return;
    const condition = window.prompt(`Reason / condition for ${studentName}:`, "Reported to medical office");
    if (!condition) return;
    const { error } = await (supabase as any).from("medical_visits").insert({
      student_id: studentId,
      medical_staff_id: userId,
      condition: condition.trim(),
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "✅ Visit logged", description: `${studentName} → workout auto-marked medical` });
    fetchData();
  };

  const openClearanceDialog = () => {
    if (!scannedStudentId) return;
    setVisitDialogOpen(false);
    setClearanceDialogOpen(true);
    setClearanceStatus("restricted");
    setRestrictionReason("");
    setValidUntil("");
  };

  const saveClearance = async () => {
    if (!scannedStudentId || !userId) return;
    setSaving(true);
    try {
      await (supabase as any).from("workout_clearances").delete().eq("student_id", scannedStudentId);
      if (clearanceStatus === "cleared") {
        toast({ title: "✅ Student Cleared", description: `${scannedStudentName} is cleared for workouts` });
      } else {
        const { error } = await (supabase as any).from("workout_clearances").insert({
          student_id: scannedStudentId,
          cleared_by: userId,
          status: "restricted",
          restriction_reason: restrictionReason.trim() || null,
          valid_until: validUntil || null,
        });
        if (error) throw error;
        toast({ title: "⚠️ Student Restricted", description: `${scannedStudentName} restricted from workouts` });
      }
      setClearanceDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleExcuseCoCurricular = async () => {
    if (!excuseStudentId || !excuseActivityId || !excuseDay || !excuseDate || !userId) return;
    setExcuseLoading(true);
    try {
      const allocation = excuseAllocations.find(a => a.activity_id === excuseActivityId && a.day_of_week === excuseDay);
      const slotNumber = allocation?.slot_number || 1;

      // Find or create session
      let sessionId: string;
      const { data: existingSession } = await supabase
        .from("attendance_sessions")
        .select("id")
        .eq("activity_id", excuseActivityId)
        .eq("session_date", excuseDate)
        .eq("day_of_week", excuseDay)
        .eq("slot_number", slotNumber)
        .maybeSingle();

      if (existingSession) {
        sessionId = existingSession.id;
      } else {
        const { data: activityData } = await supabase
          .from("activities")
          .select("teacher_id")
          .eq("id", excuseActivityId)
          .single();

        const { data: newSession, error: sessionError } = await supabase
          .from("attendance_sessions")
          .insert({
            activity_id: excuseActivityId,
            teacher_id: activityData?.teacher_id || userId,
            session_date: excuseDate,
            day_of_week: excuseDay,
            slot_number: slotNumber,
            status: SESSION_STATUS.DRAFT,
          })
          .select()
          .single();

        if (sessionError) throw new Error(`Failed to create session: ${sessionError.message}`);
        sessionId = newSession!.id;
      }

      // Upsert attendance record
      const { data: existingRecord } = await supabase
        .from("attendance_records")
        .select("id")
        .eq("session_id", sessionId)
        .eq("student_id", excuseStudentId)
        .maybeSingle();

      if (existingRecord) {
        await supabase.from("attendance_records").update({ status: ATTENDANCE_STATUS.EXCUSED, marked_by: userId }).eq("id", existingRecord.id);
      } else {
        await supabase.from("attendance_records").insert({ session_id: sessionId, student_id: excuseStudentId, status: ATTENDANCE_STATUS.EXCUSED, marked_by: userId });
      }

      // Notification
      await supabase.from("attendance_notifications").upsert({
        session_id: sessionId,
        student_id: excuseStudentId,
        activity_id: excuseActivityId,
        status: ATTENDANCE_STATUS.EXCUSED,
        notes: excuseReason || "Excused by medical staff",
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString(),
      }, { onConflict: "session_id,student_id,activity_id" });

      const studentName = allStudents.find(s => s.id === excuseStudentId)?.full_name || "Student";
      const activityName = excuseAllocations.find(a => a.activity_id === excuseActivityId)?.activity_title || "activity";
      toast({ title: "✅ Student Excused", description: `${studentName} excused from ${activityName} on ${format(new Date(excuseDate), "MMM d")}` });

      setExcuseStudentId("");
      setExcuseActivityId("");
      setExcuseDay("");
      setExcuseReason("");
      setExcuseAllocations([]);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setExcuseLoading(false);
    }
  };

  const handleExcuseWorkout = async () => {
    if (!excuseStudentId || !excuseDate || !userId) return;
    setExcuseLoading(true);
    try {
      const { data: existing } = await (supabase as any)
        .from("workout_attendance")
        .select("id")
        .eq("student_id", excuseStudentId)
        .eq("workout_date", excuseDate)
        .maybeSingle();

      if (existing) {
        await (supabase as any).from("workout_attendance").update({ status: "excused" }).eq("id", existing.id);
      } else {
        await (supabase as any).from("workout_attendance").insert({
          student_id: excuseStudentId,
          workout_date: excuseDate,
          status: "excused",
        });
      }

      const studentName = allStudents.find(s => s.id === excuseStudentId)?.full_name || "Student";
      toast({ title: "✅ Workout Excused", description: `${studentName} excused from workout on ${format(new Date(excuseDate), "MMM d")}` });

      setExcuseStudentId("");
      setExcuseReason("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setExcuseLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (scanning) {
    return (
      <div className="min-h-screen bg-transparent p-4">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scan Student
            </h2>
            <Button variant="outline" onClick={() => setScanning(false)}>Cancel</Button>
          </div>
          <Card>
            <CardContent className="p-4">
              <MealQRScanner onScan={handleScan} isActive={true} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const restrictedCount = activeClearances.filter(c => c.status === "restricted").length;

  const filteredStudents = allStudents.filter(s =>
    s.full_name.toLowerCase().includes(excuseSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(excuseSearch.toLowerCase())
  );

  const studentActivities = excuseAllocations.reduce((acc, alloc) => {
    if (!acc.find(a => a.activity_id === alloc.activity_id)) {
      acc.push({ activity_id: alloc.activity_id, activity_title: alloc.activity_title });
    }
    return acc;
  }, [] as { activity_id: string; activity_title: string }[]);

  const availableDays = excuseAllocations
    .filter(a => a.activity_id === excuseActivityId)
    .map(a => a.day_of_week);

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header */}
      <header className="border-b bg-gradient-to-r from-rose-500/5 via-background to-rose-500/5">
        <div className="container mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center">
              <Stethoscope className="h-6 w-6 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Medical Dashboard</h1>
              <p className="text-sm text-muted-foreground">Student health & clearances</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HouseBadge />
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <ClipboardList className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{todayVisits.length}</p>
              <p className="text-sm text-muted-foreground">Visits Today</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
              <p className="text-2xl font-bold">{restrictedCount}</p>
              <p className="text-sm text-muted-foreground">Restricted</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-2xl font-bold">{todayWorkoutCount}</p>
              <p className="text-sm text-muted-foreground">At Workouts</p>
            </CardContent>
          </Card>
        </div>

        {/* Scan Button */}
        <Button size="lg" className="w-full" onClick={() => setScanning(true)}>
          <QrCode className="h-5 w-5 mr-2" />
          Scan Student QR Code
        </Button>

        {/* Attendance Overview */}
        <AttendanceChart title="Workout Attendance (Last 7 Days)" />

        <Tabs defaultValue="visits" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="visits"><ClipboardList className="h-4 w-4 mr-2" /> Visits</TabsTrigger>
            <TabsTrigger value="absent">
              <AlertTriangle className="h-4 w-4 mr-2" /> Absent
              {absentToday.length > 0 && <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1 text-[10px]">{absentToday.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="clearances"><ShieldCheck className="h-4 w-4 mr-2" /> Clearances</TabsTrigger>
            <TabsTrigger value="excuse"><UserCheck className="h-4 w-4 mr-2" /> Excuse</TabsTrigger>
          </TabsList>

          {/* VISITS TAB */}
          <TabsContent value="visits">
            <Card>
              <CardHeader>
                <CardTitle>Today's Visits</CardTitle>
                <CardDescription>{todayVisits.length} students seen today</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead>Treatment</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {todayVisits.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium">{v.student_name}</TableCell>
                          <TableCell>{v.condition}</TableCell>
                          <TableCell>{v.treatment || "—"}</TableCell>
                          <TableCell>{new Date(v.scanned_at).toLocaleTimeString()}</TableCell>
                        </TableRow>
                      ))}
                      {todayVisits.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">No visits today</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CLEARANCES TAB */}
          <TabsContent value="clearances">
            <Card>
              <CardHeader>
                <CardTitle>Workout Clearances</CardTitle>
                <CardDescription>Students currently restricted from workouts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Until</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeClearances.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.student_name}</TableCell>
                          <TableCell>
                            <Badge variant={c.status === "restricted" ? "destructive" : "default"}>
                              {c.status === "restricted" ? "Restricted" : "Cleared"}
                            </Badge>
                          </TableCell>
                          <TableCell>{c.restriction_reason || "—"}</TableCell>
                          <TableCell>{c.valid_until || "Indefinite"}</TableCell>
                        </TableRow>
                      ))}
                      {activeClearances.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">No active restrictions</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* EXCUSE TAB */}
          <TabsContent value="excuse">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-primary" />
                  Excuse a Student
                </CardTitle>
                <CardDescription>Excuse from a co-curricular activity or morning workout</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Type selector */}
                <div className="space-y-2">
                  <Label>Excuse Type</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={excuseType === "cocurricular" ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setExcuseType("cocurricular"); setExcuseActivityId(""); setExcuseDay(""); setExcuseAllocations([]); }}
                    >
                      Co-curricular Activity
                    </Button>
                    <Button
                      variant={excuseType === "workout" ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setExcuseType("workout"); setExcuseActivityId(""); setExcuseDay(""); setExcuseAllocations([]); }}
                    >
                      Morning Workout
                    </Button>
                  </div>
                </div>

                {/* Student search */}
                <div className="space-y-2">
                  <Label>Search Student</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or email..."
                      value={excuseSearch}
                      onChange={(e) => setExcuseSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Student select */}
                <div className="space-y-2">
                  <Label>Select Student *</Label>
                  <Select value={excuseStudentId} onValueChange={setExcuseStudentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredStudents.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.full_name} ({s.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Co-curricular: show student's allocations */}
                {excuseType === "cocurricular" && excuseStudentId && (
                  <>
                    {excuseLoadingAllocs && (
                      <div className="flex gap-2 flex-wrap">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-6 w-28" />
                        <Skeleton className="h-6 w-36" />
                      </div>
                    )}

                    {!excuseLoadingAllocs && excuseAllocations.length > 0 && (
                      <div className="space-y-2">
                        <Label>Student's Activities (tap to select)</Label>
                        <div className="flex flex-wrap gap-2">
                          {excuseAllocations.map((alloc, idx) => (
                            <Badge
                              key={idx}
                              variant={excuseActivityId === alloc.activity_id && excuseDay === alloc.day_of_week ? "default" : "outline"}
                              className="cursor-pointer hover:bg-muted transition-colors"
                              onClick={() => { setExcuseActivityId(alloc.activity_id); setExcuseDay(alloc.day_of_week); }}
                            >
                              {alloc.activity_title} — {alloc.day_of_week}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {!excuseLoadingAllocs && excuseAllocations.length === 0 && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>This student has no activity allocations.</AlertDescription>
                      </Alert>
                    )}

                    {/* Activity + Day dropdowns */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Activity *</Label>
                        <Select
                          value={excuseActivityId}
                          onValueChange={(v) => { setExcuseActivityId(v); setExcuseDay(""); }}
                          disabled={!excuseStudentId || excuseAllocations.length === 0}
                        >
                          <SelectTrigger><SelectValue placeholder="Select activity" /></SelectTrigger>
                          <SelectContent>
                            {studentActivities.map(a => (
                              <SelectItem key={a.activity_id} value={a.activity_id}>{a.activity_title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Day *</Label>
                        <Select
                          value={excuseDay}
                          onValueChange={setExcuseDay}
                          disabled={!excuseActivityId || availableDays.length === 0}
                        >
                          <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
                          <SelectContent>
                            {availableDays.map(day => (
                              <SelectItem key={day} value={day}>{day}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                )}

                {/* Date */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Excuse Date *
                  </Label>
                  <Input
                    type="date"
                    value={excuseDate}
                    onChange={(e) => setExcuseDate(e.target.value)}
                  />
                </div>

                {/* Reason */}
                <div className="space-y-2">
                  <Label>Reason (Optional)</Label>
                  <Textarea
                    placeholder="e.g., Fever, ankle injury, medical appointment..."
                    value={excuseReason}
                    onChange={(e) => setExcuseReason(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Quick reason chips */}
                <div className="flex flex-wrap gap-2">
                  {["Medical appointment", "Injury", "Illness", "Post-surgery recovery"].map(chip => (
                    <Badge
                      key={chip}
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => setExcuseReason(chip)}
                    >
                      {chip}
                    </Badge>
                  ))}
                </div>

                {/* Submit */}
                <Button
                  className="w-full"
                  disabled={
                    excuseLoading ||
                    !excuseStudentId ||
                    !excuseDate ||
                    (excuseType === "cocurricular" && (!excuseActivityId || !excuseDay))
                  }
                  onClick={excuseType === "cocurricular" ? handleExcuseCoCurricular : handleExcuseWorkout}
                >
                  {excuseLoading ? "Processing..." : `Excuse from ${excuseType === "cocurricular" ? "Activity" : "Workout"}`}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Visit Dialog */}
      <Dialog open={visitDialogOpen} onOpenChange={setVisitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Medical Visit</DialogTitle>
            <DialogDescription>Recording visit for {scannedStudentName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Condition *</label>
              <Input
                placeholder="e.g., Headache, Sprain, Fever..."
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Treatment</label>
              <Input
                placeholder="e.g., Rest, Ice pack, Paracetamol..."
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                placeholder="Additional notes..."
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={openClearanceDialog}>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Set Workout Clearance
            </Button>
            <Button onClick={saveVisit} disabled={saving || !condition.trim()}>
              {saving ? "Saving..." : "Save Visit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clearance Dialog */}
      <Dialog open={clearanceDialogOpen} onOpenChange={setClearanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workout Clearance</DialogTitle>
            <DialogDescription>Set workout status for {scannedStudentName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={clearanceStatus} onValueChange={(v) => setClearanceStatus(v as "cleared" | "restricted")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restricted">🚫 Restricted</SelectItem>
                  <SelectItem value="cleared">✅ Cleared</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {clearanceStatus === "restricted" && (
              <>
                <div>
                  <label className="text-sm font-medium">Reason</label>
                  <Input
                    placeholder="e.g., Ankle injury, recovering from illness..."
                    value={restrictionReason}
                    onChange={(e) => setRestrictionReason(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Restricted Until</label>
                  <Input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={saveClearance} disabled={saving}>
              {saving ? "Saving..." : "Save Clearance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MedicalDashboard;
