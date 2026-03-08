import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, UserPlus, ClipboardCheck, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface FeedItem {
  id: string;
  type: "allocation" | "attendance" | "request";
  text: string;
  time: string;
}

export default function RecentActivityFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const feed: FeedItem[] = [];

      // Recent allocations
      const { data: allocs } = await supabase
        .from("allocations")
        .select("id, allocated_at, day_of_week, activity_id")
        .order("allocated_at", { ascending: false })
        .limit(5);

      (allocs || []).forEach((a) => {
        feed.push({
          id: `alloc-${a.id}`,
          type: "allocation",
          text: `New allocation for ${a.day_of_week}`,
          time: a.allocated_at,
        });
      });

      // Recent attendance sessions
      const { data: sessions } = await supabase
        .from("attendance_sessions")
        .select("id, created_at, day_of_week, status")
        .order("created_at", { ascending: false })
        .limit(5);

      (sessions || []).forEach((s) => {
        feed.push({
          id: `att-${s.id}`,
          type: "attendance",
          text: `Attendance session ${s.status} (${s.day_of_week})`,
          time: s.created_at,
        });
      });

      // Recent student requests
      const { data: requests } = await supabase
        .from("student_requests")
        .select("id, created_at, request_type, status")
        .order("created_at", { ascending: false })
        .limit(5);

      (requests || []).forEach((r) => {
        const type = (r.request_type || "").replace(/_/g, " ");
        feed.push({
          id: `req-${r.id}`,
          type: "request",
          text: `${type} request (${r.status})`,
          time: r.created_at,
        });
      });

      feed.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setItems(feed.slice(0, 8));
    };
    fetch();
  }, []);

  const iconMap = {
    allocation: <UserPlus className="h-3.5 w-3.5 text-violet-500" />,
    attendance: <ClipboardCheck className="h-3.5 w-3.5 text-emerald-500" />,
    request: <FileText className="h-3.5 w-3.5 text-amber-500" />,
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-auto">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="mt-0.5 shrink-0">{iconMap[item.type]}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm capitalize truncate">{item.text}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.time), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
