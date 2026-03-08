import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { QrCode, UtensilsCrossed, Users, BarChart3, LogOut, Sun, Coffee, Moon } from "lucide-react";
import { MEAL_TYPES, type MealType } from "@/lib/constants";
import { QR_SCAN_COOLDOWN_MS } from "@/lib/constants";
import QRScanner from "@/components/attendance/QRScanner";
import { ThemeToggle } from "@/components/ui/theme-toggle";

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

const KitchenDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<MealType | null>(null);
  const [scanning, setScanning] = useState(false);
  const [todayCounts, setTodayCounts] = useState<Record<MealType, number>>({ breakfast: 0, lunch: 0, dinner: 0 });
  const [lastScanned, setLastScanned] = useState<{ name: string; meal: string } | null>(null);
  const [totalStudents, setTotalStudents] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
    fetchTodayCounts();
    fetchTotalStudents();
  }, []);

  const fetchTotalStudents = async () => {
    const { count } = await supabase
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student");
    setTotalStudents(count || 0);
  };

  const fetchTodayCounts = async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await (supabase as any)
      .from("meal_attendance")
      .select("meal_type")
      .eq("meal_date", today);

    const counts: Record<MealType, number> = { breakfast: 0, lunch: 0, dinner: 0 };
    (data || []).forEach((r: any) => {
      if (r.meal_type in counts) counts[r.meal_type as MealType]++;
    });
    setTodayCounts(counts);
  };

  const handleScan = useCallback(async (studentId: string) => {
    if (!selectedMeal || !userId) return;

    const today = new Date().toISOString().split("T")[0];

    // Check if already scanned
    const { data: existing } = await (supabase as any)
      .from("meal_attendance")
      .select("id")
      .eq("student_id", studentId)
      .eq("meal_type", selectedMeal)
      .eq("meal_date", today)
      .maybeSingle();

    if (existing) {
      // Get student name for message
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

    // Get student name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", studentId)
      .single();

    setLastScanned({ name: profile?.full_name || "Student", meal: mealLabels[selectedMeal] });
    toast({
      title: "✅ Checked in!",
      description: `${profile?.full_name || "Student"} → ${mealLabels[selectedMeal]}`,
    });

    fetchTodayCounts();
  }, [selectedMeal, userId, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // If scanning mode
  if (scanning && selectedMeal) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scanning: {mealLabels[selectedMeal]}
            </h2>
            <Button variant="outline" onClick={() => setScanning(false)}>
              Done
            </Button>
          </div>

          {lastScanned && (
            <Card className="border-green-500 bg-green-500/10">
              <CardContent className="py-3 text-center">
                <p className="text-lg font-semibold text-green-700 dark:text-green-400">
                  ✅ {lastScanned.name}
                </p>
                <p className="text-sm text-muted-foreground">Checked in for {lastScanned.meal}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <QRScanner
                onScan={(result) => {
                  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                  if (uuidRegex.test(result)) {
                    handleScan(result);
                  }
                }}
                isActive={true}
                scanMode="continuous"
              />
            </CardContent>
          </Card>

          <div className="text-center">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {todayCounts[selectedMeal]} checked in today
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UtensilsCrossed className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Kitchen Dashboard</h1>
              <p className="text-sm text-muted-foreground">Meal Attendance Tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={() => navigate("/kitchen/reports")}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Reports
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Today's Summary */}
        <div className="grid grid-cols-3 gap-4">
          {MEAL_TYPES.map((meal) => {
            const Icon = mealIcons[meal];
            return (
              <Card key={meal}>
                <CardContent className="pt-6 text-center">
                  <Icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold">{todayCounts[meal]}</p>
                  <p className="text-sm text-muted-foreground">{mealLabels[meal]}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    of {totalStudents} students
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Scan Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scan Student QR Codes
            </CardTitle>
            <CardDescription>
              Select a meal type, then start scanning student QR codes
            </CardDescription>
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
              onClick={() => setScanning(true)}
            >
              <QrCode className="h-5 w-5 mr-2" />
              {selectedMeal ? `Start Scanning for ${mealLabels[selectedMeal]}` : "Select a meal first"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KitchenDashboard;
