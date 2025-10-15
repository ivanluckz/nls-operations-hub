import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ManualAllocationInputSchema } from "@/lib/validation";

interface Student {
  id: string;
  full_name: string;
  email: string;
}

interface Activity {
  id: string;
  title: string;
  capacity: number;
  days_of_week: string[];
  current_enrollment: number;
}

interface Preference {
  student_id: string;
  monday_first_choice: string | null;
  monday_second_choice: string | null;
  monday_third_choice: string | null;
  monday_fourth_choice: string | null;
  monday_fifth_choice: string | null;
  tuesday_first_choice: string | null;
  tuesday_second_choice: string | null;
  tuesday_third_choice: string | null;
  tuesday_fourth_choice: string | null;
  tuesday_fifth_choice: string | null;
  wednesday_slot1_first_choice: string | null;
  wednesday_slot1_second_choice: string | null;
  wednesday_slot1_third_choice: string | null;
  wednesday_slot1_fourth_choice: string | null;
  wednesday_slot1_fifth_choice: string | null;
  wednesday_slot2_first_choice: string | null;
  wednesday_slot2_second_choice: string | null;
  wednesday_slot2_third_choice: string | null;
  wednesday_slot2_fourth_choice: string | null;
  wednesday_slot2_fifth_choice: string | null;
  thursday_first_choice: string | null;
  thursday_second_choice: string | null;
  thursday_third_choice: string | null;
  thursday_fourth_choice: string | null;
  thursday_fifth_choice: string | null;
  friday_first_choice: string | null;
  friday_second_choice: string | null;
  friday_third_choice: string | null;
  friday_fourth_choice: string | null;
  friday_fifth_choice: string | null;
}

interface Allocation {
  id: string;
  student_id: string;
  activity_id: string;
  day_of_week: string;
  slot_number: number;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const ManualAllocations = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [preferences, setPreferences] = useState<Map<string, Preference>>(new Map());
  const [allocations, setAllocations] = useState<Map<string, Allocation[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setUserRole(profileData?.role || "");

      const [studentsRes, activitiesRes, preferencesRes, allocationsRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").eq("role", "student").order("full_name"),
        supabase.from("activities").select("id, title, capacity, days_of_week, current_enrollment").eq("is_active", true),
        supabase.from("preferences").select("*"),
        supabase.from("allocations").select("*")
      ]);

      setStudents(studentsRes.data || []);
      setActivities(activitiesRes.data || []);

      const prefsMap = new Map<string, Preference>();
      (preferencesRes.data || []).forEach(pref => {
        prefsMap.set(pref.student_id, pref);
      });
      setPreferences(prefsMap);

      const allocsMap = new Map<string, Allocation[]>();
      (allocationsRes.data || []).forEach(alloc => {
        const key = `${alloc.student_id}-${alloc.day_of_week}-${alloc.slot_number}`;
        if (!allocsMap.has(alloc.student_id)) {
          allocsMap.set(alloc.student_id, []);
        }
        allocsMap.get(alloc.student_id)!.push(alloc);
      });
      setAllocations(allocsMap);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load data",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAllocate = async (studentId: string, activityId: string, day: string, slot: number) => {
    const activity = activities.find(a => a.id === activityId);
    if (!activity) return;

    // Validate input data
    const validation = ManualAllocationInputSchema.safeParse({
      studentId,
      activityId,
      day,
      slot
    });

