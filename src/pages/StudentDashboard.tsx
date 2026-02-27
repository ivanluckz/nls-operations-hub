import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import WelcomeHeader from "@/components/student/WelcomeHeader";
import StatusCard from "@/components/student/StatusCard";
import TimetableCard from "@/components/student/TimetableCard";
import QRCodeCard from "@/components/student/QRCodeCard";
import CalendarSyncCard from "@/components/student/CalendarSyncCard";
import FloatingChatButton from "@/components/student/FloatingChatButton";
import MessagesCard from "@/components/student/MessagesCard";

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

  const getStatus = () => {
    if (allocations.length > 0) return "allocated";
    if (hasPreferences) return "submitted";
    return "pending";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-primary/10" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const status = getStatus();

  return (
    <div className="min-h-screen bg-background">
      <WelcomeHeader 
        name={profile?.full_name || "Student"} 
        onLogout={handleLogout}
      />

      <main className="container mx-auto px-4 py-8 pb-24">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Status and QR Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StatusCard 
              status={status} 
              onAction={() => navigate("/student/preferences")}
            />
            <QRCodeCard />
          </div>

          {/* Calendar Sync */}
           {allocations.length > 0 && <CalendarSyncCard />}
           {allocations.length > 0 && <MessagesCard />}

          {/* Leaderboard quick-link */}
          {allocations.length > 0 && (
            <button onClick={() => navigate("/student/leaderboard")}
              className="w-full flex items-center justify-between rounded-2xl border bg-card px-5 py-4 shadow-sm hover:border-primary/40 hover:bg-primary/5 transition-colors text-left group">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏆</span>
                <div>
                  <p className="font-semibold text-sm">Leaderboard</p>
                  <p className="text-xs text-muted-foreground">See where you rank among your peers</p>
                </div>
              </div>
              <span className="text-muted-foreground group-hover:text-primary transition-colors text-sm">View →</span>
            </button>
          )}

          {/* Weekly Timetable */}
          {allocations.length > 0 && (
            <TimetableCard allocations={allocations} />
          )}

          {/* Action Cards for different states */}
          {status === "submitted" && (
            <div className="bg-gradient-to-r from-secondary/5 via-background to-secondary/5 rounded-2xl p-6 border border-secondary/20">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold">Want to make changes?</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You can update your preferences before allocations are processed.
                  </p>
                </div>
                <button
                  onClick={() => navigate("/student/preferences")}
                  className="text-sm font-medium text-secondary hover:text-secondary/80 underline-offset-4 hover:underline transition-colors"
                >
                  Edit preferences →
                </button>
              </div>
            </div>
          )}

          {status === "allocated" && (
            <div className="bg-gradient-to-r from-muted/50 via-background to-muted/50 rounded-2xl p-6 border">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold">Update for next allocation?</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Submit new preferences for the upcoming allocation period.
                  </p>
                </div>
                <button
                  onClick={() => navigate("/student/preferences")}
                  className="text-sm font-medium text-primary hover:text-primary/80 underline-offset-4 hover:underline transition-colors"
                >
                  Update preferences →
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <FloatingChatButton />
    </div>
  );
};

export default StudentDashboard;
