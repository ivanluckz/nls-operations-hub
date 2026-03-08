import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { UtensilsCrossed } from "lucide-react";
import { format, subDays } from "date-fns";

interface DayData {
  day: string;
  breakfast: number;
  lunch: number;
  dinner: number;
}

export default function MealTrendChart() {
  const [data, setData] = useState<DayData[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const since = subDays(new Date(), 7).toISOString().split("T")[0];
      const { data: meals } = await (supabase as any)
        .from("meal_attendance")
        .select("meal_type, meal_date")
        .gte("meal_date", since);

      const dateMap: Record<string, Record<string, number>> = {};
      (meals || []).forEach((m: any) => {
        if (!dateMap[m.meal_date]) dateMap[m.meal_date] = { breakfast: 0, lunch: 0, dinner: 0 };
        if (m.meal_type in dateMap[m.meal_date]) dateMap[m.meal_date][m.meal_type]++;
      });

      const days: DayData[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const key = format(d, "yyyy-MM-dd");
        days.push({
          day: format(d, "EEE"),
          breakfast: dateMap[key]?.breakfast || 0,
          lunch: dateMap[key]?.lunch || 0,
          dinner: dateMap[key]?.dinner || 0,
        });
      }
      setData(days);
    };
    fetch();
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4 text-primary" />
          Meal Trends (Last 7 Days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.every((d) => d.breakfast === 0 && d.lunch === 0 && d.dinner === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-8">No meal data this week</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend />
              <Bar dataKey="breakfast" fill="hsl(25 95% 53%)" radius={[4, 4, 0, 0]} name="Breakfast" />
              <Bar dataKey="lunch" fill="hsl(45 93% 47%)" radius={[4, 4, 0, 0]} name="Lunch" />
              <Bar dataKey="dinner" fill="hsl(250 60% 55%)" radius={[4, 4, 0, 0]} name="Dinner" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
