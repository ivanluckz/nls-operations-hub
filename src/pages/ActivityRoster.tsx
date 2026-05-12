import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Search, Users, ChevronDown, ChevronUp, Download, FileText, FileSpreadsheet } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import IOSSchoolSkeleton from "@/components/IOSSchoolSkeleton";
import { exportActivitiesToExcel, exportActivitiesAsCSV } from "@/lib/activity-export";

interface Activity {
  id: string;
  title: string;
  category: string;
  teacher_in_charge: string;
  capacity: number;
  current_enrollment: number;
  days_of_week: string[];
}

interface Student {
  student_id: string;
  student_name: string;
  student_email: string;
  day_of_week: string;
  slot_number: number;
}

interface ActivityWithStudents extends Activity {
  students: Student[];
  uniqueStudentCount: number;
}

const ActivityRoster = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activities, setActivities] = useState<ActivityWithStudents[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [userRole, setUserRole] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      setUserRole(roleData?.role || "");

      // Fetch all activities
      const { data: activitiesData } = await supabase
        .from("activities")
        .select("id, title, category, teacher_in_charge, capacity, current_enrollment, days_of_week")
        .eq("is_active", true)
        .order("title");

      // Fetch allocations (without join - no FK relationship)
      const { data: allocationsData } = await supabase
        .from("allocations")
        .select("activity_id, day_of_week, slot_number, student_id")
        .limit(5000);

      // Get unique student IDs and fetch their profiles separately
      const studentIds = [...new Set((allocationsData || []).map(a => a.student_id))];
      
      // Fetch profiles in batches if needed (Supabase has query limits)
      let profilesMap: Record<string, { full_name: string; email: string }> = {};
      if (studentIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", studentIds);
        
        (profilesData || []).forEach(p => {
          profilesMap[p.id] = { full_name: p.full_name, email: p.email };
        });
      }

      // Group students by activity
      const activitiesWithStudents: ActivityWithStudents[] = (activitiesData || []).map(activity => {
        const activityAllocations = (allocationsData || []).filter(
          a => a.activity_id === activity.id
        );

        const students: Student[] = activityAllocations.map((alloc) => ({
          student_id: alloc.student_id,
          student_name: profilesMap[alloc.student_id]?.full_name || "Unknown",
          student_email: profilesMap[alloc.student_id]?.email || "",
          day_of_week: alloc.day_of_week,
          slot_number: alloc.slot_number ?? 1,
        }));

        // Count unique students (not total enrollments across days)
        const uniqueStudentIds = new Set(students.map(s => s.student_id));

        return {
          ...activity,
          students,
          uniqueStudentCount: uniqueStudentIds.size,
        };
      });

      setActivities(activitiesWithStudents);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load activity roster",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleActivity = (activityId: string) => {
    const newExpanded = new Set(expandedActivities);
    if (newExpanded.has(activityId)) {
      newExpanded.delete(activityId);
    } else {
      newExpanded.add(activityId);
    }
    setExpandedActivities(newExpanded);
  };

  const expandAll = () => {
    setExpandedActivities(new Set(filteredActivities.map(a => a.id)));
  };

  const collapseAll = () => {
    setExpandedActivities(new Set());
  };

  const handleBack = () => {
    navigate(userRole === "admin" ? "/admin" : "/moderator");
  };

  const esc = (s: string | number | null | undefined) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const downloadPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const rows = filteredActivities.map(a => {
      const daySlots = new Map<string, Set<number>>();
      a.students.forEach(s => {
        if (!daySlots.has(s.day_of_week)) daySlots.set(s.day_of_week, new Set());
        daySlots.get(s.day_of_week)!.add(s.slot_number);
      });
      const multiSlotDays = new Set([...daySlots.entries()].filter(([, slots]) => slots.size > 1).map(([d]) => d));
      const sorted = [...a.students].sort((x, y) => x.student_name.localeCompare(y.student_name));
      const studentRows = sorted.map((s, i) =>
        `<tr><td>${i + 1}</td><td>${esc(s.student_name)}</td><td>${esc(s.student_email)}</td><td>${esc(s.day_of_week)}${multiSlotDays.has(s.day_of_week) ? ` (Slot ${esc(s.slot_number)})` : ""}</td></tr>`
      ).join("");
      return `
        <div class="activity">
          <h2>${esc(a.title)} <span class="cat">${esc(a.category)}</span></h2>
          <p class="meta">Teacher: ${esc(a.teacher_in_charge)} &nbsp;|&nbsp; ${esc(a.uniqueStudentCount)} / ${esc(a.capacity)} students</p>
          ${a.students.length === 0
            ? `<p class="empty">No students enrolled</p>`
            : `<table><thead><tr><th>#</th><th>Name</th><th>Email</th><th>Day / Slot</th></tr></thead><tbody>${studentRows}</tbody></table>`}
        </div>`;
    }).join("");

    win.document.write(`<!DOCTYPE html><html><head><title>Activity Roster</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .subtitle { color: #666; margin-bottom: 20px; font-size: 11px; }
        .activity { margin-bottom: 24px; page-break-inside: avoid; }
        .activity h2 { font-size: 14px; margin: 0 0 2px; }
        .cat { font-size: 10px; background: #eee; padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: normal; }
        .meta { font-size: 11px; color: #555; margin: 0 0 6px; }
        .empty { color: #999; font-style: italic; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #f3f4f6; text-align: left; padding: 4px 8px; border: 1px solid #ddd; }
        td { padding: 4px 8px; border: 1px solid #ddd; }
        tr:nth-child(even) td { background: #fafafa; }
        @media print { .activity { page-break-inside: avoid; } }
      </style></head><body>
      <h1>Activity Roster</h1>
      <p class="subtitle">NLS &nbsp;|&nbsp; Generated ${new Date().toLocaleString()} &nbsp;|&nbsp; ${filteredActivities.length} activities</p>
      ${rows}
      <script>window.onload=()=>{window.print()}<\/script>
    </body></html>`);
    win.document.close();
  };

  const exportActivityCSV = (activity: ActivityWithStudents) => {
    const sorted = [...activity.students].sort((a, b) => a.student_name.localeCompare(b.student_name) || a.slot_number - b.slot_number);
    const daySlots = new Map<string, Set<number>>();
    activity.students.forEach(s => {
      if (!daySlots.has(s.day_of_week)) daySlots.set(s.day_of_week, new Set());
      daySlots.get(s.day_of_week)!.add(s.slot_number);
    });
    const multiSlotDaysCSV = new Set([...daySlots.entries()].filter(([, slots]) => slots.size > 1).map(([d]) => d));
    const header = ["#", "Name", "Email", "Day / Slot"].join(",");
    const rows = sorted.map((s, i) => {
      const multiSlotDay = multiSlotDaysCSV.has(s.day_of_week);
      const day = multiSlotDay ? `${s.day_of_week} (Slot ${s.slot_number})` : s.day_of_week;
      return [i + 1, `"${s.student_name}"`, `"${s.student_email}"`, `"${day}"`].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activity.title.replace(/[^a-z0-9]/gi, "_")}_roster.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportActivityPDF = (activity: ActivityWithStudents) => {
    const win = window.open("", "_blank");
    if (!win) return;
    const sorted = [...activity.students].sort((a, b) => a.student_name.localeCompare(b.student_name) || a.slot_number - b.slot_number);
    const daySlotsPDF = new Map<string, Set<number>>();
    activity.students.forEach(s => {
      if (!daySlotsPDF.has(s.day_of_week)) daySlotsPDF.set(s.day_of_week, new Set());
      daySlotsPDF.get(s.day_of_week)!.add(s.slot_number);
    });
    const multiSlotDaysPDF = new Set([...daySlotsPDF.entries()].filter(([, slots]) => slots.size > 1).map(([d]) => d));
    const studentRows = sorted.map((s, i) => {
      const multiSlotDay = multiSlotDaysPDF.has(s.day_of_week);
      const day = multiSlotDay ? `${s.day_of_week} (Slot ${s.slot_number})` : s.day_of_week;
      return `<tr><td>${i + 1}</td><td>${esc(s.student_name)}</td><td>${esc(s.student_email)}</td><td>${esc(day)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>${esc(activity.title)} Roster</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
        h1 { font-size: 16px; margin-bottom: 2px; }
        .meta { font-size: 11px; color: #555; margin: 0 0 16px; }
        .cat { font-size: 10px; background: #eee; padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: normal; }
        .empty { color: #999; font-style: italic; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #f3f4f6; text-align: left; padding: 4px 8px; border: 1px solid #ddd; }
        td { padding: 4px 8px; border: 1px solid #ddd; }
        tr:nth-child(even) td { background: #fafafa; }
      </style></head><body>
      <h1>${esc(activity.title)} <span class="cat">${esc(activity.category)}</span></h1>
      <p class="meta">Teacher: ${esc(activity.teacher_in_charge)} &nbsp;|&nbsp; ${esc(activity.uniqueStudentCount)} / ${esc(activity.capacity)} students &nbsp;|&nbsp; Generated ${esc(new Date().toLocaleString())}</p>
      ${activity.students.length === 0
        ? `<p class="empty">No students enrolled</p>`
        : `<table><thead><tr><th>#</th><th>Name</th><th>Email</th><th>Day / Slot</th></tr></thead><tbody>${studentRows}</tbody></table>`}
      <script>window.onload=()=>{window.print()}<\/script>
    </body></html>`);
    win.document.close();
  };

  const filteredActivities = activities.filter(activity =>
    activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    activity.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    activity.teacher_in_charge.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <IOSSchoolSkeleton />;
  }

  return (
    <div className="min-h-screen bg-transparent">
      <header className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Activity Roster</h1>
            <p className="text-muted-foreground">View all activities and their enrolled students</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>
              Expand All
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              Collapse All
            </Button>
            <Button variant="outline" size="sm" onClick={downloadPDF}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                try {
                  exportActivitiesToExcel(filteredActivities);
                  toast({ title: "✅ Downloaded", description: "Activities exported to Excel" });
                } catch (e: any) {
                  console.error("Excel export failed:", e);
                  toast({ variant: "destructive", title: "Error", description: e?.message || "Failed to export" });
                }
              }}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                try {
                  exportActivitiesAsCSV(filteredActivities);
                  toast({ title: "✅ Downloaded", description: "Activities exported as CSV" });
                } catch (e: any) {
                  console.error("CSV export failed:", e);
                  toast({ variant: "destructive", title: "Error", description: e?.message || "Failed to export" });
                }
              }}
            >
              <FileText className="w-4 h-4 mr-2" />
              CSV
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search activities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{activities.length}</div>
              <p className="text-sm text-muted-foreground">Total Activities</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">
                {activities.reduce((sum, a) => sum + a.uniqueStudentCount, 0)}
              </div>
              <p className="text-sm text-muted-foreground">Unique Students</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">
                {activities.filter(a => a.uniqueStudentCount > 0).length}
              </div>
              <p className="text-sm text-muted-foreground">Active Activities</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">
                {activities.filter(a => a.uniqueStudentCount === 0).length}
              </div>
              <p className="text-sm text-muted-foreground">Empty Activities</p>
            </CardContent>
          </Card>
        </div>

        {/* Activities List */}
        <div className="space-y-4">
          {filteredActivities.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No activities found matching your search.
              </CardContent>
            </Card>
          ) : (
            filteredActivities.map((activity) => (
              <Collapsible
                key={activity.id}
                open={expandedActivities.has(activity.id)}
                onOpenChange={() => toggleActivity(activity.id)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <CardTitle className="text-lg">{activity.title}</CardTitle>
                            <Badge variant="outline">{activity.category}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
                            <span>Teacher: {activity.teacher_in_charge}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {activity.uniqueStudentCount} / {activity.capacity}
                            </span>
                            <span>•</span>
                            <div className="flex gap-1">
                              {activity.days_of_week.map(day => (
                                <Badge key={day} variant="secondary" className="text-xs">
                                  {day}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={activity.uniqueStudentCount > 0 ? "default" : "secondary"}
                          >
                            {activity.uniqueStudentCount} students
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={() => exportActivityCSV(activity)}>
                                <FileSpreadsheet className="w-4 h-4 mr-2" />
                                Export CSV
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => exportActivityPDF(activity)}>
                                <FileText className="w-4 h-4 mr-2" />
                                Export PDF
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {expandedActivities.has(activity.id) ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {activity.students.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No students enrolled in this activity yet.
                        </p>
                      ) : (() => {
                        const DAY_ORDER = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
                        const sessions = [...new Map(
                          activity.students.map(s => [`${s.day_of_week}|${s.slot_number}`, { day: s.day_of_week, slot: s.slot_number }])
                        ).values()].sort((a, b) =>
                          (DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day)) || (a.slot - b.slot)
                        );
                        const multiSlotDays = new Set(
                          sessions.filter(s => sessions.filter(x => x.day === s.day).length > 1).map(s => s.day)
                        );
                        return (
                          <div className="space-y-4">
                            {sessions.map(({ day, slot }) => {
                              const sessionStudents = activity.students
                                .filter(s => s.day_of_week === day && s.slot_number === slot)
                                .sort((a, b) => a.student_name.localeCompare(b.student_name));
                              const label = multiSlotDays.has(day) ? `${day} — Slot ${slot}` : day;
                              return (
                                <div key={`${day}-${slot}`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="secondary" className="text-xs font-medium">{label}</Badge>
                                    <span className="text-xs text-muted-foreground">{sessionStudents.length} student{sessionStudents.length !== 1 ? "s" : ""}</span>
                                  </div>
                                  <div className="rounded-md border">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="w-[50px]">#</TableHead>
                                          <TableHead>Student Name</TableHead>
                                          <TableHead>Email</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {sessionStudents.map((student, index) => (
                                          <TableRow key={`${student.student_id}-${day}-${slot}`}>
                                            <TableCell className="font-medium">{index + 1}</TableCell>
                                            <TableCell>{student.student_name}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{student.student_email}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default ActivityRoster;
