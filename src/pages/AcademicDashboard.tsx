import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, BookOpen, Users, BarChart3, GraduationCap, ArrowLeft, UserCheck, Sparkles, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import FloatingChatButton from "@/components/student/FloatingChatButton";
import { format } from "date-fns";

const academicActions = [
  { title: "Timetable Builder", description: "Build & manage class timetables", icon: Calendar, url: "/admin/academic/timetable", color: "bg-primary/10 text-primary" },
  { title: "Subjects", description: "Manage subjects & electives", icon: BookOpen, url: "/admin/academic/subjects", color: "bg-secondary/10 text-secondary" },
  { title: "Class Groups", description: "Organise students into classes", icon: Users, url: "/admin/academic/classes", color: "bg-accent/10 text-accent-foreground" },
  { title: "Attendance Reports", description: "Academic attendance & reports", icon: BarChart3, url: "/admin/academic/attendance", color: "bg-destructive/10 text-destructive" },
  { title: "Pre-Excuse Students", description: "Excuse students ahead of time", icon: UserCheck, url: "/admin/academic/pre-excuse", color: "bg-primary/10 text-primary" },
  { title: "AI Weekly Summary", description: "AI-powered academic insights", icon: Sparkles, url: "/admin/academic/weekly-summary", color: "bg-primary/10 text-primary", highlight: true },
];

interface Stats {
  totalStudents: number;
  totalClasses: number;
  totalSubjects: number;
  weeklyAttendanceRate: number | null;
  todayPeriods: number;
  lowAttendanceClasses: { name: string; pct: number }[];
}

const AcademicDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [classesRes, subjectsRes, membersRes, periodsRes] = await Promise.all([
          (supabase as any).from("class_groups").select("id, name"),
          (supabase as any).from("academic_subjects").select("id"),
          (supabase as any).from("class_group_members").select("id, class_group_id, student_id"),
          (supabase as any).from("academic_periods").select("id").eq("is_break", false),
        ]);

        const classes = classesRes.data || [];
        const members = membersRes.data || [];
        const totalStudents = new Set(members.map((m: any) => m.student_id)).size;

        // Today's day number
        const todayDow = new Date().getDay();
        const todayNum = todayDow === 0 || todayDow > 5 ? null : todayDow;
        let todayPeriods = 0;
        if (todayNum) {
          const { data: todaySlots } = await (supabase as any).from("timetable_slots").select("id").eq("day_of_week", todayNum);
          todayPeriods = todaySlots?.length || 0;
        }

        // Weekly attendance rate
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);
        const { data: recentSessions } = await (supabase as any)
          .from("academic_sessions")
          .select("id")
          .gte("session_date", format(weekStart, "yyyy-MM-dd"));
        const sessionIds = recentSessions?.map((s: any) => s.id) || [];

        let weeklyAttendanceRate: number | null = null;
        const lowAttendanceClasses: { name: string; pct: number }[] = [];

        if (sessionIds.length > 0) {
          const { data: recentAtt } = await (supabase as any)
            .from("academic_attendance")
            .select("status")
            .in("session_id", sessionIds)
            .limit(5000);
          
          if (recentAtt?.length) {
            const present = recentAtt.filter((a: any) => a.status === "present").length;
            weeklyAttendanceRate = Math.round((present / recentAtt.length) * 100);
          }

          // Per-class attendance for low-attendance detection
          for (const cls of classes) {
            const classMembers = members.filter((m: any) => m.class_group_id === cls.id).map((m: any) => m.student_id);
            if (!classMembers.length) continue;
            const classAtt = recentAtt?.filter((a: any) => classMembers.includes(a.student_id)) || [];
            if (classAtt.length === 0) continue;
            const pct = Math.round((classAtt.filter((a: any) => a.status === "present").length / classAtt.length) * 100);
            if (pct < 80) lowAttendanceClasses.push({ name: cls.name, pct });
          }
          lowAttendanceClasses.sort((a, b) => a.pct - b.pct);
        }

        setStats({
          totalStudents,
          totalClasses: classes.length,
          totalSubjects: subjectsRes.data?.length || 0,
          weeklyAttendanceRate,
          todayPeriods,
          lowAttendanceClasses: lowAttendanceClasses.slice(0, 3),
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
      setLoading(false);
    };
    fetchStats();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Academic</h1>
              <p className="text-sm text-muted-foreground">Timetable, subjects & academic attendance</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/admin")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 bg-muted/50 hover:bg-muted px-3 py-1.5 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        {/* Live Stats */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-8 w-16 mb-2" /><Skeleton className="h-4 w-24" /></CardContent></Card>
            ))
          ) : stats ? (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Users className="h-4 w-4" />
                    <span className="text-xs font-medium">Students</span>
                  </div>
                  <p className="text-3xl font-bold">{stats.totalStudents}</p>
                  <p className="text-xs text-muted-foreground mt-1">across {stats.totalClasses} classes</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <BarChart3 className="h-4 w-4" />
                    <span className="text-xs font-medium">Weekly Attendance</span>
                  </div>
                  <p className={`text-3xl font-bold ${stats.weeklyAttendanceRate !== null ? (stats.weeklyAttendanceRate >= 80 ? "text-green-600 dark:text-green-400" : stats.weeklyAttendanceRate >= 60 ? "text-amber-600 dark:text-amber-400" : "text-destructive") : ""}`}>
                    {stats.weeklyAttendanceRate !== null ? `${stats.weeklyAttendanceRate}%` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">past 7 days</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <BookOpen className="h-4 w-4" />
                    <span className="text-xs font-medium">Subjects</span>
                  </div>
                  <p className="text-3xl font-bold">{stats.totalSubjects}</p>
                  <p className="text-xs text-muted-foreground mt-1">configured</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs font-medium">Today's Slots</span>
                  </div>
                  <p className="text-3xl font-bold">{stats.todayPeriods}</p>
                  <p className="text-xs text-muted-foreground mt-1">timetabled periods</p>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        {/* Low attendance warning */}
        {stats && stats.lowAttendanceClasses.length > 0 && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-800 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                Classes with Low Attendance (&lt;80%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {stats.lowAttendanceClasses.map(c => (
                  <Badge key={c.name} variant="outline" className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400">
                    {c.name}: {c.pct}%
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {academicActions.map((action) => (
            <Card
              key={action.title}
              className={`cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1 group ${action.highlight ? "border-primary/30 bg-primary/5" : ""}`}
              onClick={() => navigate(action.url)}
            >
              <CardHeader className="pb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${action.color}`}>
                  <action.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base group-hover:text-primary transition-colors">
                  {action.title}
                </CardTitle>
                <CardDescription className="text-sm">
                  {action.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
      <FloatingChatButton />
    </AdminLayout>
  );
};

export default AcademicDashboard;
