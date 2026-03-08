import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BarChart3 } from "lucide-react";
import { format, subDays } from "date-fns";

interface DayData {
  day: string;
  present: number;
  absent: number;
  late: number;
}

interface Props {
  title?: string;
  /** Filter by teacher_id on attendance_sessions */
  teacherId?: string;
}

export default function AttendanceChart({ title = "Attendance (Last 7 Days)", teacherId }: Props) {
  const [data, setData] = useState<DayData[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const since = subDays(new Date(), 7).toISOString().split("T")[0];

      // Get sessions in date range
      let sessionsQuery = supabase
        .from("attendance_sessions")
        .select("id, session_date")
        .gte("session_date", since);

      if (teacherId) {
        sessionsQuery = sessionsQuery.eq("teacher_id", teacherId);
      }

      const { data: sessions } = await sessionsQuery;
      if (!sessions || sessions.length === 0) {
        setData(buildEmptyDays());
        return;
      }

      const sessionIds = sessions.map((s) => s.id);
      const { data: records } = await supabase
        .from("attendance_records")
        .select("session_id, status")
        .in("session_id", sessionIds);

      // Map session_id -> date
      const sessionDateMap: Record<string, string> = {};
      sessions.forEach((s) => { sessionDateMap[s.id] = s.session_date; });

      // Aggregate by date
      const dateMap: Record<string, { present: number; absent: number; late: number }> = {};
      (records || []).forEach((r) => {
        const date = sessionDateMap[r.session_id];
        if (!date) return;
        if (!dateMap[date]) dateMap[date] = { present: 0, absent: 0, late: 0 };
        if (r.status === "present") dateMap[date].present++;
        else if (r.status === "absent") dateMap[date].absent++;
        else if (r.status === "late") dateMap[date].late++;
      });

      const days: DayData[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const key = format(d, "yyyy-MM-dd");
        const label = format(d, "EEE");
        days.push({
          day: label,
          present: dateMap[key]?.present || 0,
          absent: dateMap[key]?.absent || 0,
          late: dateMap[key]?.late || 0,
        });
      }
      setData(days);
    };
    fetch();
  }, [teacherId]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.every((d) => d.present === 0 && d.absent === 0 && d.late === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-8">No attendance data this week</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="present" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Present" />
              <Bar dataKey="late" fill="hsl(45 93% 47%)" radius={[4, 4, 0, 0]} name="Late" />
              <Bar dataKey="absent" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Absent" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function buildEmptyDays(): DayData[] {
  const days: DayData[] = [];
  for (let i = 6; i >= 0; i--) {
    days.push({ day: format(subDays(new Date(), i), "EEE"), present: 0, absent: 0, late: 0 });
  }
  return days;
}
