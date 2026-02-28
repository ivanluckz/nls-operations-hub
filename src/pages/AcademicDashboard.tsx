import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, BookOpen, Users, BarChart3, GraduationCap, ArrowLeft } from "lucide-react";
import FloatingChatButton from "@/components/student/FloatingChatButton";

const academicActions = [
  { title: "Timetable Builder", description: "Build & manage class timetables", icon: Calendar, url: "/admin/academic/timetable", color: "bg-primary/10 text-primary" },
  { title: "Subjects", description: "Manage subjects & electives", icon: BookOpen, url: "/admin/academic/subjects", color: "bg-secondary/10 text-secondary" },
  { title: "Class Groups", description: "Organise students into classes", icon: Users, url: "/admin/academic/classes", color: "bg-accent/10 text-accent-foreground" },
  { title: "Attendance", description: "Academic attendance & reports", icon: BarChart3, url: "/admin/academic/attendance", color: "bg-destructive/10 text-destructive" },
];

const AcademicDashboard = () => {
  const navigate = useNavigate();

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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {academicActions.map((action) => (
            <Card
              key={action.title}
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1 group"
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
