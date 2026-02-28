import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users, Shield, UserCog, ClipboardCheck, AlertTriangle, UserCheck, Sparkles, BookOpen, GraduationCap, Activity, ArrowRight } from "lucide-react";
import FloatingChatButton from "@/components/student/FloatingChatButton";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [section, setSection] = useState<"choose" | "cocurricular">("choose");

  const quickActions = [
    { title: "User Management", description: "Manage users and roles", icon: UserCog, url: "/admin/user-management", color: "bg-secondary/10 text-secondary" },
    { title: "Manage Activities", description: "Add, edit, or remove activities", icon: Shield, url: "/admin/activities", color: "bg-primary/10 text-primary" },
    { title: "Manual Allocation", description: "Assign students to activities", icon: Users, url: "/admin/manual-allocations", color: "bg-accent/10 text-accent-foreground" },
    { title: "Auto Allocation", description: "Auto-allocate based on preferences", icon: Shield, url: "/admin/allocations", color: "bg-success/10 text-success" },
    { title: "View Allocations", description: "See all student assignments", icon: Users, url: "/admin/view-allocations", color: "bg-secondary/10 text-secondary" },
    { title: "Activity Roster", description: "View enrolled students", icon: BookOpen, url: "/admin/activity-roster", color: "bg-primary/10 text-primary" },
    { title: "Attendance", description: "Take attendance records", icon: ClipboardCheck, url: "/admin/attendance", color: "bg-success/10 text-success" },
    { title: "Attendance Reports", description: "View absent & late students", icon: AlertTriangle, url: "/admin/attendance-reports", color: "bg-destructive/10 text-destructive" },
    { title: "Pre-Excuse Students", description: "Excuse students ahead of time", icon: UserCheck, url: "/admin/pre-excuse", color: "bg-accent/10 text-accent-foreground" },
    { title: "AI Weekly Summary", description: "AI-powered trend reports", icon: Sparkles, url: "/admin/weekly-summary", color: "bg-primary/10 text-primary", highlight: true },
  ];

  if (section === "choose") {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Welcome back!</h1>
            <p className="text-muted-foreground">What would you like to manage?</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
            {/* Academic Card — Coming Soon */}
            <div className="relative group">
              <Card className="h-full border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 opacity-80 cursor-default">
                <CardHeader className="pb-4 text-center">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <GraduationCap className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Academic</CardTitle>
                  <CardDescription className="text-sm">
                    Timetable, subjects, class groups & academic attendance
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 text-center">
                  <Badge variant="secondary" className="text-xs px-3 py-1">
                    🚧 Coming Soon
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {/* Co-curricular Card */}
            <Card
              className="h-full border-2 border-transparent hover:border-secondary/40 cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group bg-gradient-to-br from-secondary/5 via-background to-secondary/5"
              onClick={() => setSection("cocurricular")}
            >
              <CardHeader className="pb-4 text-center">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Activity className="h-8 w-8 text-secondary" />
                </div>
                <CardTitle className="text-xl group-hover:text-secondary transition-colors">
                  Co-curricular
                </CardTitle>
                <CardDescription className="text-sm">
                  Activities, allocations, attendance & student preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 text-center">
                <span className="inline-flex items-center gap-1 text-sm font-medium text-secondary group-hover:gap-2 transition-all">
                  Enter <ArrowRight className="w-4 h-4" />
                </span>
              </CardContent>
            </Card>
          </div>
        </div>
        <FloatingChatButton />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Back to choice + header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Co-curricular</h1>
                <p className="text-sm text-muted-foreground">After-school activities management</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setSection("choose")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 bg-muted/50 hover:bg-muted px-3 py-1.5 rounded-lg"
          >
            <GraduationCap className="w-4 h-4" />
            Switch to Academic
          </button>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {quickActions.map((action) => (
            <Card
              key={action.title}
              className={`cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1 group ${
                action.highlight ? "border-primary/30 bg-primary/5" : ""
              }`}
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

export default AdminDashboard;
