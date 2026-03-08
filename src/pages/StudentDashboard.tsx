import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isDevUser } from "@/lib/dev-badge";
import { useToast } from "@/hooks/use-toast";
import WelcomeHeader from "@/components/student/WelcomeHeader";
import StatusCard from "@/components/student/StatusCard";
import TimetableCard from "@/components/student/TimetableCard";
import QRCodeCard from "@/components/student/QRCodeCard";
import CalendarSyncCard from "@/components/student/CalendarSyncCard";
import FloatingChatButton from "@/components/student/FloatingChatButton";
import MessagesCard from "@/components/student/MessagesCard";
import HouseSelectionCard from "@/components/student/HouseSelectionCard";
import WorkoutSelectionCard from "@/components/student/WorkoutSelectionCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ArrowRight, KeyRound, FileText } from "lucide-react";

interface Profile {
  full_name: string;
  email: string;
}

interface Activity2 {
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
  activities: Activity2;
}

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasPreferences, setHasPreferences] = useState(false);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [userBadges, setUserBadges] = useState<string[]>([]);
  const [section, setSection] = useState<"choose" | "cocurricular">("choose");

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

      const [{ data: allocationsData }, { data: allBadges }, { data: reviewedRequests }] = await Promise.all([
        supabase.from("allocations").select("*, activities(*)").eq("student_id", user.id),
        (supabase as any).from("user_badges").select("badge_name").eq("user_id", user.id).limit(20),
        supabase
          .from("student_requests")
          .select("id, request_type, status, admin_notes, reviewed_at")
          .eq("student_id", user.id)
          .in("status", ["approved", "denied"])
          .order("reviewed_at", { ascending: false })
          .limit(5),
      ]);

      const badgeNames = (allBadges || []).map((b: any) => b.badge_name);
      setAllocations((allocationsData as Allocation[] || []).filter(a => a.activities != null));
      setUserBadges(badgeNames);

      // Show toast for recently reviewed requests not yet seen
      const seenKey = "seen_request_reviews";
      const seen: string[] = JSON.parse(localStorage.getItem(seenKey) || "[]");
      (reviewedRequests || []).forEach((req: any) => {
        if (!seen.includes(req.id)) {
          const isApproved = req.status === "approved";
          const typeLabel = (req.request_type || "").replace(/_/g, " ");
          toast({
            variant: isApproved ? "default" : "destructive",
            title: isApproved ? "Request Approved ✅" : "Request Denied ❌",
            description: `Your ${typeLabel} request was ${req.status}.${req.admin_notes ? ` Note: ${req.admin_notes}` : ""}`,
          });
          seen.push(req.id);
        }
      });
      localStorage.setItem(seenKey, JSON.stringify(seen.slice(-50)));
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

  if (section === "choose") {
    return (
      <div className="min-h-screen bg-background">
        <WelcomeHeader
          name={profile?.full_name || "Student"}
          onLogout={handleLogout}
          badges={userBadges}
        />

        <main className="container mx-auto px-4 py-8 pb-24">
          <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">What's on your mind?</h2>
              <p className="text-muted-foreground text-sm">Choose a section to explore</p>
            </div>

            {/* House & Workout Selection */}
            <div className="grid grid-cols-1 gap-5 w-full max-w-lg mx-auto">
              <HouseSelectionCard />
              <WorkoutSelectionCard />
            </div>

            <div className="grid grid-cols-1 gap-5 w-full max-w-sm mx-auto">
              {/* Co-curricular */}
              <Card
                className="h-full border-2 border-transparent hover:border-secondary/40 cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group bg-gradient-to-br from-secondary/5 via-background to-secondary/5"
                onClick={() => setSection("cocurricular")}
              >
                <CardHeader className="pb-4 text-center">
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Activity className="h-7 w-7 text-secondary" />
                  </div>
                  <CardTitle className="text-lg group-hover:text-secondary transition-colors">
                    Co-curricular
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Activities, messages & preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 text-center">
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-secondary group-hover:gap-2 transition-all">
                    Enter <ArrowRight className="w-4 h-4" />
                  </span>
                </CardContent>
              </Card>
            </div>

            {/* Request Change */}
            <button onClick={() => navigate("/student/request")}
              className="w-full max-w-md flex items-center justify-between rounded-2xl border bg-card px-5 py-4 shadow-sm hover:border-secondary/40 hover:bg-secondary/5 transition-colors text-left group">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-secondary" />
                <div>
                  <p className="font-semibold text-sm">Request a Change</p>
                  <p className="text-xs text-muted-foreground">Swap activities, get excused, or more</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-secondary group-hover:translate-x-0.5 transition-all" />
            </button>

            {/* Set Password */}
            <button onClick={() => navigate("/set-password")}
              className="w-full max-w-md flex items-center justify-between rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/30 px-5 py-3 shadow-sm hover:border-muted-foreground/50 hover:bg-muted/50 transition-all text-left group">
              <div className="flex items-center gap-3">
                <KeyRound className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Set Password</p>
                  <p className="text-xs text-muted-foreground">Enable email &amp; password sign-in</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </main>
        <FloatingChatButton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <WelcomeHeader
        name={profile?.full_name || "Student"}
        onLogout={handleLogout}
        badges={userBadges}
      />

      <main className="container mx-auto px-4 py-8 pb-24">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Switcher bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-secondary" />
              </div>
              <h2 className="text-lg font-bold">Co-curricular</h2>
            </div>
            <button
              onClick={() => setSection("choose")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 bg-muted/50 hover:bg-muted px-3 py-1.5 rounded-lg"
            >
              ← Back
            </button>
          </div>

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
