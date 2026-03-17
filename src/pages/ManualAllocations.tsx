import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ManualAllocationInputSchema } from "@/lib/validation";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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
const SLOTS = [
  { day: 'Monday', slot: 1, label: 'Mon' },
  { day: 'Tuesday', slot: 1, label: 'Tue' },
  { day: 'Wednesday', slot: 1, label: 'Wed S1' },
  { day: 'Wednesday', slot: 2, label: 'Wed S2' },
  { day: 'Thursday', slot: 1, label: 'Thu' },
  { day: 'Friday', slot: 1, label: 'Fri' },
];

const ManualAllocations = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [preferences, setPreferences] = useState<Map<string, Preference>>(new Map());
  const [allocations, setAllocations] = useState<Map<string, Allocation[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const query = searchQuery.toLowerCase();
    return students.filter(
      student =>
        student.full_name.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query)
    );
  }, [students, searchQuery]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setUserRole(roleData?.role || "");

      const { data: studentRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");

      const studentUserIds = (studentRoles || []).map(r => r.user_id);

      const [studentsRes, activitiesRes, preferencesRes, allocationsRes] = await Promise.all([
        studentUserIds.length > 0 
          ? supabase.from("profiles").select("id, full_name, email").in("id", studentUserIds).order("full_name")
          : Promise.resolve({ data: [] }),
        supabase.from("activities").select("id, title, capacity, days_of_week, current_enrollment").eq("is_active", true).limit(500),
        supabase.from("preferences").select("*").limit(2000),
        supabase.from("allocations").select("*").limit(10000)
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

  // Track pending allocations to prevent concurrent requests
  const [pendingAllocations, setPendingAllocations] = useState<Set<string>>(new Set());

  const handleAllocate = async (studentId: string, activityId: string, day: string, slot: number) => {
    const allocationKey = `${studentId}-${day}-${slot}`;
    
    // Prevent concurrent allocation requests for the same student/day/slot
    if (pendingAllocations.has(allocationKey)) {
      return;
    }

    const activity = activities.find(a => a.id === activityId);
    if (!activity) return;

    // Check capacity before allocation (Issue #15 & #41)
    const currentAllocations = allocations.get(studentId) || [];
    const existingAllocation = currentAllocations.find(
      a => a.day_of_week === day && a.slot_number === slot
    );
    
    // If not replacing an existing allocation in this activity, check live capacity
    if (!existingAllocation || existingAllocation.activity_id !== activityId) {
      const { count: liveCount } = await supabase
        .from("allocations")
        .select("*", { count: "exact", head: true })
        .eq("activity_id", activityId)
        .eq("day_of_week", day)
        .eq("slot_number", slot);
      if (liveCount !== null && liveCount >= activity.capacity) {
        toast({
          variant: "destructive",
          title: "Activity Full",
          description: `${activity.title} has reached its capacity of ${activity.capacity} students`,
        });
        return;
      }
    }

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

    if (existingAllocation && existingAllocation.activity_id === activityId) return;

    // Mark as pending
    setPendingAllocations(prev => new Set(prev).add(allocationKey));

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
    } finally {
      // Clear pending state
      setPendingAllocations(prev => {
        const next = new Set(prev);
        next.delete(allocationKey);
        return next;
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

  const getCurrentAllocation = (studentId: string, day: string, slot: number) => {
    const studentAllocs = allocations.get(studentId) || [];
    return studentAllocs.find(a => a.day_of_week === day && a.slot_number === slot);
  };

  const getAvailableActivities = (day: string, slot: number) => {
    // Wednesday activities are stored as "Wednesday Slot 1" or "Wednesday Slot 2"
    if (day === 'Wednesday') {
      const slotKey = `Wednesday Slot ${slot}`;
      return activities.filter(a => a.days_of_week.includes(slotKey));
    }
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
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Manual Student Allocations</CardTitle>
                <CardDescription>
                  Assign students to activities for all days at once
                </CardDescription>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full whitespace-nowrap">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[150px]">Student</TableHead>
                    {SLOTS.map((slotInfo) => (
                      <TableHead key={`${slotInfo.day}-${slotInfo.slot}`} className="min-w-[180px] text-center">
                        {slotInfo.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map(student => (
                    <TableRow key={student.id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">
                        <div>
                          <div className="font-medium">{student.full_name}</div>
                          <div className="text-xs text-muted-foreground">{student.email}</div>
                        </div>
                      </TableCell>
                      {SLOTS.map((slotInfo) => {
                        const currentAlloc = getCurrentAllocation(student.id, slotInfo.day, slotInfo.slot);
                        const availableActivities = getAvailableActivities(slotInfo.day, slotInfo.slot);

                        return (
                          <TableCell key={`${slotInfo.day}-${slotInfo.slot}`} className="min-w-[180px]">
                            <div className="flex items-center gap-1">
                              <Select
                                value={currentAlloc?.activity_id || "unassigned"}
                                onValueChange={(value) => {
                                  if (value === "unassigned") {
                                    handleRemoveAllocation(student.id, slotInfo.day, slotInfo.slot);
                                  } else {
                                    handleAllocate(student.id, value, slotInfo.day, slotInfo.slot);
                                  }
                                }}
                              >
                                <SelectTrigger className="w-[160px]">
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned">
                                    <span className="text-muted-foreground">Not assigned</span>
                                  </SelectItem>
                                  {availableActivities.map(activity => (
                                    <SelectItem key={activity.id} value={activity.id}>
                                      {activity.title} ({activity.current_enrollment}/{activity.capacity})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {currentAlloc && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  onClick={() => handleRemoveAllocation(student.id, slotInfo.day, slotInfo.slot)}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ManualAllocations;
