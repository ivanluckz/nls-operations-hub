import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  LogOut,
  Settings,
  Users,
  BookOpen,
  PlayCircle,
  Download,
  ClipboardCheck,
  AlertTriangle,
  ListChecks,
  QrCode,
  Sun,
} from "lucide-react";
import FloatingChatButton from "@/components/student/FloatingChatButton";
import MealQRScanner from "@/components/kitchen/MealQRScanner";
import AttendanceChart from "@/components/dashboard/AttendanceChart";
import TodayScheduleWidget from "@/components/dashboard/TodayScheduleWidget";
import RecentActivityFeed from "@/components/dashboard/RecentActivityFeed";

interface Stats {
  totalActivities: number;
  totalStudents: number;
  submittedPreferences: number;
  completedAllocations: number;
}

const ModeratorDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats>({
    totalActivities: 0,
    totalStudents: 0,
    submittedPreferences: 0,
    completedAllocations: 0,
  });
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Lunch scanning state
  const [lunchScanning, setLunchScanning] = useState(false);
  const [lunchCount, setLunchCount] = useState(0);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
    fetchLunchCount();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const fetchStats = async () => {
    try {
      const [
        { count: activitiesCount },
        { count: studentsCount },
        { count: preferencesCount },
        { count: allocationsCount },
      ] = await Promise.all([
        supabase.from("activities").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("user_roles" as any).select("*", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("preferences").select("*", { count: "exact", head: true }),
        supabase.from("allocations").select("*", { count: "exact", head: true }),
      ]);

      setStats({
        totalActivities: activitiesCount || 0,
        totalStudents: studentsCount || 0,
        submittedPreferences: preferencesCount || 0,
        completedAllocations: allocationsCount || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load dashboard statistics" });
    } finally {
      setLoading(false);
    }
  };

  const fetchLunchCount = async () => {
    const today = new Date().toISOString().split("T")[0];
    const { count } = await (supabase as any)
      .from("meal_attendance")
      .select("id", { count: "exact", head: true })
      .eq("meal_type", "lunch")
      .eq("meal_date", today);
    setLunchCount(count || 0);
  };

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
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", studentId).single();
      toast({ title: "Already checked in", description: `${profile?.full_name || "Student"} already checked in for Lunch`, variant: "destructive" });
      return;
    }

    const { error } = await (supabase as any)
      .from("meal_attendance")
      .insert({ student_id: studentId, scanned_by: userId, meal_type: "lunch", meal_date: today });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", studentId).single();
    const name = profile?.full_name || "Student";
    setLastScanned(name);
    toast({ title: "✅ Checked in!", description: `${name} → Lunch` });
    fetchLunchCount();
  }, [userId, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Lunch scanning view
  if (lunchScanning) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scanning: Lunch
            </h2>
            <Button variant="outline" onClick={() => setLunchScanning(false)}>Done</Button>
          </div>
          {lastScanned && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-3 text-center">
                <p className="text-lg font-semibold text-primary">✅ {lastScanned}</p>
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-gradient-to-r from-secondary/5 via-background to-secondary/5">
        <div className="container mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-secondary/20 to-primary/20 flex items-center justify-center">
              <Settings className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Mentor Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Co-curricular & lunch management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Lunch Attendance Card */}
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-amber-500" />
              Lunch Attendance
            </CardTitle>
            <CardDescription>Scan student QR codes for lunch check-in</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{lunchCount}</p>
                  <p className="text-xs text-muted-foreground">checked in</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-muted-foreground">{stats.totalStudents}</p>
                  <p className="text-xs text-muted-foreground">total students</p>
                </div>
              </div>
              <Button onClick={() => setLunchScanning(true)} className="gap-2">
                <QrCode className="h-4 w-4" />
                Start Scanning
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalActivities}</div>
              <p className="text-xs text-muted-foreground">Active co-curricular activities</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalStudents}</div>
              <p className="text-xs text-muted-foreground">Registered student accounts</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Preferences Submitted</CardTitle>
              <PlayCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.submittedPreferences}</div>
              <p className="text-xs text-muted-foreground">Out of {stats.totalStudents} students</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Allocations Done</CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedAllocations}</div>
              <p className="text-xs text-muted-foreground">Students allocated</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Manage activities, manually allocate, and run auto-allocation</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button onClick={() => navigate("/moderator/activities")} className="h-auto py-4 flex flex-col items-start gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                <span className="font-semibold">Manage Activities</span>
              </div>
              <span className="text-xs text-primary-foreground/80 font-normal">Create, edit, and manage co-curricular activities</span>
            </Button>

            <Button onClick={() => navigate("/moderator/manual-allocations")} variant="secondary" className="h-auto py-4 flex flex-col items-start gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <span className="font-semibold">Manual Allocation</span>
              </div>
              <span className="text-xs text-secondary-foreground/80 font-normal">Manually assign students to activities</span>
            </Button>

            <Button onClick={() => navigate("/moderator/allocations")} variant="outline" className="h-auto py-4 flex flex-col items-start gap-2">
              <div className="flex items-center gap-2">
                <PlayCircle className="w-5 h-5" />
                <span className="font-semibold">Auto Allocation</span>
              </div>
              <span className="text-xs font-normal">Automatically allocate based on preferences</span>
            </Button>

            <Button onClick={() => navigate("/moderator/view-allocations")} variant="outline" className="h-auto py-4 flex flex-col items-start gap-2">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                <span className="font-semibold">View Allocations</span>
              </div>
              <span className="text-xs font-normal">View all student assignments</span>
            </Button>

            <Button onClick={() => navigate("/moderator/activity-roster")} variant="outline" className="h-auto py-4 flex flex-col items-start gap-2">
              <div className="flex items-center gap-2">
                <ListChecks className="w-5 h-5" />
                <span className="font-semibold">Activity Roster</span>
              </div>
              <span className="text-xs font-normal">View activities and enrolled students</span>
            </Button>

            <Button onClick={() => navigate("/moderator/attendance")} variant="outline" className="h-auto py-4 flex flex-col items-start gap-2">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5" />
                <span className="font-semibold">Attendance</span>
              </div>
              <span className="text-xs font-normal">Take and view attendance records</span>
            </Button>

            <Button onClick={() => navigate("/moderator/attendance-reports")} variant="outline" className="h-auto py-4 flex flex-col items-start gap-2 border-amber-500/50">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span className="font-semibold">Attendance Reports</span>
              </div>
              <span className="text-xs font-normal">View absent, late, and excused students</span>
            </Button>
          </CardContent>
        </Card>

        {/* Allocation Status */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Allocation Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Preferences Collected</span>
                  <span className="text-sm text-muted-foreground">{stats.submittedPreferences} / {stats.totalStudents}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-gradient-primary h-2 rounded-full transition-all"
                    style={{ width: `${stats.totalStudents > 0 ? (stats.submittedPreferences / stats.totalStudents) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Students Allocated</span>
                  <span className="text-sm text-muted-foreground">{stats.completedAllocations} / {stats.submittedPreferences}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-gradient-secondary h-2 rounded-full transition-all"
                    style={{ width: `${stats.submittedPreferences > 0 ? (stats.completedAllocations / stats.submittedPreferences) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts & Widgets */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AttendanceChart />
          </div>
          <TodayScheduleWidget />
        </div>

        <RecentActivityFeed />
      </main>

      <FloatingChatButton />
    </div>
  );
};

export default ModeratorDashboard;
