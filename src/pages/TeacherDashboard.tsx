import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { LogOut, GraduationCap } from "lucide-react";

interface Activity {
  id: string;
  title: string;
  day_of_week: string;
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
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [students, setStudents] = useState<StudentAllocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      setProfile(profileData);

      const { data: activitiesData } = await supabase
        .from("activities")
        .select("*")
        .eq("teacher_id", user.id)
        .order("day_of_week");

      setActivities(activitiesData || []);

      const { data: studentsData } = await supabase
        .rpc("get_teacher_students", { teacher_user_id: user.id });

      setStudents(studentsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load dashboard data",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getStudentsByDay = (day: string) => {
    return students.filter(s => s.day_of_week === day);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Teacher Portal</h1>
              <p className="text-sm text-muted-foreground">{profile?.full_name}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>My Activities</CardTitle>
            <CardDescription>
              Activities you're teaching this week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {DAYS.map(day => {
                const dayActivities = activities.filter(a => a.day_of_week === day);
                return dayActivities.map(activity => (
                  <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <span className="font-medium">{activity.title}</span>
                      <Badge variant="outline" className="ml-2">{day}</Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {activity.current_enrollment}/{activity.capacity} students
                    </span>
                  </div>
                ));
              })}
              {activities.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No activities assigned yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>My Students</CardTitle>
            <CardDescription>
              Students enrolled in your activities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="Monday">
              <TabsList className="grid w-full grid-cols-5">
                {DAYS.map(day => (
                  <TabsTrigger key={day} value={day}>{day.slice(0, 3)}</TabsTrigger>
                ))}
              </TabsList>
              {DAYS.map(day => {
                const dayStudents = getStudentsByDay(day);
                return (
                  <TabsContent key={day} value={day} className="space-y-4">
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
                          {dayStudents.map((student, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{student.student_name}</TableCell>
                              <TableCell>{student.student_email}</TableCell>
                              <TableCell>{student.activity_title}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        No students enrolled for {day}
                      </p>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TeacherDashboard;