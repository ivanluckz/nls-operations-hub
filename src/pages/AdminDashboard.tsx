import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, UserCog, ClipboardCheck, AlertTriangle, UserCheck, Sparkles, BookOpen, Activity, ArrowRight, Terminal, Zap } from "lucide-react";
import FloatingChatButton from "@/components/student/FloatingChatButton";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [hasDev, setHasDev] = useState(false);

  useEffect(() => {
    const checkDev = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase as any).from("user_badges").select("id").eq("user_id", user.id).eq("badge_name", "Dev").maybeSingle();
      setHasDev(!!data);
    };
    checkDev();
  }, []);
  const quickActions = [
    { title: "User Management", description: "Manage users and roles", icon: UserCog, url: "/admin/user-management", color: "bg-secondary/10 text-secondary" },
    { title: "Manage Activities", description: "Add, edit, or remove activities", icon: Shield, url: "/admin/co-curricular/activities", color: "bg-primary/10 text-primary" },
    { title: "Manual Allocation", description: "Assign students to activities", icon: Users, url: "/admin/co-curricular/manual-allocations", color: "bg-accent/10 text-accent-foreground" },
    { title: "Auto Allocation", description: "Auto-allocate based on preferences", icon: Shield, url: "/admin/co-curricular/allocations", color: "bg-success/10 text-success" },
    { title: "View Allocations", description: "See all student assignments", icon: Users, url: "/admin/co-curricular/view-allocations", color: "bg-secondary/10 text-secondary" },
    { title: "Activity Roster", description: "View enrolled students", icon: BookOpen, url: "/admin/co-curricular/activity-roster", color: "bg-primary/10 text-primary" },
    { title: "Attendance", description: "Take attendance records", icon: ClipboardCheck, url: "/admin/co-curricular/attendance", color: "bg-success/10 text-success" },
    { title: "Attendance Reports", description: "View absent & late students", icon: AlertTriangle, url: "/admin/co-curricular/attendance-reports", color: "bg-destructive/10 text-destructive" },
    { title: "Pre-Excuse Students", description: "Excuse students ahead of time", icon: UserCheck, url: "/admin/co-curricular/pre-excuse", color: "bg-accent/10 text-accent-foreground" },
    { title: "AI Weekly Summary", description: "AI-powered trend reports", icon: Sparkles, url: "/admin/co-curricular/weekly-summary", color: "bg-primary/10 text-primary", highlight: true },
    { title: "Admin AI", description: "Process student requests with AI", icon: Zap, url: "/admin/admin-ai", color: "bg-primary/10 text-primary", highlight: true },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Co-curricular</h1>
              <p className="text-sm text-muted-foreground">After-school activities management</p>
            </div>
          </div>
          {hasDev && (
            <button onClick={() => navigate("/dev/ai")}
              className="flex items-center gap-2 rounded-xl border border-dashed border-cyan-400/50 bg-gradient-to-r from-cyan-500/5 to-cyan-500/5 px-4 py-2 hover:border-cyan-400 transition-all text-left group dev-msg-glow">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium dev-name-glow">Dev AI</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-cyan-400 transition-colors" />
            </button>
          )}
        </div>

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
