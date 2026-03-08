import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  QrCode, Users, LogOut, Sun, Coffee, Moon, Dumbbell,
  MapPin, BarChart3, AlertTriangle, CheckCircle2, Flag
} from "lucide-react";
import { MEAL_TYPES, WORKOUT_LOCATIONS, type MealType, type WorkoutLocation } from "@/lib/constants";
import MealTrendChart from "@/components/dashboard/MealTrendChart";
import MealQRScanner from "@/components/kitchen/MealQRScanner";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const mealIcons: Record<MealType, typeof Coffee> = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
};

const mealLabels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

const locationIcons: Record<WorkoutLocation, string> = {
  Courts: "🏀",
  Pitch: "⚽",
  Competition: "🏆",
};

const RLCoachDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);

  // Meal state
  const [selectedMeal, setSelectedMeal] = useState<MealType | null>(null);
  const [mealScanning, setMealScanning] = useState(false);
  const [mealCounts, setMealCounts] = useState<Record<MealType, number>>({ breakfast: 0, lunch: 0, dinner: 0 });
  const [lastMealScanned, setLastMealScanned] = useState<{ name: string; meal: string } | null>(null);

  // Workout state
  const [selectedLocation, setSelectedLocation] = useState<WorkoutLocation>("Courts");
  const [workoutScanning, setWorkoutScanning] = useState(false);
  const [workoutCount, setWorkoutCount] = useState(0);
  const [lastWorkoutScanned, setLastWorkoutScanned] = useState<{ name: string; location: string } | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [absentStudents, setAbsentStudents] = useState<Array<{ id: string; name: string }>>([]);
  const [flaggedStudents, setFlaggedStudents] = useState<Array<{ id: string; name: string; absent_count: number; late_count: number }>>([]);
  const [restrictedStudents, setRestrictedStudents] = useState<Array<{ id: string; name: string; reason: string | null }>>([]);

  const [totalStudents, setTotalStudents] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
    fetchMealCounts();
    fetchWorkoutCount();
    fetchTotalStudents();
    fetchFlaggedStudents();
    fetchRestrictedStudents();
  }, []);

  const fetchTotalStudents = async () => {
    const { count } = await supabase
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student");
    setTotalStudents(count || 0);
  };

  const fetchMealCounts = async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await (supabase as any)
      .from("meal_attendance")
      .select("meal_type")
      .eq("meal_date", today);

    const counts: Record<MealType, number> = { breakfast: 0, lunch: 0, dinner: 0 };
    (data || []).forEach((r: any) => {
      if (r.meal_type in counts) counts[r.meal_type as MealType]++;
    });
    setMealCounts(counts);
  };

  const fetchWorkoutCount = async () => {
    const today = new Date().toISOString().split("T")[0];
    const { count } = await (supabase as any)
      .from("workout_attendance")
      .select("id", { count: "exact", head: true })
      .eq("workout_date", today);
    setWorkoutCount(count || 0);
  };

  const fetchFlaggedStudents = async () => {
    // Get last 14 days of workout notifications (absent/late)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const sinceDate = twoWeeksAgo.toISOString().split("T")[0];

    const { data: notifications } = await (supabase as any)
      .from("workout_notifications")
      .select("student_id, status")
      .gte("workout_date", sinceDate);

    if (!notifications || notifications.length === 0) {
      setFlaggedStudents([]);
      return;
    }

    // Count per student
    const counts: Record<string, { absent: number; late: number }> = {};
    notifications.forEach((n: any) => {
      if (!counts[n.student_id]) counts[n.student_id] = { absent: 0, late: 0 };
      if (n.status === "absent") counts[n.student_id].absent++;
      if (n.status === "late") counts[n.student_id].late++;
    });

    // Flag students with 3+ absences or 5+ late
    const flaggedIds = Object.entries(counts)
      .filter(([, c]) => c.absent >= 3 || c.late >= 5)
      .map(([id, c]) => ({ id, absent_count: c.absent, late_count: c.late }));

    if (flaggedIds.length === 0) {
      setFlaggedStudents([]);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", flaggedIds.map(f => f.id));

    const nameMap: Record<string, string> = {};
    (profiles || []).forEach(p => { nameMap[p.id] = p.full_name; });

    setFlaggedStudents(flaggedIds.map(f => ({
      ...f,
      name: nameMap[f.id] || "Unknown",
    })));
  };

  const fetchRestrictedStudents = async () => {
    const { data } = await (supabase as any)
      .from("workout_clearances")
      .select("student_id, restriction_reason")
      .eq("status", "restricted");

    if (!data || data.length === 0) {
      setRestrictedStudents([]);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", data.map((d: any) => d.student_id));

    const nameMap: Record<string, string> = {};
    (profiles || []).forEach(p => { nameMap[p.id] = p.full_name; });

    setRestrictedStudents(data.map((d: any) => ({
      id: d.student_id,
      name: nameMap[d.student_id] || "Unknown",
      reason: d.restriction_reason,
    })));
  };

  const finalizeWorkout = async () => {
    if (!userId) return;
    setFinalizing(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      // Get all students
      const { data: allStudentRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");

      const allStudentIds = (allStudentRoles || []).map(r => r.user_id);

      // Get students who checked in today
      const { data: checkedIn } = await (supabase as any)
        .from("workout_attendance")
        .select("student_id")
        .eq("workout_date", today);

      const checkedInIds = new Set((checkedIn || []).map((r: any) => r.student_id));

      // Get medically restricted students
      const { data: restricted } = await (supabase as any)
        .from("workout_clearances")
        .select("student_id")
        .eq("status", "restricted");

      const restrictedIds = new Set((restricted || []).map((r: any) => r.student_id));

      // Absent = not checked in AND not medically restricted
      const absentIds = allStudentIds.filter(id => !checkedInIds.has(id) && !restrictedIds.has(id));

      if (absentIds.length === 0) {
        toast({ title: "All Clear! ✅", description: "All students are accounted for" });
        setFinalizing(false);
        return;
      }

      // Insert notifications for absent students
      const notifications = absentIds.map(id => ({
        student_id: id,
        workout_date: today,
        status: "absent",
      }));

      const { error } = await (supabase as any)
        .from("workout_notifications")
        .upsert(notifications, { onConflict: "student_id,workout_date" });

      if (error) throw error;

      // Get names
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", absentIds);

      const absentList = (profiles || []).map(p => ({ id: p.id, name: p.full_name }));
      setAbsentStudents(absentList);

      toast({
        title: `⚠️ ${absentIds.length} Student${absentIds.length > 1 ? "s" : ""} Absent`,
        description: "Notifications created for absent students",
        variant: "destructive",
      });

      fetchFlaggedStudents();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setFinalizing(false);
    }
  };

  const handleMealScan = useCallback(async (studentId: string) => {
    if (!selectedMeal || !userId) return;
    const today = new Date().toISOString().split("T")[0];

    const { data: existing } = await (supabase as any)
      .from("meal_attendance")
      .select("id")
      .eq("student_id", studentId)
      .eq("meal_type", selectedMeal)
      .eq("meal_date", today)
      .maybeSingle();

    if (existing) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", studentId)
        .single();
      toast({
        title: "Already checked in",
        description: `${profile?.full_name || "Student"} already checked in for ${mealLabels[selectedMeal]}`,
        variant: "destructive",
      });
      return;
    }

    const { error } = await (supabase as any)
      .from("meal_attendance")
      .insert({
        student_id: studentId,
        scanned_by: userId,
        meal_type: selectedMeal,
        meal_date: today,
      });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", studentId)
      .single();

    setLastMealScanned({ name: profile?.full_name || "Student", meal: mealLabels[selectedMeal] });
    toast({
      title: "✅ Checked in!",
      description: `${profile?.full_name || "Student"} → ${mealLabels[selectedMeal]}`,
    });
    fetchMealCounts();
  }, [selectedMeal, userId, toast]);

  const handleWorkoutScan = useCallback(async (studentId: string) => {
    if (!userId) return;
    const today = new Date().toISOString().split("T")[0];

    const { data: existing } = await (supabase as any)
      .from("workout_attendance")
      .select("id")
      .eq("student_id", studentId)
      .eq("workout_date", today)
      .maybeSingle();

    if (existing) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", studentId)
        .single();
      toast({
        title: "Already recorded",
        description: `${profile?.full_name || "Student"} already has workout attendance today`,
        variant: "destructive",
      });
      return;
    }

    const { error } = await (supabase as any)
      .from("workout_attendance")
      .insert({
        student_id: studentId,
        scanned_by: userId,
        workout_date: today,
        location: selectedLocation,
        status: "present",
      });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", studentId)
      .single();

    setLastWorkoutScanned({ name: profile?.full_name || "Student", location: selectedLocation });
    toast({
      title: "✅ Workout recorded!",
      description: `${profile?.full_name || "Student"} → ${selectedLocation}`,
    });
    fetchWorkoutCount();
  }, [selectedLocation, userId, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // Meal scanning view
  if (mealScanning && selectedMeal) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scanning: {mealLabels[selectedMeal]}
            </h2>
            <Button variant="outline" onClick={() => setMealScanning(false)}>Done</Button>
          </div>
          {lastMealScanned && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-3 text-center">
                <p className="text-lg font-semibold text-primary">✅ {lastMealScanned.name}</p>
                <p className="text-sm text-muted-foreground">Checked in for {lastMealScanned.meal}</p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-4">
              <MealQRScanner onScan={handleMealScan} isActive={true} />
            </CardContent>
          </Card>
          <div className="text-center">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {mealCounts[selectedMeal]} checked in today
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  // Workout scanning view
  if (workoutScanning) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Dumbbell className="h-5 w-5" />
              Workout: {selectedLocation}
            </h2>
            <Button variant="outline" onClick={() => setWorkoutScanning(false)}>Done</Button>
          </div>
          {lastWorkoutScanned && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-3 text-center">
                <p className="text-lg font-semibold text-primary">✅ {lastWorkoutScanned.name}</p>
                <p className="text-sm text-muted-foreground">At {lastWorkoutScanned.location}</p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-4">
              <MealQRScanner onScan={handleWorkoutScan} isActive={true} />
            </CardContent>
          </Card>
          <div className="text-center">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {workoutCount} recorded today
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-gradient-to-r from-emerald-500/5 via-background to-emerald-500/5">
        <div className="container mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
              <Dumbbell className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">RL Coach Dashboard</h1>
              <p className="text-sm text-muted-foreground">Meals & morning workouts</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={() => navigate("/rl-coach/reports")} className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Reports
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="meals" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="meals" className="gap-2">
              <Coffee className="h-4 w-4" />
              Meals
            </TabsTrigger>
            <TabsTrigger value="workouts" className="gap-2">
              <Dumbbell className="h-4 w-4" />
              Morning Workouts
            </TabsTrigger>
          </TabsList>

          {/* MEALS TAB */}
          <TabsContent value="meals" className="space-y-6">
            {/* Today's meal summary */}
            <div className="grid grid-cols-3 gap-4">
              {MEAL_TYPES.map((meal) => {
                const Icon = mealIcons[meal];
                return (
                  <Card key={meal}>
                    <CardContent className="pt-6 text-center">
                      <Icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <p className="text-2xl font-bold">{mealCounts[meal]}</p>
                      <p className="text-sm text-muted-foreground">{mealLabels[meal]}</p>
                      <p className="text-xs text-muted-foreground mt-1">of {totalStudents} students</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Meal Trend Chart */}
            <MealTrendChart />

            {/* Scan Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  Scan Student QR Codes
                </CardTitle>
                <CardDescription>Select a meal type, then start scanning</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {MEAL_TYPES.map((meal) => {
                    const Icon = mealIcons[meal];
                    const isSelected = selectedMeal === meal;
                    return (
                      <Button
                        key={meal}
                        variant={isSelected ? "default" : "outline"}
                        className="h-20 flex-col gap-2"
                        onClick={() => setSelectedMeal(meal)}
                      >
                        <Icon className="h-6 w-6" />
                        {mealLabels[meal]}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  size="lg"
                  className="w-full"
                  disabled={!selectedMeal}
                  onClick={() => setMealScanning(true)}
                >
                  <QrCode className="h-5 w-5 mr-2" />
                  {selectedMeal ? `Start Scanning for ${mealLabels[selectedMeal]}` : "Select a meal first"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WORKOUTS TAB */}
          <TabsContent value="workouts" className="space-y-6">
            {/* Today's workout summary */}
            <div className="grid grid-cols-3 gap-4">
              {WORKOUT_LOCATIONS.map((loc) => (
                <Card key={loc}>
                  <CardContent className="pt-6 text-center">
                    <span className="text-3xl block mb-2">{locationIcons[loc]}</span>
                    <p className="text-lg font-bold">{loc}</p>
                    <p className="text-xs text-muted-foreground">Location</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className="pt-6 text-center">
                <Dumbbell className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{workoutCount}</p>
                <p className="text-sm text-muted-foreground">Total checked in today</p>
                <p className="text-xs text-muted-foreground">of {totalStudents} students</p>
              </CardContent>
            </Card>

            {/* Medical Restrictions */}
            {restrictedStudents.length > 0 && (
              <Card className="border-destructive/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Medically Restricted ({restrictedStudents.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {restrictedStudents.map((s) => (
                      <Badge key={s.id} variant="destructive" className="text-xs">
                        {s.name} {s.reason ? `— ${s.reason}` : ""}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Scan Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  Morning Workout Check-in
                </CardTitle>
                <CardDescription>Select location, then scan student QR codes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Location</label>
                  <Select
                    value={selectedLocation}
                    onValueChange={(v) => setSelectedLocation(v as WorkoutLocation)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WORKOUT_LOCATIONS.map((loc) => (
                        <SelectItem key={loc} value={loc}>
                          {locationIcons[loc]} {loc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => setWorkoutScanning(true)}
                >
                  <QrCode className="h-5 w-5 mr-2" />
                  Start Scanning for {selectedLocation}
                </Button>
              </CardContent>
            </Card>

            {/* Finalize & Absent */}
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600">
                  <CheckCircle2 className="h-5 w-5" />
                  Finalize Workout Session
                </CardTitle>
                <CardDescription>
                  Mark all un-scanned students as absent and send notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="destructive"
                  size="lg"
                  className="w-full"
                  onClick={finalizeWorkout}
                  disabled={finalizing}
                >
                  {finalizing ? "Processing..." : "Finalize & Notify Absences"}
                </Button>

                {absentStudents.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">
                      ⚠️ {absentStudents.length} absent student{absentStudents.length > 1 ? "s" : ""}:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {absentStudents.map((s) => (
                        <Badge key={s.id} variant="outline" className="text-xs border-destructive text-destructive">
                          {s.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Flagged Students */}
            {flaggedStudents.length > 0 && (
              <Card className="border-orange-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-600">
                    <Flag className="h-5 w-5" />
                    Flagged Students (Last 14 Days)
                  </CardTitle>
                  <CardDescription>Students with 3+ absences or 5+ late arrivals</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {flaggedStudents.map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                        <span className="font-medium text-sm">{s.name}</span>
                        <div className="flex gap-2">
                          {s.absent_count > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {s.absent_count} absent
                            </Badge>
                          )}
                          {s.late_count > 0 && (
                            <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                              {s.late_count} late
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RLCoachDashboard;
