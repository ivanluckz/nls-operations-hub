import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, UserCheck, Calendar, Search, AlertCircle, Users } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { SESSION_STATUS, ATTENDANCE_STATUS, USER_ROLES, QUERY_LIMITS, DATE_RANGE_LIMITS } from "@/lib/constants";

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
  student_name: string;
  activity_title: string;
}

const BULK_REASON_CHIPS = ["Field trip", "School event", "Medical", "Sports competition", "Family emergency"];

const PreExcuseStudents = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<"single" | "bulk">("single");

  // Single mode state
  // Issue #50: Add loading state to prevent duplicate submissions
  const [loading, setLoading] = useState(false);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [selectedActivity, setSelectedActivity] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [excuseDate, setExcuseDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [reason, setReason] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [userRole, setUserRole] = useState<string>(USER_ROLES.ADMIN);
  const [dateError, setDateError] = useState<string | null>(null);

  // Bulk mode state
  const [bulkDate, setBulkDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [bulkSearch, setBulkSearch] = useState<string>("");
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkReason, setBulkReason] = useState<string>("");
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      fetchStudentAllocations(selectedStudent);
      // Reset activity and day when student changes
      setSelectedActivity("");
      setSelectedDay("");
    } else {
      setAllocations([]);
    }
  }, [selectedStudent]);

  // Auto-select day when activity changes based on allocations
  useEffect(() => {
    if (selectedActivity && allocations.length > 0) {
      const activityAllocations = allocations.filter(a => a.activity_id === selectedActivity);
      if (activityAllocations.length === 1) {
        setSelectedDay(activityAllocations[0].day_of_week);
      } else if (!activityAllocations.find(a => a.day_of_week === selectedDay)) {
        setSelectedDay("");
      }
    }
  }, [selectedActivity, allocations]);

  // Issue #20: Validate date range
  useEffect(() => {
    if (excuseDate) {
      const selectedDate = parseISO(excuseDate);
      const today = new Date();
      const daysDiff = differenceInDays(selectedDate, today);
      
      if (daysDiff < -DATE_RANGE_LIMITS.MAX_DAYS_PAST) {
        setDateError(`Date cannot be more than ${DATE_RANGE_LIMITS.MAX_DAYS_PAST} days in the past`);
      } else if (daysDiff > DATE_RANGE_LIMITS.MAX_DAYS_FUTURE) {
        setDateError(`Date cannot be more than ${DATE_RANGE_LIMITS.MAX_DAYS_FUTURE} days in the future`);
      } else {
        setDateError(null);
      }
    }
  }, [excuseDate]);

  const fetchInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (roleData) {
        setUserRole(roleData.role);
      }

      // Fetch all student role user_ids first with limit
      const { data: studentRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", USER_ROLES.STUDENT)
        .limit(QUERY_LIMITS.STUDENTS);

      const studentUserIds = (studentRoles || []).map(r => r.user_id);

      // Fetch profiles for those users
      let studentsData: Student[] = [];
      if (studentUserIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", studentUserIds)
          .order("full_name")
          .limit(QUERY_LIMITS.STUDENTS);
        studentsData = data || [];
      }

      setStudents(studentsData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load initial data",
      });
    }
  };

  const fetchStudentAllocations = async (studentId: string) => {
    setLoadingAllocations(true);
    try {
      const { data } = await supabase
        .from("allocations")
        .select(`
          student_id,
          activity_id,
          day_of_week,
          slot_number,
          activities (title)
        `)
        .eq("student_id", studentId);

      // Get student name from our already-loaded students list
      const student = students.find(s => s.id === studentId);
      const studentName = student?.full_name || "Unknown";

      const formattedAllocations: Allocation[] = (data || []).map((item: Record<string, unknown>) => ({
        student_id: item.student_id as string,
        activity_id: item.activity_id as string,
        day_of_week: item.day_of_week as string,
        slot_number: (item.slot_number as number) || 1,
        student_name: studentName,
        activity_title: (item.activities as { title?: string })?.title || "Unknown",
      }));

      setAllocations(formattedAllocations);
    } catch (error) {
      console.error("Error fetching allocations:", error);
    } finally {
      setLoadingAllocations(false);
    }
  };

  const handlePreExcuse = async () => {
    if (!selectedStudent || !selectedActivity || !selectedDay || !excuseDate) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in all required fields",
      });
      return;
    }

    // Issue #20: Prevent submission if date is out of range
    if (dateError) {
      toast({
        variant: "destructive",
        title: "Invalid Date",
        description: dateError,
      });
      return;
    }

    // Issue #50: Prevent duplicate submissions
    if (loading) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // First, check if a session exists for this date/activity/day or create one
      let sessionId: string;
      const allocation = allocations.find(a => a.activity_id === selectedActivity && a.day_of_week === selectedDay);
      const slotNumber = allocation?.slot_number || 1;

      const { data: existingSession } = await supabase
        .from("attendance_sessions")
        .select("id")
        .eq("activity_id", selectedActivity)
        .eq("session_date", excuseDate)
        .eq("day_of_week", selectedDay)
        .eq("slot_number", slotNumber)
        .maybeSingle();

      if (existingSession) {
        sessionId = existingSession.id;
      } else {
        // Get activity's teacher_id
        const { data: activityData } = await supabase
          .from("activities")
          .select("teacher_id")
          .eq("id", selectedActivity)
          .single();

        // Issue #7: Create a new session with explicit error handling
        const { data: newSession, error: sessionError } = await supabase
          .from("attendance_sessions")
          .insert({
            activity_id: selectedActivity,
            teacher_id: activityData?.teacher_id || user.id,
            session_date: excuseDate,
            day_of_week: selectedDay,
            slot_number: slotNumber,
            status: SESSION_STATUS.DRAFT
          })
          .select()
          .single();

        if (sessionError) {
          console.error("Session creation error:", sessionError);
          throw new Error(`Failed to create attendance session: ${sessionError.message}`);
        }
        
        if (!newSession) {
          throw new Error("Session was not created - no data returned");
        }
        
        sessionId = newSession.id;
      }

      // Check if a record already exists for this student in this session
      const { data: existingRecord } = await supabase
        .from("attendance_records")
        .select("id")
        .eq("session_id", sessionId)
        .eq("student_id", selectedStudent)
        .maybeSingle();

      if (existingRecord) {
        // Update existing record
        const { error: updateError } = await supabase
          .from("attendance_records")
          .update({
            status: ATTENDANCE_STATUS.EXCUSED,
            marked_by: user.id
          })
          .eq("id", existingRecord.id);

        if (updateError) throw updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from("attendance_records")
          .insert({
            session_id: sessionId,
            student_id: selectedStudent,
            status: ATTENDANCE_STATUS.EXCUSED,
            marked_by: user.id
          });

        if (insertError) throw insertError;
      }

      // Create/update notification
      const { error: notifError } = await supabase
        .from("attendance_notifications")
        .upsert({
          session_id: sessionId,
          student_id: selectedStudent,
          activity_id: selectedActivity,
          status: ATTENDANCE_STATUS.EXCUSED,
          notes: reason || "Pre-excused by admin/moderator",
          acknowledged_by: user.id,
          acknowledged_at: new Date().toISOString()
        }, {
          onConflict: "session_id,student_id,activity_id"
        });

      if (notifError) {
        console.error("Notification error:", notifError);
        // Don't fail the whole operation if notification fails
      }

      toast({
        title: "Student Excused",
        description: `Successfully pre-excused student for ${format(new Date(excuseDate), "MMM d, yyyy")}`,
      });

      // Reset form
      setSelectedStudent("");
      setSelectedActivity("");
      setSelectedDay("");
      setReason("");
      setAllocations([]);
    } catch (error) {
      console.error("Error pre-excusing student:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to pre-excuse student",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkExcuse = async () => {
    if (bulkSelected.size === 0 || !bulkDate) return;
    setBulkLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const dayOfWeek = format(parseISO(bulkDate), "EEEE"); // e.g. "Monday"
      let totalRecords = 0;
      let studentsExcused = 0;

      for (const studentId of bulkSelected) {
        // Get student's allocations for that day of week
        const { data: allocs } = await supabase
          .from("allocations")
          .select("activity_id, day_of_week, slot_number")
          .eq("student_id", studentId)
          .eq("day_of_week", dayOfWeek);

        if (!allocs || allocs.length === 0) continue;

        for (const alloc of allocs) {
          // Find or create session
          let sessionId: string;
          const { data: existing } = await supabase
            .from("attendance_sessions")
            .select("id")
            .eq("activity_id", alloc.activity_id)
            .eq("session_date", bulkDate)
            .eq("day_of_week", dayOfWeek)
            .eq("slot_number", alloc.slot_number)
            .maybeSingle();

          if (existing) {
            sessionId = existing.id;
          } else {
            const { data: actData } = await supabase
              .from("activities")
              .select("teacher_id")
              .eq("id", alloc.activity_id)
              .single();

            const { data: newSess, error: sessErr } = await supabase
              .from("attendance_sessions")
              .insert({
                activity_id: alloc.activity_id,
                teacher_id: actData?.teacher_id || user.id,
                session_date: bulkDate,
                day_of_week: dayOfWeek,
                slot_number: alloc.slot_number,
                status: SESSION_STATUS.DRAFT,
              })
              .select()
              .single();
            if (sessErr) throw sessErr;
            sessionId = newSess!.id;
          }

          // Upsert attendance record as excused
          const { data: existRec } = await supabase
            .from("attendance_records")
            .select("id")
            .eq("session_id", sessionId)
            .eq("student_id", studentId)
            .maybeSingle();

          if (existRec) {
            await supabase.from("attendance_records")
              .update({ status: ATTENDANCE_STATUS.EXCUSED, marked_by: user.id })
              .eq("id", existRec.id);
          } else {
            await supabase.from("attendance_records")
              .insert({ session_id: sessionId, student_id: studentId, status: ATTENDANCE_STATUS.EXCUSED, marked_by: user.id });
          }

          // Notification
          await supabase.from("attendance_notifications").upsert({
            session_id: sessionId,
            student_id: studentId,
            activity_id: alloc.activity_id,
            status: ATTENDANCE_STATUS.EXCUSED,
            notes: bulkReason || "Bulk pre-excuse",
            acknowledged_by: user.id,
            acknowledged_at: new Date().toISOString(),
          }, { onConflict: "session_id,student_id,activity_id" });

          totalRecords++;
        }

        studentsExcused++;
      }

      toast({
        title: "Bulk Excuse Complete",
        description: `${studentsExcused} student${studentsExcused !== 1 ? "s" : ""} excused from ${dayOfWeek} activities (${totalRecords} record${totalRecords !== 1 ? "s" : ""} created)`,
      });
      setBulkSelected(new Set());
      setBulkReason("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setBulkLoading(false);
    }
  };

  const filteredStudents = students.filter(s =>
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get unique activities from allocations
  const studentActivities = allocations.reduce((acc, alloc) => {
    if (!acc.find(a => a.activity_id === alloc.activity_id)) {
      acc.push({ activity_id: alloc.activity_id, activity_title: alloc.activity_title });
    }
    return acc;
  }, [] as { activity_id: string; activity_title: string }[]);

  // Get available days for selected activity from allocations
  const availableDays = allocations
    .filter(a => a.activity_id === selectedActivity)
    .map(a => a.day_of_week);

  const bulkFilteredStudents = students.filter(s =>
    s.full_name.toLowerCase().includes(bulkSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(bulkSearch.toLowerCase())
  );

  const bulkDayLabel = bulkDate ? format(parseISO(bulkDate), "EEEE, MMM d") : "";

  const toggleBulkStudent = (id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllBulk = () => {
    if (bulkSelected.size === bulkFilteredStudents.length) {
      setBulkSelected(new Set());
    } else {
      setBulkSelected(new Set(bulkFilteredStudents.map(s => s.id)));
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <header className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/${userRole}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Pre-Excuse Students</h1>
            <p className="text-sm text-muted-foreground">Excuse students before attendance is taken</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Mode toggle */}
        <div className="flex gap-2">
          <Button
            variant={mode === "single" ? "default" : "outline"}
            onClick={() => setMode("single")}
            className="flex items-center gap-2"
          >
            <UserCheck className="w-4 h-4" />
            Single Student
          </Button>
          <Button
            variant={mode === "bulk" ? "default" : "outline"}
            onClick={() => setMode("bulk")}
            className="flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            Bulk Excuse
          </Button>
        </div>

        {/* ── BULK MODE ── */}
        {mode === "bulk" && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Bulk Pre-Excuse
              </CardTitle>
              <CardDescription>
                Excuse multiple students from all their activities on a given day
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Date */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Excuse Date *
                </Label>
                <Input
                  type="date"
                  value={bulkDate}
                  onChange={(e) => { setBulkDate(e.target.value); setBulkSelected(new Set()); }}
                />
                {bulkDayLabel && (
                  <p className="text-sm text-muted-foreground">
                    Students will be excused from all their <strong>{format(parseISO(bulkDate), "EEEE")}</strong> activities on {bulkDayLabel}
                  </p>
                )}
              </div>

              {/* Student search */}
              <div className="space-y-2">
                <Label>Select Students *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={bulkSearch}
                    onChange={(e) => setBulkSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Select all row */}
                <div className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={selectAllBulk}
                  >
                    {bulkSelected.size === bulkFilteredStudents.length && bulkFilteredStudents.length > 0
                      ? "Deselect all"
                      : `Select all${bulkSearch ? " matching" : ""} (${bulkFilteredStudents.length})`}
                  </button>
                  {bulkSelected.size > 0 && (
                    <Badge variant="default">{bulkSelected.size} selected</Badge>
                  )}
                </div>

                {/* Student list */}
                <div className="border rounded-lg max-h-64 overflow-y-auto divide-y">
                  {bulkFilteredStudents.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-4">No students found</p>
                  )}
                  {bulkFilteredStudents.map(s => (
                    <label
                      key={s.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={bulkSelected.has(s.id)}
                        onCheckedChange={() => toggleBulkStudent(s.id)}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label>Reason (Optional)</Label>
                <Textarea
                  placeholder="Enter reason for excusing these students..."
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  rows={2}
                />
                <div className="flex flex-wrap gap-2">
                  {BULK_REASON_CHIPS.map(chip => (
                    <Badge
                      key={chip}
                      variant={bulkReason === chip ? "default" : "outline"}
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => setBulkReason(bulkReason === chip ? "" : chip)}
                    >
                      {chip}
                    </Badge>
                  ))}
                </div>
              </div>

              <Button
                className="w-full"
                disabled={bulkLoading || bulkSelected.size === 0 || !bulkDate}
                onClick={handleBulkExcuse}
              >
                {bulkLoading
                  ? "Processing..."
                  : `Excuse ${bulkSelected.size > 0 ? bulkSelected.size : ""} Student${bulkSelected.size !== 1 ? "s" : ""} from ${bulkDate ? format(parseISO(bulkDate), "EEEE") : ""} Activities`}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── SINGLE MODE ── */}
        {mode === "single" && <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary" />
              Pre-Excuse a Student
            </CardTitle>
            <CardDescription>
              Excuse a student for a past, present, or future date (within {DATE_RANGE_LIMITS.MAX_DAYS_PAST} days past or {DATE_RANGE_LIMITS.MAX_DAYS_FUTURE} days future)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Student Search */}
            <div className="space-y-2">
              <Label>Search Student</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Student Selection */}
            <div className="space-y-2">
              <Label>Select Student *</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a student" />
                </SelectTrigger>
                <SelectContent>
                  {filteredStudents.map(student => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.full_name} ({student.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Student's Allocations */}
            {selectedStudent && loadingAllocations && (
              <div className="space-y-2">
                <Label>Loading Allocations...</Label>
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-6 w-28" />
                  <Skeleton className="h-6 w-36" />
                </div>
              </div>
            )}

            {selectedStudent && !loadingAllocations && allocations.length > 0 && (
              <div className="space-y-2">
                <Label>Quick Select (Student's Allocations)</Label>
                <div className="flex flex-wrap gap-2">
                  {allocations.map((alloc, idx) => (
                    <Badge 
                      key={idx} 
                      variant={selectedActivity === alloc.activity_id && selectedDay === alloc.day_of_week ? "default" : "outline"}
                      className="cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => {
                        setSelectedActivity(alloc.activity_id);
                        setSelectedDay(alloc.day_of_week);
                      }}
                    >
                      {alloc.activity_title} - {alloc.day_of_week}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {selectedStudent && !loadingAllocations && allocations.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This student has no activity allocations. They must be allocated to activities first.
                </AlertDescription>
              </Alert>
            )}

            {/* Activity Selection */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Activity *</Label>
                <Select 
                  value={selectedActivity} 
                  onValueChange={(value) => {
                    setSelectedActivity(value);
                    setSelectedDay("");
                  }}
                  disabled={!selectedStudent || allocations.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select activity" />
                  </SelectTrigger>
                <SelectContent>
                  {loadingAllocations && (
                    <div className="p-2">
                      <Skeleton className="h-4 w-full" />
                    </div>
                  )}
                    {studentActivities.map(activity => (
                      <SelectItem key={activity.activity_id} value={activity.activity_id}>
                        {activity.activity_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Day *</Label>
                <Select 
                  value={selectedDay} 
                  onValueChange={setSelectedDay} 
                  disabled={!selectedActivity || availableDays.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDays.map(day => (
                      <SelectItem key={day} value={day}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Excuse Date *
              </Label>
              <Input
                type="date"
                value={excuseDate}
                onChange={(e) => setExcuseDate(e.target.value)}
              />
              {dateError ? (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{dateError}</AlertDescription>
                </Alert>
              ) : (
                <p className="text-xs text-muted-foreground">
                  You can select dates within {DATE_RANGE_LIMITS.MAX_DAYS_PAST} days past or {DATE_RANGE_LIMITS.MAX_DAYS_FUTURE} days future
                </p>
              )}
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Textarea
                placeholder="Enter reason for excusing the student..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            {/* Submit Button */}
            <Button 
              onClick={handlePreExcuse} 
              disabled={loading || !selectedStudent || !selectedActivity || !selectedDay || !excuseDate || !!dateError}
              className="w-full"
            >
              {loading ? "Processing..." : "Pre-Excuse Student"}
            </Button>
          </CardContent>
        </Card>}
      </main>
    </div>
  );
};

export default PreExcuseStudents;
