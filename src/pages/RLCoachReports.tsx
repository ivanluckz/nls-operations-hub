import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Calendar, Coffee, Dumbbell, TrendingUp, Users } from "lucide-react";
import { MEAL_TYPES, type MealType } from "@/lib/constants";

interface MealRecord {
  id: string;
  student_id: string;
  meal_type: MealType;
  meal_date: string;
  scanned_at: string;
  student_name?: string;
}

interface WorkoutRecord {
  id: string;
  student_id: string;
  workout_date: string;
  location: string;
  status: string;
  scanned_at: string;
  student_name?: string;
}

const RLCoachReports = () => {
  const navigate = useNavigate();
  const [mealRecords, setMealRecords] = useState<MealRecord[]>([]);
  const [workoutRecords, setWorkoutRecords] = useState<WorkoutRecord[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReports();
  }, [startDate, endDate]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      // Fetch meal records
      const { data: meals } = await (supabase as any)
        .from("meal_attendance")
        .select("id, student_id, meal_type, meal_date, scanned_at")
        .gte("meal_date", startDate)
        .lte("meal_date", endDate)
        .order("meal_date", { ascending: false });

      // Fetch workout records
      const { data: workouts } = await (supabase as any)
        .from("workout_attendance")
        .select("id, student_id, workout_date, location, status, scanned_at")
        .gte("workout_date", startDate)
        .lte("workout_date", endDate)
        .order("workout_date", { ascending: false });

      // Get unique student IDs
      const allStudentIds = new Set<string>();
      (meals || []).forEach((r: any) => allStudentIds.add(r.student_id));
      (workouts || []).forEach((r: any) => allStudentIds.add(r.student_id));

      // Fetch student names
      const studentIds = Array.from(allStudentIds);
      const nameMap: Record<string, string> = {};
      if (studentIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", studentIds);
        (profiles || []).forEach((p) => { nameMap[p.id] = p.full_name; });
      }

      setMealRecords((meals || []).map((r: any) => ({ ...r, student_name: nameMap[r.student_id] || "Unknown" })));
      setWorkoutRecords((workouts || []).map((r: any) => ({ ...r, student_name: nameMap[r.student_id] || "Unknown" })));
    } finally {
      setLoading(false);
    }
  };

  const mealSummary = MEAL_TYPES.reduce((acc, type) => {
    acc[type] = mealRecords.filter(r => r.meal_type === type).length;
    return acc;
  }, {} as Record<MealType, number>);

  return (
    <div className="min-h-screen bg-transparent">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/rl-coach")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-bold">RL Coach Reports</h1>
            <p className="text-sm text-muted-foreground">Meal & Workout Attendance</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Date Range */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium">From</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium">To</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="meals">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="meals"><Coffee className="h-4 w-4 mr-2" /> Meals</TabsTrigger>
            <TabsTrigger value="workouts"><Dumbbell className="h-4 w-4 mr-2" /> Workouts</TabsTrigger>
          </TabsList>

          <TabsContent value="meals" className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-4">
              {MEAL_TYPES.map((type) => (
                <Card key={type}>
                  <CardContent className="pt-6 text-center">
                    <p className="text-2xl font-bold">{mealSummary[type]}</p>
                    <p className="text-sm text-muted-foreground capitalize">{type}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Meal Records</CardTitle>
                <CardDescription>{mealRecords.length} records found</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Meal</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mealRecords.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.student_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{r.meal_type}</Badge>
                          </TableCell>
                          <TableCell>{r.meal_date}</TableCell>
                          <TableCell>{new Date(r.scanned_at).toLocaleTimeString()}</TableCell>
                        </TableRow>
                      ))}
                      {mealRecords.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">No records found</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workouts" className="space-y-4 mt-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <Dumbbell className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{workoutRecords.length}</p>
                <p className="text-sm text-muted-foreground">Total workout check-ins</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Workout Records</CardTitle>
                <CardDescription>{workoutRecords.length} records found</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workoutRecords.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.student_name}</TableCell>
                          <TableCell>{r.location}</TableCell>
                          <TableCell>
                            <Badge variant={r.status === "present" ? "default" : "destructive"} className="capitalize">
                              {r.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{r.workout_date}</TableCell>
                          <TableCell>{new Date(r.scanned_at).toLocaleTimeString()}</TableCell>
                        </TableRow>
                      ))}
                      {workoutRecords.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">No records found</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RLCoachReports;
