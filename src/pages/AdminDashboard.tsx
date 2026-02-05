 import { useNavigate } from "react-router-dom";
 import { AdminLayout } from "@/components/admin/AdminLayout";
 import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
 import { Users, Shield, UserCog, ClipboardCheck, AlertTriangle, UserCheck, Sparkles, BookOpen, TrendingUp, Calendar, Activity } from "lucide-react";

const AdminDashboard = () => {
  const navigate = useNavigate();
 
   const quickActions = [
     {
       title: "User Management",
       description: "Manage users and roles",
       icon: UserCog,
       url: "/admin/user-management",
       color: "bg-secondary/10 text-secondary",
     },
     {
       title: "Manage Activities",
       description: "Add, edit, or remove activities",
       icon: Shield,
       url: "/admin/activities",
       color: "bg-primary/10 text-primary",
     },
     {
       title: "Manual Allocation",
       description: "Assign students to activities",
       icon: Users,
       url: "/admin/manual-allocations",
       color: "bg-accent/10 text-accent-foreground",
     },
     {
       title: "Auto Allocation",
       description: "Auto-allocate based on preferences",
       icon: Shield,
       url: "/admin/allocations",
       color: "bg-success/10 text-success",
     },
     {
       title: "View Allocations",
       description: "See all student assignments",
       icon: Users,
       url: "/admin/view-allocations",
       color: "bg-secondary/10 text-secondary",
     },
     {
       title: "Activity Roster",
       description: "View enrolled students",
       icon: BookOpen,
       url: "/admin/activity-roster",
       color: "bg-primary/10 text-primary",
     },
     {
       title: "Attendance",
       description: "Take attendance records",
       icon: ClipboardCheck,
       url: "/admin/attendance",
       color: "bg-success/10 text-success",
     },
     {
       title: "Attendance Reports",
       description: "View absent & late students",
       icon: AlertTriangle,
       url: "/admin/attendance-reports",
       color: "bg-destructive/10 text-destructive",
     },
     {
       title: "Pre-Excuse Students",
       description: "Excuse students ahead of time",
       icon: UserCheck,
       url: "/admin/pre-excuse",
       color: "bg-accent/10 text-accent-foreground",
     },
     {
       title: "AI Weekly Summary",
       description: "AI-powered trend reports",
       icon: Sparkles,
       url: "/admin/weekly-summary",
       color: "bg-primary/10 text-primary",
       highlight: true,
     },
   ];

  return (
     <AdminLayout>
       <div className="space-y-8">
         {/* Welcome Section */}
         <div className="flex flex-col gap-2">
           <h1 className="text-3xl font-bold tracking-tight">Welcome back!</h1>
           <p className="text-muted-foreground">
             Here's an overview of your administrative dashboard
           </p>
        </div>
 
         {/* Stats Overview */}
         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
           <Card className="border-l-4 border-l-primary">
             <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
               <Activity className="h-4 w-4 text-muted-foreground" />
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold">{quickActions.length}</div>
               <p className="text-xs text-muted-foreground">Available features</p>
             </CardContent>
           </Card>
           <Card className="border-l-4 border-l-secondary">
             <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-sm font-medium">This Week</CardTitle>
               <Calendar className="h-4 w-4 text-muted-foreground" />
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold">Active</div>
               <p className="text-xs text-muted-foreground">Attendance tracking</p>
             </CardContent>
           </Card>
           <Card className="border-l-4 border-l-success">
             <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-sm font-medium">System Status</CardTitle>
               <TrendingUp className="h-4 w-4 text-muted-foreground" />
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold text-success">Healthy</div>
               <p className="text-xs text-muted-foreground">All systems operational</p>
             </CardContent>
           </Card>
           <Card className="border-l-4 border-l-accent">
             <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-sm font-medium">AI Features</CardTitle>
               <Sparkles className="h-4 w-4 text-muted-foreground" />
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold">Enabled</div>
               <p className="text-xs text-muted-foreground">Weekly summaries ready</p>
             </CardContent>
           </Card>
         </div>
 
         {/* Quick Actions Grid */}
         <div>
           <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
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
       </div>
     </AdminLayout>
  );
};

export default AdminDashboard;
