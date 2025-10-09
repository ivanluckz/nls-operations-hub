import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  LogOut,
  Settings,
  Users,
  BookOpen,
  PlayCircle,
  Download,
} from "lucide-react";

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

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch activities count
      const { count: activitiesCount } = await supabase
        .from("activities")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Fetch students count
      const { count: studentsCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "student");

      // Fetch preferences count
      const { count: preferencesCount } = await supabase
        .from("preferences")
        .select("*", { count: "exact", head: true });

      // Fetch allocations count
      const { count: allocationsCount } = await supabase
        .from("allocations")
        .select("*", { count: "exact", head: true });

      setStats({
        totalActivities: activitiesCount || 0,
        totalStudents: studentsCount || 0,
        submittedPreferences: preferencesCount || 0,
        completedAllocations: allocationsCount || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load dashboard statistics",
      });
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Moderator Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Manage co-curricular allocations
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Activities
              </CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalActivities}</div>
              <p className="text-xs text-muted-foreground">
                Active co-curricular activities
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Students
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalStudents}</div>
              <p className="text-xs text-muted-foreground">
                Registered student accounts
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Preferences Submitted
              </CardTitle>
              <PlayCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.submittedPreferences}
              </div>
              <p className="text-xs text-muted-foreground">
                Out of {stats.totalStudents} students
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Allocations Done
              </CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.completedAllocations}
              </div>
              <p className="text-xs text-muted-foreground">
                Students allocated
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Manage activities, manually allocate, and run auto-allocation
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button
              onClick={() => navigate("/moderator/activities")}
              className="h-auto py-4 flex flex-col items-start gap-2"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                <span className="font-semibold">Manage Activities</span>
              </div>
              <span className="text-xs text-primary-foreground/80 font-normal">
                Create, edit, and manage co-curricular activities
              </span>
            </Button>

            <Button
              onClick={() => navigate("/moderator/manual-allocations")}
              variant="secondary"
              className="h-auto py-4 flex flex-col items-start gap-2"
            >
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <span className="font-semibold">Manual Allocation</span>
              </div>
              <span className="text-xs text-secondary-foreground/80 font-normal">
                Manually assign students to activities
              </span>
            </Button>

            <Button
              onClick={() => navigate("/moderator/allocations")}
              variant="outline"
              className="h-auto py-4 flex flex-col items-start gap-2"
            >
              <div className="flex items-center gap-2">
                <PlayCircle className="w-5 h-5" />
                <span className="font-semibold">Auto Allocation</span>
              </div>
              <span className="text-xs font-normal">
                Automatically allocate based on preferences
              </span>
            </Button>

            <Button
              onClick={() => navigate("/moderator/view-allocations")}
              variant="outline"
              className="h-auto py-4 flex flex-col items-start gap-2"
            >
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                <span className="font-semibold">View Allocations</span>
              </div>
              <span className="text-xs font-normal">
                View all student assignments
              </span>
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
                  <span className="text-sm font-medium">
                    Preferences Collected
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {stats.submittedPreferences} / {stats.totalStudents}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-gradient-primary h-2 rounded-full transition-all"
                    style={{
                      width: `${
                        stats.totalStudents > 0
                          ? (stats.submittedPreferences / stats.totalStudents) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    Students Allocated
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {stats.completedAllocations} / {stats.submittedPreferences}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-gradient-secondary h-2 rounded-full transition-all"
                    style={{
                      width: `${
                        stats.submittedPreferences > 0
                          ? (stats.completedAllocations /
                              stats.submittedPreferences) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ModeratorDashboard;