    if (!validation.success) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: validation.error.errors[0].message,
      });
      return;
    }

    const currentAllocations = allocations.get(studentId) || [];
    const existingAllocation = currentAllocations.find(
      a => a.day_of_week === day && a.slot_number === slot
    );

    if (existingAllocation && existingAllocation.activity_id === activityId) return;

    try {
      if (existingAllocation) {
        await supabase.from("allocations").delete().eq("id", existingAllocation.id);
      }

      const { data, error } = await supabase.from("allocations").insert({
        student_id: validation.data.studentId,
        activity_id: validation.data.activityId,
        day_of_week: validation.data.day,
        slot_number: validation.data.slot,
        preference_rank: 1,
        status: "allocated"
      }).select().single();

      if (error) throw error;

      const updatedAllocations = new Map(allocations);
      const studentAllocs = updatedAllocations.get(studentId) || [];
      const filtered = studentAllocs.filter(a => !(a.day_of_week === day && a.slot_number === slot));
      updatedAllocations.set(studentId, [...filtered, data]);
      setAllocations(updatedAllocations);

      toast({
        title: "Success",
        description: "Student allocated successfully",
      });
    } catch (error: any) {
      console.error("Error allocating student:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to allocate student",
      });
    }
  };

  const handleRemoveAllocation = async (studentId: string, day: string, slot: number) => {
    const currentAllocations = allocations.get(studentId) || [];
    const allocation = currentAllocations.find(
      a => a.day_of_week === day && a.slot_number === slot
    );

    if (!allocation) return;

    try {
      await supabase.from("allocations").delete().eq("id", allocation.id);

      const updatedAllocations = new Map(allocations);
      const filtered = currentAllocations.filter(a => a.id !== allocation.id);
      updatedAllocations.set(studentId, filtered);
      setAllocations(updatedAllocations);

      toast({
        title: "Success",
        description: "Allocation removed successfully",
      });
    } catch (error) {
      console.error("Error removing allocation:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove allocation",
      });
    }
  };

  const getStudentPreferences = (studentId: string, day: string, slot: number) => {
    const pref = preferences.get(studentId);
    if (!pref) return [];

    const dayLower = day.toLowerCase();
    const slotSuffix = day === 'Wednesday' ? `_slot${slot}` : '';
    
    const choices = [
      pref[`${dayLower}${slotSuffix}_first_choice` as keyof Preference],
      pref[`${dayLower}${slotSuffix}_second_choice` as keyof Preference],
      pref[`${dayLower}${slotSuffix}_third_choice` as keyof Preference],
      pref[`${dayLower}${slotSuffix}_fourth_choice` as keyof Preference],
      pref[`${dayLower}${slotSuffix}_fifth_choice` as keyof Preference],
    ].filter(Boolean);

    return choices;
  };

  const getCurrentAllocation = (studentId: string, day: string, slot: number) => {
    const studentAllocs = allocations.get(studentId) || [];
    return studentAllocs.find(a => a.day_of_week === day && a.slot_number === slot);
  };

  const getAvailableActivities = (day: string) => {
    return activities.filter(a => a.days_of_week.includes(day));
  };

  const handleBack = () => {
    navigate(userRole === 'admin' ? '/admin' : '/moderator');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Manual Student Allocations</CardTitle>
            <CardDescription>
              Assign students to activities manually based on their preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="Monday" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                {DAYS.map(day => (
                  <TabsTrigger key={day} value={day}>{day}</TabsTrigger>
                ))}
              </TabsList>

              {DAYS.map(day => {
                const slots = day === 'Wednesday' ? [1, 2] : [1];
                return (
                  <TabsContent key={day} value={day} className="space-y-6">
                    {slots.map(slot => (
                      <div key={slot} className="space-y-4">
                        {day === 'Wednesday' && (
                          <h3 className="text-lg font-semibold">Slot {slot}</h3>
                        )}
                        <div className="rounded-md border overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="min-w-[150px]">Student</TableHead>
                                <TableHead className="min-w-[200px]">Email</TableHead>
                                <TableHead className="min-w-[300px]">Preferences (Ranked)</TableHead>
                                <TableHead className="min-w-[250px]">Current Allocation</TableHead>
                                <TableHead className="min-w-[250px]">Assign Activity</TableHead>
                                <TableHead className="w-[100px]">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {students.map(student => {
                                const prefs = getStudentPreferences(student.id, day, slot);
                                const currentAlloc = getCurrentAllocation(student.id, day, slot);
                                const availableActivities = getAvailableActivities(day);

                                return (
                                  <TableRow key={student.id}>
                                    <TableCell className="font-medium">{student.full_name}</TableCell>
                                    <TableCell className="text-sm">{student.email}</TableCell>
                                    <TableCell>
                                      <div className="flex flex-wrap gap-1">
                                        {prefs.length > 0 ? (
                                          prefs.map((prefId, index) => {
                                            const activity = activities.find(a => a.id === prefId);
                                            return activity ? (
                                              <Badge key={index} variant="secondary" className="text-xs">
                                                {index + 1}. {activity.title}
                                              </Badge>
                                            ) : null;
                                          })
                                        ) : (
                                          <span className="text-sm text-muted-foreground">No preferences</span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {currentAlloc ? (
                                        <Badge>
                                          {activities.find(a => a.id === currentAlloc.activity_id)?.title || 'Unknown'}
                                        </Badge>
                                      ) : (
                                        <span className="text-sm text-muted-foreground">Not allocated</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <Select
                                        value={currentAlloc?.activity_id || ""}
                                        onValueChange={(value) => handleAllocate(student.id, value, day, slot)}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select activity" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {availableActivities.map(activity => (
                                            <SelectItem key={activity.id} value={activity.id}>
                                              {activity.title} ({activity.current_enrollment}/{activity.capacity})
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell>
                                      {currentAlloc && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleRemoveAllocation(student.id, day, slot)}
                                        >
                                          <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ManualAllocations;
