import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { LogOut, GraduationCap, ClipboardCheck, AlertTriangle, Users, BookOpen, MessageSquare, QrCode, UtensilsCrossed } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import ActivityMessaging from "@/components/teacher/ActivityMessaging";
import FloatingChatButton from "@/components/student/FloatingChatButton";
import HouseBadge from "@/components/ui/HouseBadge";
import AttendanceChart from "@/components/dashboard/AttendanceChart";
import TodayScheduleWidget from "@/components/dashboard/TodayScheduleWidget";
import MealQRScanner from "@/components/kitchen/MealQRScanner";
import { UserProfileCard } from "@/components/chat/UserProfileCard";
import IOSSchoolSkeleton from "@/components/IOSSchoolSkeleton";

interface ActivityData {
  id: string;
  title: string;
  days_of_week: string[];
  capacity: number;
  current_enrollment: number;
}

interface StudentAllocation {
  student_id: string;
  student_name: string;
  student_email: string;
  activity_title: string;
  day_of_week: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<{ full_name: string; avatar_url: string | null } | null>(null);
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [students, setStudents] = useState<StudentAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMentees, setHasMentees] = useState(false);
  const [lunchScanning, setLunchScanning] = useState(false);
  const [lunchCount, setLunchCount] = useState(0);
  const [lastLunchScanned, setLastLunchScanned] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileCard, setProfileCard] = useState<{ studentId: string; studentName: string } | null>(null);
  const [studentBadges, setStudentBadges] = useState<Record<string, string[]>>({});

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [{ data: profileData }, { data: activitiesData }, { data: studentsData }] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single(),
        supabase.from("activities").select("*").eq("teacher_id", user.id).order("title"),
        supabase.rpc("get_teacher_students", { teacher_user_id: user.id }),
      ]);

      setProfile(profileData);
      setActivities(activitiesData || []);
      const studentsList = studentsData || [];
      setStudents(studentsList);

      // Fetch badges for all students
      const studentIds = [...new Set(studentsList.map((s: any) => s.student_id))];
      if (studentIds.length > 0) {
        const { data: badgeRows } = await (supabase as any)
          .from("user_badges").select("user_id, badge_name").in("user_id", studentIds);
        const bMap: Record<string, string[]> = {};
        (badgeRows || []).forEach((b: any) => {
          if (!bMap[b.user_id]) bMap[b.user_id] = [];
          bMap[b.user_id].push(b.badge_name);
        });
        setStudentBadges(bMap);
      }

      // Check if this teacher has mentees
      const { count } = await (supabase as any)
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("mentor_id", user.id);
      setHasMentees((count || 0) > 0);

      // Fetch today's lunch count
      const today = new Date().toISOString().split("T")[0];
      const { count: lc } = await (supabase as any)
        .from("meal_attendance")
        .select("id", { count: "exact", head: true })
        .eq("meal_type", "lunch")
        .eq("meal_date", today);
      setLunchCount(lc || 0);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load dashboard data" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLunchScan = useCallback(async (studentId: string) => {
    if (!userId) return;
    const today = new Date().toISOString().split("T")[0];

    const { data: existing } = await (supabase as any)
      .from("meal_attendance")
      .select("id")
      .eq("student_id", studentId)
      .eq("meal_type", "lunch")
      .eq("meal_date", today)
      .maybeSingle();

    if (existing) {
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", studentId).single();
      toast({ title: "Already checked in", description: `${p?.full_name || "Student"} already has lunch today`, variant: "destructive" });
      return;
    }

    const { error } = await (supabase as any)
      .from("meal_attendance")
      .insert({ student_id: studentId, scanned_by: userId, meal_type: "lunch", meal_date: today });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const { data: p } = await supabase.from("profiles").select("full_name").eq("id", studentId).single();
    setLastLunchScanned(p?.full_name || "Student");
    setLunchCount(prev => prev + 1);
    toast({ title: "✅ Lunch checked in!", description: `${p?.full_name || "Student"} → Lunch` });
  }, [userId, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getStudentsByDay = (day: string) => students.filter(s => s.day_of_week === day);
  const uniqueStudents = new Set(students.map(s => s.student_id)).size;

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  if (loading) {
    return <IOSSchoolSkeleton />;
  }

  // Lunch scanning view for mentors
  if (lunchScanning) {
    return (
      <div className="min-h-screen bg-transparent p-4">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scanning: Lunch
            </h2>
            <Button variant="outline" onClick={() => setLunchScanning(false)}>Done</Button>
          </div>
          {lastLunchScanned && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-3 text-center">
                <p className="text-lg font-semibold text-primary">✅ {lastLunchScanned}</p>
                <p className="text-sm text-muted-foreground">Checked in for Lunch</p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-4">
              <MealQRScanner onScan={handleLunchScan} isActive={true} />
            </CardContent>
          </Card>
          <div className="text-center">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {lunchCount} checked in today
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header */}
      <header className="border-b bg-gradient-to-r from-primary/5 via-background to-primary/5">
        <div className="container mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 border-2 border-primary/20">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {profile ? getInitials(profile.full_name) : "T"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-bold">Teacher Portal</h1>
              <p className="text-sm text-muted-foreground">{profile?.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HouseBadge />
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="relative overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Activities</p>
                  <p className="text-3xl font-bold">{activities.length}</p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/10" />
          </Card>
          <Card className="relative overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Students</p>
                  <p className="text-3xl font-bold">{uniqueStudents}</p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-emerald-500" />
                </div>
              </div>
            </CardContent>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500/10" />
          </Card>
          <Card className="relative overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Days Active</p>
                  <p className="text-3xl font-bold">
                    {new Set(activities.flatMap(a => a.days_of_week)).size}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-violet-500" />
                </div>
              </div>
            </CardContent>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-violet-500/10" />
          </Card>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button onClick={() => navigate("/teacher/attendance")} className="gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Take Attendance
          </Button>
          <Button variant="outline" onClick={() => navigate("/teacher/attendance-reports")} className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            Reports
          </Button>
          <Button variant="outline" onClick={() => navigate("/teacher/dms")} className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Direct Messages
          </Button>
        </div>

        {/* My Activities */}
        <Card>
          <CardHeader>
            <CardTitle>My Activities</CardTitle>
            <CardDescription>Activities you're teaching this week</CardDescription>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">No activities assigned yet</p>
            ) : (
              <div className="grid gap-2">
                {DAYS.map(day => {
                  const dayActivities = activities.filter(a => a.days_of_week.includes(day));
                  return dayActivities.map(activity => {
                    const pct = activity.capacity > 0 ? Math.round((activity.current_enrollment / activity.capacity) * 100) : 0;
                    return (
                      <div key={`${activity.id}-${day}`} className="flex items-center justify-between p-3 rounded-xl border hover:border-primary/20 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {day.slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-medium text-sm">{activity.title}</span>
                            <p className="text-xs text-muted-foreground">
                              {activity.current_enrollment}/{activity.capacity} enrolled
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct >= 100 ? "bg-destructive" : pct > 80 ? "bg-amber-500" : "bg-primary"}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          {pct >= 100 && <Badge variant="destructive" className="text-[10px] h-4 px-1">Full</Badge>}
                        </div>
                      </div>
                    );
                  });
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Students */}
        <Card>
          <CardHeader>
            <CardTitle>My Students</CardTitle>
            <CardDescription>Students enrolled in your activities by day</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="Monday">
              <TabsList className="grid w-full grid-cols-5">
                {DAYS.map(day => (
                  <TabsTrigger key={day} value={day}>
                    {day.slice(0, 3)}
                    <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                      {getStudentsByDay(day).length}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
              {DAYS.map(day => {
                const dayStudents = getStudentsByDay(day);
                return (
                  <TabsContent key={day} value={day} className="mt-4">
                    {dayStudents.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Activity</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dayStudents.map((student) => (
                            <TableRow key={`${student.student_id}-${student.activity_title}`}>
                              <TableCell className="font-medium">
                                <button
                                  className="hover:underline hover:text-primary transition-colors cursor-pointer text-left"
                                  onClick={() => setProfileCard({ studentId: student.student_id, studentName: student.student_name })}
                                >
                                  {student.student_name}
                                </button>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{student.student_email}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{student.activity_title}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No students enrolled for {day}</p>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <AttendanceChart title="My Attendance (Last 7 Days)" />
          <TodayScheduleWidget />
        </div>

        {/* Mentor Lunch Scanning */}
        {hasMentees && (
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5 text-primary" />
                Mentor Lunch Attendance
              </CardTitle>
              <CardDescription>You have mentees — scan lunch QR codes for your students</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="lg" className="w-full gap-2" onClick={() => setLunchScanning(true)}>
                <QrCode className="h-5 w-5" />
                Start Lunch Scanning ({lunchCount} today)
              </Button>
            </CardContent>
          </Card>
        )}

        <ActivityMessaging />
      </main>
      <FloatingChatButton />
      {profileCard && (
        <UserProfileCard
          open={!!profileCard}
          onClose={() => setProfileCard(null)}
          senderId={profileCard.studentId}
          senderName={profileCard.studentName}
          isAdmin={false}
          isTeacher={false}
          badges={studentBadges[profileCard.studentId] || []}
          isAdminViewing={true}
          onBadgeGranted={(badgeName) => {
            setStudentBadges(prev => ({
              ...prev,
              [profileCard.studentId]: [...(prev[profileCard.studentId] || []), badgeName],
            }));
          }}
          onBadgeRemoved={(badgeName) => {
            setStudentBadges(prev => ({
              ...prev,
              [profileCard.studentId]: (prev[profileCard.studentId] || []).filter(b => b !== badgeName),
            }));
          }}
        />
      )}
    </div>
  );
};

export default TeacherDashboard;
