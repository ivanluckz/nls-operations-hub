import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Calendar, UtensilsCrossed, TrendingUp, Users, Download } from "lucide-react";
import { MEAL_TYPES, type MealType } from "@/lib/constants";

interface MealRecord {
  id: string;
  student_id: string;
  meal_type: MealType;
  meal_date: string;
  scanned_at: string;
  student_name?: string;
}

interface DailySummary {
  date: string;
  breakfast: number;
  lunch: number;
  dinner: number;
  total: number;
}

const mealLabels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

const KitchenReports = () => {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [records, setRecords] = useState<MealRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalStudents, setTotalStudents] = useState(0);

  const fetchTotalStudents = useCallback(async () => {
    const { count } = await supabase
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student");
    setTotalStudents(count || 0);
  }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("meal_attendance")
      .select("id, student_id, meal_type, meal_date, scanned_at")
      .gte("meal_date", startDate)
      .lte("meal_date", endDate)
      .order("meal_date", { ascending: false })
      .order("scanned_at", { ascending: false })
      .limit(2000);

    if (data && data.length > 0) {
      // Fetch student names
      const studentIds: string[] = [...new Set((data as any[]).map((r) => String(r.student_id)))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", studentIds.slice(0, 500));

      const nameMap = new Map((profiles || []).map(p => [p.id, p.full_name]));

      setRecords(
        data.map((r: any) => ({
          ...r,
          student_name: nameMap.get(r.student_id) || "Unknown",
        }))
      );
    } else {
      setRecords([]);
    }
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReports();
    fetchTotalStudents();
  }, [fetchReports, fetchTotalStudents]);

  // Build daily summaries
  const dailySummaries: DailySummary[] = (() => {
    const map = new Map<string, DailySummary>();
    records.forEach((r) => {
      if (!map.has(r.meal_date)) {
        map.set(r.meal_date, { date: r.meal_date, breakfast: 0, lunch: 0, dinner: 0, total: 0 });
      }
      const s = map.get(r.meal_date)!;
      s[r.meal_type]++;
      s.total++;
    });
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  })();

  const totalMeals = records.length;
  const avgPerDay = dailySummaries.length > 0 ? Math.round(totalMeals / dailySummaries.length) : 0;

  const exportCSV = () => {
    const header = "Date,Student,Meal,Scanned At\n";
    const rows = records
      .map((r) => `${r.meal_date},"${r.student_name}",${r.meal_type},${new Date(r.scanned_at).toLocaleTimeString()}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meal-report-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/kitchen")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Meal Reports</h1>
              <p className="text-sm text-muted-foreground">Attendance & cost analysis</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={records.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Date Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Label>From</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="flex-1">
                <Label>To</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <UtensilsCrossed className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{totalMeals}</p>
              <p className="text-sm text-muted-foreground">Total Meals</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <TrendingUp className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{avgPerDay}</p>
              <p className="text-sm text-muted-foreground">Avg/Day</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Calendar className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{dailySummaries.length}</p>
              <p className="text-sm text-muted-foreground">Days</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{totalStudents}</p>
              <p className="text-sm text-muted-foreground">Total Students</p>
            </CardContent>
          </Card>
        </div>

        {/* Daily Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Breakdown</CardTitle>
            <CardDescription>Meals served per day</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : dailySummaries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No meal records in this period</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Breakfast</TableHead>
                    <TableHead className="text-center">Lunch</TableHead>
                    <TableHead className="text-center">Dinner</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailySummaries.map((s) => (
                    <TableRow key={s.date}>
                      <TableCell className="font-medium">
                        {new Date(s.date + "T00:00:00").toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-center">{s.breakfast}</TableCell>
                      <TableCell className="text-center">{s.lunch}</TableCell>
                      <TableCell className="text-center">{s.dinner}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{s.total}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KitchenReports;
