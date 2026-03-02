import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Send, Loader2, Clock, CheckCircle2, XCircle, ArrowRightLeft, Calendar, Trash2, HelpCircle } from "lucide-react";
import WelcomeHeader from "@/components/student/WelcomeHeader";
import FloatingChatButton from "@/components/student/FloatingChatButton";

interface Allocation {
  activity_id: string;
  day_of_week: string;
  slot_number: number;
  activities: { id: string; title: string; category: string };
}

interface Activity {
  id: string;
  title: string;
  category: string;
  capacity: number;
  current_enrollment: number;
  days_of_week: string[];
}

interface StudentRequest {
  id: string;
  request_type: string;
  details: any;
  reason: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const REQUEST_TYPES = [
  { value: "swap_activity", label: "Swap Activity", icon: ArrowRightLeft, description: "Change from one activity to another" },
  { value: "excuse", label: "Get Excused", icon: Calendar, description: "Request excusal from an activity" },
  { value: "drop_activity", label: "Drop Activity", icon: Trash2, description: "Remove yourself from an activity" },
  { value: "other", label: "Other", icon: HelpCircle, description: "Any other request" },
];

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  approved: { label: "Approved", variant: "default", icon: CheckCircle2 },
  denied: { label: "Denied", variant: "destructive", icon: XCircle },
};

