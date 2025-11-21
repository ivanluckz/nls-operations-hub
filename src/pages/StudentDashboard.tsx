import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { LogOut, BookOpen, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { StudentQRCode } from "@/components/StudentQRCode";

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
  days_of_week: string[];
}

interface Allocation {
  activity_id: string;
  day_of_week: string;
  slot_number: number;
  preference_rank: number;
  activities: Activity;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasPreferences, setHasPreferences] = useState(false);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
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
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      setProfile(profileData);

      const { data: preferenceData } = await supabase
        .from("preferences")
        .select("*")
        .eq("student_id", user.id)
        .maybeSingle();

      setHasPreferences(!!preferenceData);

      const { data: allocationsData } = await supabase
        .from("allocations")
        .select("*, activities(*)")
        .eq("student_id", user.id);

      setAllocations(allocationsData as Allocation[] || []);
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
    if (allocations.length > 0) {
      return {
        icon: CheckCircle2,
        text: "Allocated",
        color: "text-success",
        bgColor: "bg-success/10",
      };
    } else if (hasPreferences) {
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

  const getAllocationByDayAndSlot = (day: string, slot: number) => {
    return allocations.find(a => a.day_of_week === day && a.slot_number === slot);
  };

  const getDaySlotLabel = (day: string, slot: number) => {
    if (day === 'Wednesday') {
      return `${day} - Slot ${slot}`;
    }
    return day;
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
      <header className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Student Portal</h1>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

          <StudentQRCode />
        </div>

        {allocations.length > 0 && (
          <Card className="shadow-card border-success/20">
            <CardHeader>
              <CardTitle className="text-success">🎉 Your Weekly Timetable</CardTitle>
              <CardDescription>
                Your co-curricular activities for each day
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Preference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DAYS.map(day => {
                    // Wednesday has 2 slots, others have 1
                    const slots = day === 'Wednesday' ? [1, 2] : [1];
                    
                    return slots.map(slot => {
                      const allocation = getAllocationByDayAndSlot(day, slot);
                      const dayLabel = getDaySlotLabel(day, slot);
                      
                      return (
                        <TableRow key={`${day}-${slot}`}>
                          <TableCell className="font-medium">{dayLabel}</TableCell>
                          <TableCell>
                            {allocation ? (
                              <div>
                                <p className="font-medium">{allocation.activities.title}</p>
                                <Badge variant="outline" className="mt-1">{allocation.activities.category}</Badge>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Not allocated</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {allocation ? allocation.activities.teacher_in_charge : '-'}
                          </TableCell>
                          <TableCell>
                            {allocation ? allocation.activities.schedule : '-'}
                          </TableCell>
                          <TableCell>
                            {allocation && (
                              <Badge variant={allocation.preference_rank === 1 ? "default" : "secondary"}>
                                {allocation.preference_rank === 1 && "1st ⭐"}
                                {allocation.preference_rank === 2 && "2nd"}
                                {allocation.preference_rank === 3 && "3rd"}
                                {allocation.preference_rank === 4 && "4th"}
                                {allocation.preference_rank === 5 && "5th"}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {!hasPreferences && allocations.length === 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Select Your Preferences</CardTitle>
              <CardDescription>
                Choose your preferred activities for each day of the week
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/student/preferences")} className="w-full">
                <BookOpen className="w-4 h-4 mr-2" />
                Choose Activities
              </Button>
            </CardContent>
          </Card>
        )}

        {hasPreferences && allocations.length === 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Preferences Submitted</CardTitle>
              <CardDescription>
                Waiting for allocations to be processed by moderators
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Your preferences have been recorded. Check back soon to see your allocations!
              </p>
              <Button 
                onClick={() => navigate("/student/preferences")} 
                variant="outline"
                className="w-full"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Edit Preferences
              </Button>
            </CardContent>
          </Card>
        )}

        {hasPreferences && allocations.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Update Your Preferences</CardTitle>
              <CardDescription>
                You can update your preferences at any time before the next allocation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => navigate("/student/preferences")} 
                variant="outline"
                className="w-full"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Update Preferences
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default StudentDashboard;