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
import { ArrowLeft, UserCheck, Calendar, Search } from "lucide-react";
import { format } from "date-fns";

interface Student {
  id: string;
  full_name: string;
  email: string;
}

interface Activity {
  id: string;
  title: string;
  days_of_week: string[];
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
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [selectedActivity, setSelectedActivity] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [excuseDate, setExcuseDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [reason, setReason] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("admin");

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      fetchStudentAllocations(selectedStudent);
    }
  }, [selectedStudent]);

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

      // Fetch all student role user_ids first
      const { data: studentRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");

      const studentUserIds = (studentRoles || []).map(r => r.user_id);

      // Fetch profiles for those users
      let studentsData: Student[] = [];
      if (studentUserIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", studentUserIds)
          .order("full_name");
        studentsData = data || [];
      }

      setStudents(studentsData);

      // Fetch all activities
      const { data: activitiesData } = await supabase
        .from("activities")
        .select("id, title, days_of_week")
        .eq("is_active", true)
        .order("title");

      setActivities(activitiesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
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

      const formattedAllocations: Allocation[] = (data || []).map((item: any) => ({
        student_id: item.student_id,
        activity_id: item.activity_id,
        day_of_week: item.day_of_week,
        student_name: item.profiles?.full_name || "Unknown",
        activity_title: item.activities?.title || "Unknown",
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

        // Create a new session
        const { data: newSession, error: sessionError } = await supabase
          .from("attendance_sessions")
          .insert({
            activity_id: selectedActivity,
            teacher_id: activityData?.teacher_id || user.id,
            session_date: excuseDate,
            day_of_week: selectedDay,
            slot_number: 1,
            status: "draft"
          })
          .select()
          .single();

        if (sessionError) throw sessionError;
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
            status: "excused",
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
            status: "excused",
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
          status: "excused",
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
    } catch (error: any) {
      console.error("Error pre-excusing student:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to pre-excuse student",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedActivityData = activities.find(a => a.id === selectedActivity);

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
              Excuse a student for a past, present, or future date
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
                <Label>Student's Activities</Label>
                <div className="flex flex-wrap gap-2">
                  {allocations.map((alloc, idx) => (
                    <Badge 
                      key={idx} 
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
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

            {/* Activity Selection */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Activity *</Label>
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

              <div className="space-y-2">
                <Label>Day *</Label>
                <Select value={selectedDay} onValueChange={setSelectedDay} disabled={!selectedActivity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedActivityData?.days_of_week.map(day => (
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
              <p className="text-xs text-muted-foreground">
                You can select past, present, or future dates
              </p>
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
              disabled={loading || !selectedStudent || !selectedActivity || !selectedDay || !excuseDate}
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