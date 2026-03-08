import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock } from "lucide-react";

interface TodayActivity {
  id: string;
  title: string;
  category: string;
  schedule: string;
  teacher_in_charge: string;
  current_enrollment: number;
  capacity: number;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const categoryColors: Record<string, string> = {
  sports: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  arts: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  academic: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  music: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  default: "bg-muted text-muted-foreground",
};

export default function TodayScheduleWidget() {
  const [activities, setActivities] = useState<TodayActivity[]>([]);
  const today = DAY_NAMES[new Date().getDay()];

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("activities")
        .select("id, title, category, schedule, teacher_in_charge, current_enrollment, capacity")
        .eq("is_active", true)
        .contains("days_of_week", [today]);
      setActivities(data || []);
    };
    fetch();
  }, [today]);

  if (today === "Saturday" || today === "Sunday") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Today's Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">🎉 No activities today — it's the weekend!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          Today's Schedule
          <Badge variant="outline" className="ml-auto text-xs">{today}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No activities scheduled for today</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-auto">
            {activities.map((a) => {
              const colorClass = categoryColors[a.category.toLowerCase()] || categoryColors.default;
              return (
                <div key={a.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="secondary" className={`text-[10px] shrink-0 ${colorClass}`}>
                      {a.category}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {a.schedule} · {a.teacher_in_charge}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {a.current_enrollment}/{a.capacity}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
