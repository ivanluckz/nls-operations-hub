import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Users, Clock, MapPin } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import IOSSchoolSkeleton from "@/components/IOSSchoolSkeleton";

interface Activity {
  id: string;
  title: string;
  category: string;
  capacity: number;
  current_enrollment: number;
  schedule: string;
  teacher_in_charge: string;
  days_of_week: string[];
  is_active: boolean;
}

interface AllocationWithStudent {
  student_id: string;
  day_of_week: string;
  slot_number: number;
  profiles: { full_name: string; email: string } | null;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const SCHEDULE_INFO: Record<string, { label: string; time: string }[]> = {
  Monday: [{ label: "Slot 1", time: "16:30 – 18:25" }],
  Tuesday: [{ label: "Slot 1", time: "16:30 – 18:25" }],
  Wednesday: [
    { label: "Slot 1", time: "16:30 – 17:25" },
    { label: "Slot 2", time: "17:30 – 20:25" },
  ],
  Thursday: [{ label: "Slot 1", time: "16:30 – 18:25" }],
  Friday: [{ label: "Slot 1", time: "16:30 – 18:25" }],
};

const CATEGORY_COLORS: Record<string, string> = {
  sports: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
  arts: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20",
  academic: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  service: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  music: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/20",
  other: "bg-muted text-muted-foreground border-border",
};

const WeeklyTimetable = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [studentList, setStudentList] = useState<AllocationWithStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    const fetchActivities = async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("is_active", true)
        .order("title");

      if (!error && data) setActivities(data);
      setLoading(false);
    };
    fetchActivities();
  }, []);

  const filteredActivities = useMemo(() => {
    if (!searchQuery.trim()) return activities;
    const q = searchQuery.toLowerCase();
    return activities.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.teacher_in_charge.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    );
  }, [activities, searchQuery]);

  const getActivitiesForDaySlot = (day: string, slot: number) => {
    return filteredActivities.filter((a) => {
      if (!a.days_of_week.includes(day)) return false;
      if (day === "Wednesday") {
        // Dual-slot Wednesday activities appear in both slots
        if (a.days_of_week.filter((d) => d === "Wednesday").length >= 2) return true;
        // Otherwise check the schedule text for slot hints
        const schedLower = a.schedule.toLowerCase();
        if (slot === 1 && (schedLower.includes("slot 1") || schedLower.includes("16:30 - 17:25") || schedLower.includes("16:30-17:25"))) return true;
        if (slot === 2 && (schedLower.includes("slot 2") || schedLower.includes("17:30") )) return true;
        // Default: show in slot 1
        if (slot === 1) return true;
        return false;
      }
      return slot === 1;
    });
  };

  const handleActivityClick = async (activity: Activity) => {
    setSelectedActivity(activity);
    setLoadingStudents(true);
    const { data } = await supabase
      .from("allocations")
      .select("student_id, day_of_week, slot_number, profiles!allocations_student_id_fkey(full_name, email)")
      .eq("activity_id", activity.id)
      .order("day_of_week");
    
    // Fix: profiles may come as object or array depending on join
    const normalized = (data || []).map((d: any) => ({
      ...d,
      profiles: Array.isArray(d.profiles) ? d.profiles[0] : d.profiles,
    }));
    setStudentList(normalized);
    setLoadingStudents(false);
  };

  const getCategoryColor = (category: string) => {
    return CATEGORY_COLORS[category.toLowerCase()] || CATEGORY_COLORS.other;
  };

  const fillPercent = (a: Activity) =>
    a.capacity > 0 ? Math.round((a.current_enrollment / a.capacity) * 100) : 0;

  if (loading) {
    return (
      <AdminLayout>
        <IOSSchoolSkeleton fullScreen={false} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Weekly Timetable</h1>
            <p className="text-muted-foreground">
              Visual overview of all {activities.length} active activities across the week
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search activities, teachers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(CATEGORY_COLORS).map(([cat, cls]) => (
            <Badge key={cat} variant="outline" className={`${cls} capitalize`}>
              {cat}
            </Badge>
          ))}
        </div>

        {/* Timetable Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {DAYS.map((day) => (
            <div key={day} className="space-y-3">
              <div className="text-center">
                <h3 className="font-semibold text-lg">{day}</h3>
                <p className="text-xs text-muted-foreground">
                  {SCHEDULE_INFO[day].map((s) => s.time).join(" / ")}
                </p>
              </div>

              {SCHEDULE_INFO[day].map((slotInfo, idx) => {
                const slot = idx + 1;
                const slotActivities = getActivitiesForDaySlot(day, slot);

                return (
                  <div key={`${day}-${slot}`} className="space-y-1.5">
                    {day === "Wednesday" && (
                      <div className="flex items-center gap-2 px-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">
                          {slotInfo.label} · {slotInfo.time}
                        </span>
                      </div>
                    )}

                    {slotActivities.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                        No activities
                      </div>
                    ) : (
                      slotActivities.map((activity) => {
                        const pct = fillPercent(activity);
                        const isFull = pct >= 100;
                        return (
                          <Tooltip key={activity.id}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleActivityClick(activity)}
                                className={`w-full text-left rounded-lg border p-2.5 transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer ${getCategoryColor(activity.category)}`}
                              >
                                <p className="font-medium text-sm leading-tight truncate">
                                  {activity.title}
                                </p>
                                <p className="text-[11px] opacity-70 truncate mt-0.5">
                                  {activity.teacher_in_charge}
                                </p>
                                <div className="flex items-center justify-between mt-1.5">
                                  <div className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    <span className="text-[11px] font-medium">
                                      {activity.current_enrollment}/{activity.capacity}
                                    </span>
                                  </div>
                                  {isFull && (
                                    <Badge variant="destructive" className="h-4 text-[10px] px-1">
                                      Full
                                    </Badge>
                                  )}
                                </div>
                                {/* Capacity bar */}
                                <div className="mt-1.5 h-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      isFull
                                        ? "bg-destructive"
                                        : pct > 80
                                        ? "bg-amber-500"
                                        : "bg-current opacity-50"
                                    }`}
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <p className="font-semibold">{activity.title}</p>
                              <p className="text-xs">Teacher: {activity.teacher_in_charge}</p>
                              <p className="text-xs">Category: {activity.category}</p>
                              <p className="text-xs">Schedule: {activity.schedule}</p>
                              <p className="text-xs">
                                Enrollment: {activity.current_enrollment}/{activity.capacity} ({pct}%)
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">Click to see enrolled students</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Student List Dialog */}
      <Dialog open={!!selectedActivity} onOpenChange={() => setSelectedActivity(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedActivity?.title}
              <Badge variant="outline" className={getCategoryColor(selectedActivity?.category || "other")}>
                {selectedActivity?.category}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Teacher: {selectedActivity?.teacher_in_charge}</p>
            <p>
              Enrolled: {selectedActivity?.current_enrollment}/{selectedActivity?.capacity}
            </p>
            <p>Days: {selectedActivity?.days_of_week.join(", ")}</p>
          </div>
          {loadingStudents ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : studentList.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No students enrolled</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Day</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentList.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">
                        {s.profiles?.full_name || "Unknown"}
                        <span className="block text-xs text-muted-foreground">
                          {s.profiles?.email}
                        </span>
                      </TableCell>
                      <TableCell>{s.day_of_week}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default WeeklyTimetable;