const StudentRequests = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const [userBadges, setUserBadges] = useState<string[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [requests, setRequests] = useState<StudentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [requestType, setRequestType] = useState("");
  const [currentActivityId, setCurrentActivityId] = useState("");
  const [desiredActivityId, setDesiredActivityId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("");
  const [excuseDate, setExcuseDate] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    fetchData();
    // Realtime subscription for request status updates
    const channel = supabase
      .channel("student-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "student_requests" }, () => {
        fetchRequests();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: profileData }, { data: allocData }, { data: actData }, { data: badgeData }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).single(),
        supabase.from("allocations").select("activity_id, day_of_week, slot_number, activities(id, title, category)").eq("student_id", user.id),
        supabase.from("activities").select("id, title, category, capacity, current_enrollment, days_of_week").eq("is_active", true),
        (supabase as any).from("user_badges").select("badge_name").eq("user_id", user.id).limit(20),
      ]);

      setProfile(profileData);
      setAllocations((allocData as Allocation[] || []).filter(a => a.activities != null));
      setAllActivities(actData || []);
      setUserBadges((badgeData || []).map((b: any) => b.badge_name));
      await fetchRequests();
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await (supabase as any)
      .from("student_requests")
      .select("id, request_type, details, reason, status, admin_notes, created_at")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setRequests(data || []);
  };

  const handleSubmit = async () => {
    if (!requestType || !reason.trim()) {
      toast({ variant: "destructive", title: "Missing fields", description: "Please select a request type and provide a reason." });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const details: any = {};
      if (requestType === "swap_activity") {
        if (!currentActivityId || !desiredActivityId) {
          toast({ variant: "destructive", title: "Missing fields", description: "Please select both current and desired activities." });
          setSubmitting(false);
          return;
        }
        details.current_activity_id = currentActivityId;
        details.desired_activity_id = desiredActivityId;
        details.day_of_week = dayOfWeek || undefined;
        details.current_activity_name = allocations.find(a => a.activity_id === currentActivityId)?.activities.title;
        details.desired_activity_name = allActivities.find(a => a.id === desiredActivityId)?.title;
      } else if (requestType === "excuse") {
        if (!currentActivityId) {
          toast({ variant: "destructive", title: "Missing fields", description: "Please select an activity." });
          setSubmitting(false);
          return;
        }
        details.activity_id = currentActivityId;
        details.activity_name = allocations.find(a => a.activity_id === currentActivityId)?.activities.title;
        details.excuse_date = excuseDate || undefined;
      } else if (requestType === "drop_activity") {
        if (!currentActivityId) {
          toast({ variant: "destructive", title: "Missing fields", description: "Please select an activity to drop." });
          setSubmitting(false);
          return;
        }
        details.activity_id = currentActivityId;
        details.activity_name = allocations.find(a => a.activity_id === currentActivityId)?.activities.title;
      }

      const { error } = await (supabase as any).from("student_requests").insert({
        student_id: user.id,
        request_type: requestType,
        details,
        reason: reason.trim(),
        status: "pending",
      });

      if (error) throw error;

      toast({ title: "Request submitted", description: "Your request has been sent to the admin for review." });
      resetForm();
      await fetchRequests();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to submit request" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setRequestType("");
    setCurrentActivityId("");
    setDesiredActivityId("");
    setDayOfWeek("");
    setExcuseDate("");
    setReason("");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const uniqueAllocations = allocations.reduce((acc, alloc) => {
    if (!acc.find(a => a.activity_id === alloc.activity_id)) acc.push(alloc);
    return acc;
  }, [] as Allocation[]);

  return (
    <div className="min-h-screen bg-background">
      <WelcomeHeader name={profile?.full_name || "Student"} onLogout={handleLogout} badges={userBadges} />

      <main className="container mx-auto px-4 py-8 pb-24">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Back button */}
          <button onClick={() => navigate("/student")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">Request a Change</h1>
            <p className="text-muted-foreground text-sm mt-1">Submit a request to your co-curricular advisor</p>
          </div>

          {/* Request Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">New Request</CardTitle>
              <CardDescription>Choose what you'd like to change</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Type selector */}
              <div className="grid grid-cols-2 gap-3">
                {REQUEST_TYPES.map((type) => {
                  const isSelected = requestType === type.value;
                  return (
                    <button
                      key={type.value}
                      onClick={() => { setRequestType(type.value); setCurrentActivityId(""); setDesiredActivityId(""); }}
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                      }`}
                    >
                      <type.icon className={`w-5 h-5 mt-0.5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      <div>
                        <p className="font-medium text-sm">{type.label}</p>
                        <p className="text-xs text-muted-foreground">{type.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Conditional fields */}
              {requestType === "swap_activity" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Current Activity</Label>
                    <Select value={currentActivityId} onValueChange={setCurrentActivityId}>
                      <SelectTrigger><SelectValue placeholder="Select your current activity" /></SelectTrigger>
                      <SelectContent>
                        {uniqueAllocations.map((a) => (
                          <SelectItem key={a.activity_id} value={a.activity_id}>{a.activities.title} ({a.day_of_week})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Desired Activity</Label>
                    <Select value={desiredActivityId} onValueChange={setDesiredActivityId}>
                      <SelectTrigger><SelectValue placeholder="Select the activity you want" /></SelectTrigger>
                      <SelectContent>
                        {allActivities.filter(a => a.id !== currentActivityId).map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.title} ({a.current_enrollment}/{a.capacity})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {requestType === "excuse" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Activity</Label>
                    <Select value={currentActivityId} onValueChange={setCurrentActivityId}>
                      <SelectTrigger><SelectValue placeholder="Select activity" /></SelectTrigger>
                      <SelectContent>
                        {uniqueAllocations.map((a) => (
                          <SelectItem key={a.activity_id} value={a.activity_id}>{a.activities.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date (optional)</Label>
                    <input
                      type="date"
                      value={excuseDate}
                      onChange={(e) => setExcuseDate(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
              )}

              {requestType === "drop_activity" && (
                <div className="space-y-2">
                  <Label>Activity to Drop</Label>
                  <Select value={currentActivityId} onValueChange={setCurrentActivityId}>
                    <SelectTrigger><SelectValue placeholder="Select activity" /></SelectTrigger>
                    <SelectContent>
                      {uniqueAllocations.map((a) => (
                        <SelectItem key={a.activity_id} value={a.activity_id}>{a.activities.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Reason - always shown when type selected */}
              {requestType && (
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explain why you're making this request..."
                    maxLength={500}
                    className="min-h-[100px]"
                  />
                  <p className="text-xs text-muted-foreground text-right">{reason.length}/500</p>
                </div>
              )}

              {requestType && (
                <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Submit Request
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Past Requests */}
          {requests.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Your Requests</h2>
              <div className="space-y-3">
                {requests.map((req) => {
                  const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                  const StatusIcon = statusCfg.icon;
                  const typeLabel = REQUEST_TYPES.find(t => t.value === req.request_type)?.label || req.request_type;

                  return (
                    <Card key={req.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{typeLabel}</span>
                              <Badge variant={statusCfg.variant} className="text-xs gap-1">
                                <StatusIcon className="w-3 h-3" />
                                {statusCfg.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{req.reason}</p>
                            {req.admin_notes && (
                              <div className="mt-2 p-2 bg-muted/50 rounded-lg">
                                <p className="text-xs font-medium text-muted-foreground">Admin response:</p>
                                <p className="text-sm">{req.admin_notes}</p>
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(req.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
      <FloatingChatButton />
    </div>
  );
};

export default StudentRequests;
