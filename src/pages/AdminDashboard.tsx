import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, Shield, UserCog, ClipboardCheck, AlertTriangle, UserCheck,
  Sparkles, BookOpen, Activity, Zap, TrendingUp, CalendarDays,
  UtensilsCrossed, MessageSquare, Award, Dumbbell, HeartPulse, Mail
} from "lucide-react";
import FloatingChatButton from "@/components/student/FloatingChatButton";
import TodayScheduleWidget from "@/components/dashboard/TodayScheduleWidget";
import RecentActivityFeed from "@/components/dashboard/RecentActivityFeed";
import AttendanceChart from "@/components/dashboard/AttendanceChart";

interface DashboardStats {
  totalStudents: number;
  totalActivities: number;
  totalAllocations: number;
  totalPreferences: number;
  pendingRequests: number;
  totalTeachers: number;
  attendanceSessions: number;
  totalBadges: number;
  totalMeals: number;
  totalWorkouts: number;
  medicalVisits: number;
  totalMessages: number;
  dmMessages: number;
  workoutClearances: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0, totalActivities: 0, totalAllocations: 0,
    totalPreferences: 0, pendingRequests: 0, totalTeachers: 0,
    attendanceSessions: 0, totalBadges: 0, totalMeals: 0,
    totalWorkouts: 0, medicalVisits: 0, totalMessages: 0,
    dmMessages: 0, workoutClearances: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const [
        { count: students },
        { count: activities },
        { data: allocatedData },
        { count: preferences },
        { count: pending },
        { count: teachers },
        { count: sessions },
        { count: badges },
        { count: meals },
        { count: workouts },
        { count: medical },
        { count: messages },
        { count: dms },
        { count: clearances },
      ] = await Promise.all([
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("activities").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.rpc("count_allocated_students"),
        supabase.from("preferences").select("id", { count: "exact", head: true }),
        supabase.from("student_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "teacher"),
        supabase.from("attendance_sessions").select("id", { count: "exact", head: true }),
        supabase.from("user_badges").select("id", { count: "exact", head: true }),
        supabase.from("meal_attendance").select("id", { count: "exact", head: true }),
        supabase.from("workout_attendance").select("id", { count: "exact", head: true }),
        supabase.from("medical_visits").select("id", { count: "exact", head: true }),
        supabase.from("activity_messages").select("id", { count: "exact", head: true }),
        supabase.from("direct_messages").select("id", { count: "exact", head: true }),
        supabase.from("workout_clearances").select("id", { count: "exact", head: true }).eq("status", "restricted"),
      ]);
      setStats({
        totalStudents: students || 0,
        totalActivities: activities || 0,
        totalAllocations: typeof allocatedData === 'number' ? allocatedData : 0,
        totalPreferences: preferences || 0,
        pendingRequests: pending || 0,
        totalTeachers: teachers || 0,
        attendanceSessions: sessions || 0,
        totalBadges: badges || 0,
        totalMeals: meals || 0,
        totalWorkouts: workouts || 0,
        medicalVisits: medical || 0,
        totalMessages: messages || 0,
        dmMessages: dms || 0,
        workoutClearances: clearances || 0,
      });
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: "Students", value: stats.totalStudents, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10", url: "/admin/user-management" },
    { label: "Activities", value: stats.totalActivities, icon: BookOpen, color: "text-emerald-500", bg: "bg-emerald-500/10", url: "/admin/co-curricular/activities" },
    { label: "Students Allocated", value: stats.totalAllocations, icon: TrendingUp, color: "text-violet-500", bg: "bg-violet-500/10", url: "/admin/co-curricular/view-allocations" },
    { label: "Preferences", value: stats.totalPreferences, icon: ClipboardCheck, color: "text-amber-500", bg: "bg-amber-500/10", url: "/admin/co-curricular/allocations" },
    { label: "Teachers", value: stats.totalTeachers, icon: UserCog, color: "text-cyan-500", bg: "bg-cyan-500/10", url: "/admin/user-management" },
    { label: "Pending Requests", value: stats.pendingRequests, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10", url: "/admin/admin-ai" },
    { label: "Attendance Sessions", value: stats.attendanceSessions, icon: CalendarDays, color: "text-indigo-500", bg: "bg-indigo-500/10", url: "/admin/co-curricular/attendance-reports" },
    { label: "Badges Awarded", value: stats.totalBadges, icon: Award, color: "text-pink-500", bg: "bg-pink-500/10", url: "/admin/co-curricular/badge-requests" },
    { label: "Meal Scans", value: stats.totalMeals, icon: UtensilsCrossed, color: "text-orange-500", bg: "bg-orange-500/10", url: "/admin/meal-reports" },
    { label: "Workout Scans", value: stats.totalWorkouts, icon: Dumbbell, color: "text-lime-500", bg: "bg-lime-500/10", url: "/admin/workout-reports" },
    { label: "Medical Visits", value: stats.medicalVisits, icon: HeartPulse, color: "text-rose-500", bg: "bg-rose-500/10", url: "/medical" },
    { label: "Activity Messages", value: stats.totalMessages, icon: MessageSquare, color: "text-sky-500", bg: "bg-sky-500/10", url: "/admin/co-curricular/messages" },
    { label: "Direct Messages", value: stats.dmMessages, icon: Mail, color: "text-fuchsia-500", bg: "bg-fuchsia-500/10", url: "/admin/dms" },
    { label: "Workout Restricted", value: stats.workoutClearances, icon: Shield, color: "text-yellow-500", bg: "bg-yellow-500/10", url: "/admin/workout-reports" },
  ];

  const quickActions = [
    { title: "User Management", description: "Manage users and roles", icon: UserCog, url: "/admin/user-management", color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "Manage Activities", description: "Add, edit, or remove activities", icon: Shield, url: "/admin/co-curricular/activities", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { title: "Manual Allocation", description: "Assign students to activities", icon: Users, url: "/admin/co-curricular/manual-allocations", color: "text-violet-500", bg: "bg-violet-500/10" },
    { title: "Auto Allocation", description: "Auto-allocate based on preferences", icon: Sparkles, url: "/admin/co-curricular/allocations", color: "text-amber-500", bg: "bg-amber-500/10" },
    { title: "View Allocations", description: "See all student assignments", icon: TrendingUp, url: "/admin/co-curricular/view-allocations", color: "text-cyan-500", bg: "bg-cyan-500/10" },
    { title: "Activity Roster", description: "View enrolled students", icon: BookOpen, url: "/admin/co-curricular/activity-roster", color: "text-pink-500", bg: "bg-pink-500/10" },
    { title: "Weekly Timetable", description: "Visual weekly schedule", icon: CalendarDays, url: "/admin/co-curricular/timetable", color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { title: "Attendance", description: "Take attendance records", icon: ClipboardCheck, url: "/admin/co-curricular/attendance", color: "text-teal-500", bg: "bg-teal-500/10" },
    { title: "Attendance Reports", description: "View absent & late students", icon: AlertTriangle, url: "/admin/co-curricular/attendance-reports", color: "text-red-500", bg: "bg-red-500/10" },
    { title: "Pre-Excuse Students", description: "Excuse students ahead of time", icon: UserCheck, url: "/admin/co-curricular/pre-excuse", color: "text-orange-500", bg: "bg-orange-500/10" },
  ];

  const highlightActions = [
    { title: "Admin AI", description: "Process student requests with AI", icon: Zap, url: "/admin/admin-ai", badge: stats.pendingRequests > 0 ? `${stats.pendingRequests} pending` : undefined },
    { title: "AI Weekly Summary", description: "AI-powered trend reports", icon: Sparkles, url: "/admin/co-curricular/weekly-summary" },
    { title: "Meal Reports", description: "View meal attendance data", icon: UtensilsCrossed, url: "/admin/meal-reports" },
    { title: "Badge Requests", description: "Approve student badges", icon: Award, url: "/admin/co-curricular/badge-requests" },
    { title: "All Chats", description: "View all activity chats", icon: MessageSquare, url: "/admin/co-curricular/messages" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-[52px]">Co-curricular activities overview</p>
        </div>

        {/* Live Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <Card key={s.label} className="relative overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 group" onClick={() => navigate(s.url)}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">{s.label}</p>
                    <p className="text-3xl font-bold mt-1">{s.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-2xl ${s.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <s.icon className={`h-6 w-6 ${s.color}`} />
                  </div>
                </div>
              </CardContent>
              <div className={`absolute bottom-0 left-0 right-0 h-1 ${s.bg}`} />
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {quickActions.map((action) => (
              <Card
                key={action.title}
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 group border-transparent hover:border-primary/20"
                onClick={() => navigate(action.url)}
              >
                <CardContent className="p-4">
                  <div className={`w-10 h-10 rounded-xl ${action.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <action.icon className={`h-5 w-5 ${action.color}`} />
                  </div>
                  <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                    {action.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Highlighted / AI Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Tools & Reports</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {highlightActions.map((action) => (
              <Card
                key={action.title}
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 group border-primary/10 bg-gradient-to-br from-primary/[0.03] to-transparent"
                onClick={() => navigate(action.url)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <action.icon className="h-5 w-5 text-primary" />
                    </div>
                    {action.badge && (
                      <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                        {action.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                    {action.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        {/* Charts & Widgets */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AttendanceChart />
          </div>
          <TodayScheduleWidget />
        </div>

        <RecentActivityFeed />
        </div>
      <FloatingChatButton />
    </AdminLayout>
  );
};

export default AdminDashboard;
