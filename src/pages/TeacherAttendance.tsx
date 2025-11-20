import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Camera, Save, Upload, AlertCircle } from "lucide-react";
import { BrowserQRCodeReader } from "@zxing/library";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Activity {
  id: string;
  title: string;
  days_of_week: string[];
}

interface Student {
  student_id: string;
  student_name: string;
  student_email: string;
}

interface AttendanceRecord {
  student_id: string;
  status: "present" | "late" | "absent";
  scanned_at?: string;
}

const TeacherAttendance = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Map<string, AttendanceRecord>>(new Map());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const codeReader = useRef<BrowserQRCodeReader | null>(null);

  useEffect(() => {
    fetchActivities();
    codeReader.current = new BrowserQRCodeReader();
    
    return () => {
      stopScanning();
    };
  }, []);

  useEffect(() => {
    if (selectedActivity && selectedDay) {
      fetchStudents();
      createOrLoadSession();
    }
  }, [selectedActivity, selectedDay]);

  const fetchActivities = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("activities")
        .select("id, title, days_of_week")
        .eq("teacher_id", user.id)
        .order("title");

      setActivities(data || []);
    } catch (error) {
      console.error("Error fetching activities:", error);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data } = await supabase
        .from("allocations")
        .select(`
          student_id,
          profiles!allocations_student_id_fkey (
            full_name,
            email
          )
        `)
        .eq("activity_id", selectedActivity)
        .eq("day_of_week", selectedDay);

      const studentList: Student[] = (data || []).map((item: any) => ({
        student_id: item.student_id,
        student_name: item.profiles.full_name,
        student_email: item.profiles.email,
      }));

      setStudents(studentList);
      
      // Initialize all as absent
      const newAttendance = new Map<string, AttendanceRecord>();
      studentList.forEach(student => {
        newAttendance.set(student.student_id, {
          student_id: student.student_id,
          status: "absent"
        });
      });
      setAttendance(newAttendance);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  };

  const createOrLoadSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      
      // Check if session exists
      const { data: existingSession } = await supabase
        .from("attendance_sessions")
        .select("id, status")
        .eq("activity_id", selectedActivity)
        .eq("teacher_id", user.id)
        .eq("session_date", today)
        .eq("day_of_week", selectedDay)
        .eq("status", "draft")
        .maybeSingle();

      if (existingSession) {
        setSessionId(existingSession.id);
        await loadExistingAttendance(existingSession.id);
      } else {
        // Create new session
        const { data: newSession, error } = await supabase
          .from("attendance_sessions")
          .insert({
            activity_id: selectedActivity,
            teacher_id: user.id,
            session_date: today,
            day_of_week: selectedDay,
            slot_number: 1,
            status: "draft"
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
  };

  const loadExistingAttendance = async (sessionId: string) => {
    try {
      const { data } = await supabase
        .from("attendance_records")
        .select("student_id, status")
        .eq("session_id", sessionId);

      if (data && data.length > 0) {
        const newAttendance = new Map(attendance);
        data.forEach(record => {
          newAttendance.set(record.student_id, {
            student_id: record.student_id,
            status: record.status as "present" | "late" | "absent"
          });
        });
        setAttendance(newAttendance);
      }
    } catch (error) {
      console.error("Error loading attendance:", error);
    }
  };

  const startScanning = async () => {
    try {
      setScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        scanQRCode();
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        variant: "destructive",
        title: "Camera Error",
        description: "Unable to access camera",
      });
      setScanning(false);
    }
  };

  const scanQRCode = async () => {
    if (!codeReader.current || !videoRef.current) return;

    try {
      const result = await codeReader.current.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (result) {
            try {
              const data = JSON.parse(result.getText());
              if (data.studentId) {
                markAttendance(data.studentId, "present", new Date().toISOString());
                stopScanning();
              }
            } catch (e) {
              console.error("Invalid QR code:", e);
            }
          }
        }
      );
    } catch (error) {
      console.error("Error scanning QR code:", error);
    }
  };

  const stopScanning = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (codeReader.current) {
      codeReader.current.reset();
    }
    setScanning(false);
  };

  const markAttendance = (studentId: string, status: "present" | "late" | "absent", scannedAt?: string) => {
    const newAttendance = new Map(attendance);
    newAttendance.set(studentId, { student_id: studentId, status, scanned_at: scannedAt });
    setAttendance(newAttendance);

    const student = students.find(s => s.student_id === studentId);
    if (student) {
      toast({
        title: "Marked",
        description: `${student.student_name} marked as ${status}${scannedAt ? ' at ' + new Date(scannedAt).toLocaleTimeString() : ''}`,
      });
    }
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

      // Delete existing records for this session
      await supabase
        .from("attendance_records")
        .delete()
        .eq("session_id", sessionId);

      // Insert new records
      const { error } = await supabase
        .from("attendance_records")
        .insert(records);

      if (error) throw error;

      toast({
        title: "Draft Saved",
        description: "Attendance saved as draft",
      });
    } catch (error) {
      console.error("Error saving draft:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save draft",
      });
    } finally {
      setLoading(false);
    }
  };

  const finalizeAttendance = async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      // Save records first
      await saveDraft();

      // Update session status
      const { error } = await supabase
        .from("attendance_sessions")
        .update({ 
          status: "finalized",
          finalized_at: new Date().toISOString()
        })
        .eq("id", sessionId);

      if (error) throw error;

      // Notify about absences (would typically trigger notifications to mods/admins)
      const absentStudents = Array.from(attendance.values())
        .filter(r => r.status === "absent");

      toast({
        title: "Attendance Finalized",
        description: `Finalized with ${absentStudents.length} absent student(s)`,
      });

      navigate("/teacher");
    } catch (error) {
      console.error("Error finalizing attendance:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to finalize attendance",
      });
    } finally {
      setLoading(false);
    }
  };

  const absentCount = Array.from(attendance.values()).filter(r => r.status === "absent").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/teacher")}>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    {activities
                      .find(a => a.id === selectedActivity)
                      ?.days_of_week.map(day => (
                        <SelectItem key={day} value={day}>
                          {day}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedActivity && selectedDay && students.length > 0 && (
          <>
            {absentCount > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {absentCount} student(s) marked as absent. Review before finalizing.
                </AlertDescription>
              </Alert>
            )}

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>QR Code Scanner</CardTitle>
              </CardHeader>
              <CardContent>
                {!scanning ? (
                  <Button onClick={startScanning} className="w-full">
                    <Camera className="w-4 h-4 mr-2" />
                    Start Scanning
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full rounded-lg bg-black"
                    />
                    <Button onClick={stopScanning} variant="outline" className="w-full">
                      Stop Scanning
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

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
                            checked={record?.status === "present"}
                            onCheckedChange={(checked) => 
                              markAttendance(student.student_id, checked ? "present" : "absent")
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
                        <div className="flex gap-2">
                          <Badge
                            variant={record?.status === "present" ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => markAttendance(student.student_id, "present")}
                          >
                            Present
                          </Badge>
                          <Badge
                            variant={record?.status === "late" ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => markAttendance(student.student_id, "late")}
                          >
                            Late
                          </Badge>
                          <Badge
                            variant={record?.status === "absent" ? "destructive" : "outline"}
                            className="cursor-pointer"
                            onClick={() => markAttendance(student.student_id, "absent")}
                          >
                            Absent
                          </Badge>
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
