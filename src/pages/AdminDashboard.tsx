import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { GraduationCap, Activity } from "lucide-react";
import FloatingChatButton from "@/components/student/FloatingChatButton";

const AdminDashboard = () => {
  const navigate = useNavigate();

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Welcome back!</h1>
          <p className="text-muted-foreground">Choose a section to manage</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Academic Card */}
          <Card
            className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1 group border-2 hover:border-primary/40"
            onClick={() => navigate("/admin/academic/timetable")}
          >
            <CardHeader className="pb-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <GraduationCap className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-xl group-hover:text-primary transition-colors">
                Academic
              </CardTitle>
              <CardDescription>
                Manage the school timetable, subjects, class groups, and academic attendance
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="bg-muted px-2 py-1 rounded">Subjects</span>
                <span className="bg-muted px-2 py-1 rounded">Classes</span>
                <span className="bg-muted px-2 py-1 rounded">Timetable</span>
                <span className="bg-muted px-2 py-1 rounded">Reports</span>
              </div>
            </CardContent>
          </Card>

          {/* Co-curricular Card */}
          <Card
            className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1 group border-2 hover:border-secondary/40"
            onClick={() => navigate("/admin/activities")}
          >
            <CardHeader className="pb-4">
              <div className="w-14 h-14 rounded-xl bg-secondary/10 flex items-center justify-center mb-3">
                <Activity className="h-7 w-7 text-secondary" />
              </div>
              <CardTitle className="text-xl group-hover:text-secondary transition-colors">
                Co-curricular
              </CardTitle>
              <CardDescription>
                Manage after-school activities, allocations, attendance, and student preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="bg-muted px-2 py-1 rounded">Activities</span>
                <span className="bg-muted px-2 py-1 rounded">Allocations</span>
                <span className="bg-muted px-2 py-1 rounded">Attendance</span>
                <span className="bg-muted px-2 py-1 rounded">AI Summary</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <FloatingChatButton />
    </AdminLayout>
  );
};

export default AdminDashboard;
