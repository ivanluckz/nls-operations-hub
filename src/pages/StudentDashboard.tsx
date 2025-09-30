import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  LogOut, 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  AlertCircle 
} from "lucide-react";

interface Profile {
  full_name: string;
  email: string;
}

interface Activity {
  id: string;
  title: string;
  description: string;
  category: string;
  teacher_in_charge: string;
  schedule: string;
  capacity: number;
  current_enrollment: number;
}

interface Preference {
  first_choice: string;
  second_choice: string;
  third_choice: string;
}

interface Allocation {
  activity_id: string;
  preference_rank: number;
  status: string;
  activities: Activity;
}

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [preference, setPreference] = useState<Preference | null>(null);
  const [allocation, setAllocation] = useState<Allocation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      setProfile(profileData);

      // Fetch activities
      const { data: activitiesData } = await supabase
        .from("activities")
        .select("*")
        .eq("is_active", true)
        .order("title");

      setActivities(activitiesData || []);

      // Fetch preferences
      const { data: preferenceData } = await supabase
        .from("preferences")
        .select("*")
        .eq("student_id", user.id)
        .maybeSingle();

      setPreference(preferenceData);

      // Fetch allocation
      const { data: allocationData } = await supabase
        .from("allocations")
        .select("*, activities(*)")
        .eq("student_id", user.id)
        .maybeSingle();

      setAllocation(allocationData as Allocation | null);
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

  const getStatusInfo = () => {
    if (allocation) {
      return {
        icon: CheckCircle2,
        text: "Allocated",
        color: "text-success",
        bgColor: "bg-success/10",
      };
    } else if (preference) {
      return {
        icon: Clock,
        text: "Preferences Submitted",
        color: "text-secondary",
        bgColor: "bg-secondary/10",
      };
    } else {
      return {
        icon: AlertCircle,
        text: "Preferences Pending",
        color: "text-accent",
        bgColor: "bg-accent/10",
      };
    }
  };

  const getActivityTitle = (activityId: string) => {
    const activity = activities.find(a => a.id === activityId);
    return activity?.title || "Unknown Activity";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Student Portal</h1>
              <p className="text-sm text-muted-foreground">
                {profile?.full_name}
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
        {/* Status Card */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StatusIcon className={`w-5 h-5 ${statusInfo.color}`} />
              Current Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${statusInfo.bgColor}`}>
              <Badge variant="outline" className="border-0">
                {statusInfo.text}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Allocation Result */}
        {allocation && (
          <Card className="shadow-card border-success/20">
            <CardHeader>
              <CardTitle className="text-success">
                🎉 Your Allocation Result
              </CardTitle>
              <CardDescription>
                You have been allocated to a co-curricular activity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  {allocation.activities.title}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {allocation.activities.description}
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Teacher</p>
                    <p className="font-medium">
                      {allocation.activities.teacher_in_charge}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Schedule</p>
                    <p className="font-medium">
                      {allocation.activities.schedule}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Category</p>
                    <p className="font-medium">
                      {allocation.activities.category}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Preference Rank</p>
                    <p className="font-medium">
                      {allocation.preference_rank === 1 && "1st Choice ⭐"}
                      {allocation.preference_rank === 2 && "2nd Choice"}
                      {allocation.preference_rank === 3 && "3rd Choice"}
                    </p>
                  </div>
                </div>
              </div>
              {allocation.preference_rank !== 1 && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    You were allocated to your {allocation.preference_rank === 2 ? "second" : "third"} choice 
                    due to capacity constraints in your higher preferences.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Current Preferences */}
        {preference && !allocation && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Your Submitted Preferences</CardTitle>
              <CardDescription>
                Waiting for allocation to be processed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge>1st Choice</Badge>
                <span>{getActivityTitle(preference.first_choice)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">2nd Choice</Badge>
                <span>{getActivityTitle(preference.second_choice)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">3rd Choice</Badge>
                <span>{getActivityTitle(preference.third_choice)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Activity Selection */}
        {!preference && !allocation && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Select Your Preferences</CardTitle>
              <CardDescription>
                Browse available activities and submit your ranked preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => navigate("/student/preferences")}
                className="w-full"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Choose Activities
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Available Activities */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Available Activities</CardTitle>
            <CardDescription>
              {activities.length} activities available
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {activities.slice(0, 4).map((activity) => (
                <div
                  key={activity.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <h4 className="font-semibold">{activity.title}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {activity.description}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{activity.category}</span>
                    <span>
                      {activity.current_enrollment}/{activity.capacity} enrolled
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {activities.length > 4 && (
              <Button
                variant="link"
                onClick={() => navigate("/student/activities")}
                className="mt-4"
              >
                View All Activities →
              </Button>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default StudentDashboard;
