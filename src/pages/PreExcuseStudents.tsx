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
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, UserCheck, Calendar, Search, AlertCircle } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  student_name: string;
  activity_title: string;
}

const PreExcuseStudents = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  // Issue #50: Add loading state to prevent duplicate submissions
  const [loading, setLoading] = useState(false);
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
    try {
      const { data } = await supabase
        .from("allocations")
        .select(`
          student_id,
          activity_id,
          day_of_week,
          activities (title),
          profiles:student_id (full_name)
        `)
        .eq("student_id", studentId);

      const formattedAllocations: Allocation[] = (data || []).map((item: Record<string, unknown>) => ({
        student_id: item.student_id as string,
        activity_id: item.activity_id as string,
        day_of_week: item.day_of_week as string,
        student_name: (item.profiles as { full_name?: string })?.full_name || "Unknown",
        activity_title: (item.activities as { title?: string })?.title || "Unknown",
      }));

      setAllocations(formattedAllocations);
    } catch (error) {
      console.error("Error fetching allocations:", error);
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

      const { data: existingSession } = await supabase
        .from("attendance_sessions")
        .select("id")
        .eq("activity_id", selectedActivity)
        .eq("session_date", excuseDate)
        .eq("day_of_week", selectedDay)
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
            slot_number: 1,
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

  return (
    <div className="min-h-screen bg-background">
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
        <Card className="shadow-card">
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
            {selectedStudent && allocations.length > 0 && (
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

            {selectedStudent && allocations.length === 0 && (
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
        </Card>
      </main>
    </div>
  );
};

export default PreExcuseStudents;
