import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, Check, X, Clock } from "lucide-react";

const BADGE_OPTIONS = [
  { name: "Growing", emoji: "🌱" },
  { name: "Star Student", emoji: "⭐" },
  { name: "Leader", emoji: "👑" },
  { name: "On Fire", emoji: "🔥" },
  { name: "Creative", emoji: "💡" },
  { name: "Team Player", emoji: "🤝" },
];

interface BadgeRequest {
  id: string;
  student_id: string;
  badge_name: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  student_name?: string;
}

const AdminBadgeRequests = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<BadgeRequest[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { fetchRequests(); }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("badge_requests")
        .select("*")
        .eq("target_admin_id", user.id)
        .order("created_at", { ascending: false });

      if (data) {
        const studentIds = [...new Set(data.map(r => r.student_id))];
        const { data: profiles } = await supabase
          .from("profiles").select("id, full_name").in("id", studentIds);
        const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

        setRequests(data.map(r => ({
          ...r,
          status: r.status as "pending" | "approved" | "rejected",
          student_name: profileMap.get(r.student_id) || "Unknown",
        })));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (req: BadgeRequest) => {
    setActionLoading(req.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Update request status
      const { error: updateError } = await supabase
        .from("badge_requests")
        .update({ status: "approved", reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
        .eq("id", req.id);
      if (updateError) throw updateError;

      // Award the badge (upsert to handle duplicates)
      const { error: badgeError } = await supabase
        .from("user_badges")
        .upsert({ user_id: req.student_id, badge_name: req.badge_name, awarded_by: user?.id }, { onConflict: "user_id,badge_name" });
      if (badgeError) throw badgeError;

      toast({ title: "Badge approved!", description: `${req.student_name} now has the ${req.badge_name} badge.` });
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: "approved" } : r));
    } catch {
      toast({ variant: "destructive", title: "Failed to approve badge" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (req: BadgeRequest) => {
    setActionLoading(req.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("badge_requests")
        .update({ status: "rejected", reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
        .eq("id", req.id);
      if (error) throw error;

      toast({ title: "Request rejected" });
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: "rejected" } : r));
    } catch {
      toast({ variant: "destructive", title: "Failed to reject request" });
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = requests.filter(r => r.status === filter);
  const pendingCount = requests.filter(r => r.status === "pending").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Award className="h-6 w-6 text-primary" /> Badge Requests
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Review and approve student badge requests</p>
          </div>
          {pendingCount > 0 && (
            <Badge className="text-sm px-3 py-1">{pendingCount} pending</Badge>
          )}
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Pending
              {pendingCount > 0 && <Badge className="h-4 min-w-[16px] text-[10px] px-1 ml-0.5">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-1.5">
              <Check className="h-3.5 w-3.5" /> Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-1.5">
              <X className="h-3.5 w-3.5" /> Rejected
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading requests...</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No {filter} requests.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((req) => {
              const badgeOpt = BADGE_OPTIONS.find(b => b.name === req.badge_name);
              const isActing = actionLoading === req.id;

              return (
                <Card key={req.id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{badgeOpt?.emoji || "🏅"}</span>
                        <div>
                          <CardTitle className="text-base">{req.badge_name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{req.student_name}</p>
                        </div>
                      </div>
                      <Badge
                        variant={req.status === "approved" ? "default" : req.status === "rejected" ? "destructive" : "secondary"}
                        className="text-xs capitalize flex-shrink-0"
                      >
                        {req.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col gap-3">
                    <div className="bg-muted/50 rounded-md p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Reason</p>
                      <p className="text-sm">{req.reason}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-auto">
                      {new Date(req.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    {req.status === "pending" && (
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" className="flex-1 gap-1.5" onClick={() => handleApprove(req)} disabled={isActing}>
                          <Check className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-destructive hover:text-destructive" onClick={() => handleReject(req)} disabled={isActing}>
                          <X className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminBadgeRequests;
