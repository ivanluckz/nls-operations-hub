import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle } from "lucide-react";

interface ActivityCapacity {
  id: string;
  title: string;
  capacity: number;
  current_enrollment: number;
}

const CapacityAlerts = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<ActivityCapacity[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("activities")
        .select("id, title, capacity, current_enrollment")
        .eq("is_active", true);
      if (!data) return;
      const nearFull = data
        .filter(a => a.capacity > 0 && a.current_enrollment >= a.capacity * 0.9)
        .sort((a, b) => b.current_enrollment / b.capacity - a.current_enrollment / a.capacity);
      setAlerts(nearFull);
    };
    fetch();
  }, []);

  if (alerts.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Capacity Alerts
          <span className="text-xs font-normal text-muted-foreground">({alerts.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.slice(0, 8).map(a => {
          const pct = Math.round((a.current_enrollment / a.capacity) * 100);
          const isOver = pct >= 100;
          return (
            <div
              key={a.id}
              className="cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
              onClick={() => navigate("/admin/co-curricular/activity-roster")}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium truncate flex-1">{a.title}</span>
                <span className={`text-xs font-semibold ml-2 ${isOver ? "text-red-500" : "text-amber-500"}`}>
                  {a.current_enrollment}/{a.capacity}
                </span>
              </div>
              <Progress
                value={Math.min(pct, 100)}
                className={`h-2 ${isOver ? "[&>div]:bg-red-500" : "[&>div]:bg-amber-500"}`}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default CapacityAlerts;
