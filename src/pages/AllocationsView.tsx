import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Search, FileDown, FileSpreadsheet, ChevronDown, AlertTriangle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StudentAllocation {
  student_id: string;
  student_name: string;
  student_email: string;
  student_class: string | null;
  monday_activity: string | null;
  tuesday_activity: string | null;
  wednesday_slot1_activity: string | null;
  wednesday_slot2_activity: string | null;
  thursday_activity: string | null;
  friday_activity: string | null;
  monday_category: string | null;
  tuesday_category: string | null;
  wednesday_slot1_category: string | null;
  wednesday_slot2_category: string | null;
  thursday_category: string | null;
  friday_category: string | null;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const CATEGORY_COLORS: Record<string, string> = {
  Sports: "bg-blue-50 dark:bg-blue-950/20",
  Arts: "bg-purple-50 dark:bg-purple-950/20",
  Service: "bg-green-50 dark:bg-green-950/20",
  Academic: "bg-amber-50 dark:bg-amber-950/20",
  Music: "bg-pink-50 dark:bg-pink-950/20",
  Club: "bg-cyan-50 dark:bg-cyan-950/20",
};

const getCategoryBg = (category: string | null) => {
  if (!category) return "";
  return CATEGORY_COLORS[category] || "bg-muted/30";
};

const AllocationsView = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [allocations, setAllocations] = useState<StudentAllocation[]>([]);
  const [filteredAllocations, setFilteredAllocations] = useState<StudentAllocation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [activityOptions, setActivityOptions] = useState<string[]>([]);
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [activeTab, setActiveTab] = useState("all");

  // Capacity data for warning icons
  const [capacityMap, setCapacityMap] = useState<Record<string, { enrollment: number; capacity: number }>>({});

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    let filtered = allocations.filter(alloc =>
      alloc.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alloc.student_email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (activityFilter !== "all") {
      filtered = filtered.filter(alloc =>
        alloc.monday_activity === activityFilter ||
        alloc.tuesday_activity === activityFilter ||
        alloc.wednesday_slot1_activity === activityFilter ||
        alloc.wednesday_slot2_activity === activityFilter ||
        alloc.thursday_activity === activityFilter ||
        alloc.friday_activity === activityFilter
      );
    }
    if (classFilter !== "all") {
      filtered = filtered.filter(alloc => alloc.student_class === classFilter);
    }
    if (dayFilter !== "all") {
      filtered = filtered.filter(alloc => {
        if (dayFilter === "Monday") return !!alloc.monday_activity;
        if (dayFilter === "Tuesday") return !!alloc.tuesday_activity;
        if (dayFilter === "Wednesday") return !!(alloc.wednesday_slot1_activity || alloc.wednesday_slot2_activity);
        if (dayFilter === "Thursday") return !!alloc.thursday_activity;
        if (dayFilter === "Friday") return !!alloc.friday_activity;
        return true;
      });
    }
    setFilteredAllocations(filtered);
  }, [searchTerm, activityFilter, dayFilter, classFilter, allocations]);

  const isAssigned = (alloc: StudentAllocation) =>
    !!(alloc.monday_activity || alloc.tuesday_activity ||
       alloc.wednesday_slot1_activity || alloc.wednesday_slot2_activity ||
       alloc.thursday_activity || alloc.friday_activity);

  const isFullyAssigned = (alloc: StudentAllocation) =>
    !!(alloc.monday_activity && alloc.tuesday_activity &&
       alloc.wednesday_slot1_activity && alloc.wednesday_slot2_activity &&
       alloc.thursday_activity && alloc.friday_activity);

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

      const [studentsResult, allocsResult, activitiesResult] = await Promise.all([
        studentUserIds.length > 0
          ? supabase.from("profiles").select("id, full_name, email, student_class").in("id", studentUserIds).order("full_name")
          : Promise.resolve({ data: [] }),
        supabase.from("allocations").select("student_id, activity_id, day_of_week, slot_number, activities(title, category)").limit(5000),
        supabase.from("activities").select("title, capacity, current_enrollment").eq("is_active", true),
      ]);

      const students = studentsResult.data || [];
      const allAllocations = allocsResult.data || [];
      const activities = activitiesResult.data || [];

      // Build capacity map
      const capMap: Record<string, { enrollment: number; capacity: number }> = {};
      activities.forEach((a: any) => {
        capMap[a.title] = { enrollment: a.current_enrollment, capacity: a.capacity };
      });
      setCapacityMap(capMap);

      // Collect unique classes
      const classes = [...new Set(students.map(s => (s as any).student_class).filter(Boolean) as string[])].sort();
      setClassOptions(classes);

      const studentAllocations: StudentAllocation[] = students.map((student: any) => {
        const studentAllocs = allAllocations.filter(a => a.student_id === student.id);
        const getActivity = (day: string, slot?: number) => {
          const a = studentAllocs.find(a => a.day_of_week === day && (slot === undefined || a.slot_number === slot));
          return a ? { title: (a.activities as any)?.title || null, category: (a.activities as any)?.category || null } : { title: null, category: null };
        };

        const mon = getActivity('Monday');
        const tue = getActivity('Tuesday');
        const w1 = getActivity('Wednesday', 1);
        const w2 = getActivity('Wednesday', 2);
        const thu = getActivity('Thursday');
        const fri = getActivity('Friday');

        return {
          student_id: student.id,
          student_name: student.full_name,
          student_email: student.email,
          student_class: student.student_class,
          monday_activity: mon.title,
          tuesday_activity: tue.title,
          wednesday_slot1_activity: w1.title,
          wednesday_slot2_activity: w2.title,
          thursday_activity: thu.title,
          friday_activity: fri.title,
          monday_category: mon.category,
          tuesday_category: tue.category,
          wednesday_slot1_category: w1.category,
          wednesday_slot2_category: w2.category,
          thursday_category: thu.category,
          friday_category: fri.category,
        };
      });

      const uniqueActivities = [...new Set(
        allAllocations.map(a => (a.activities as any)?.title).filter(Boolean) as string[]
      )].sort();
      setActivityOptions(uniqueActivities);

      setAllocations(studentAllocations);
      setFilteredAllocations(studentAllocations);
    } catch (error) {
      console.error("Error fetching allocations:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load allocations" });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(userRole === 'admin' ? '/admin' : '/moderator');
  };

  const handleExportPDF = (filter: "all" | "assigned" | "unassigned") => {
    const win = window.open("", "_blank");
    if (!win) return;
    const rows = filteredAllocations.filter(a =>
      filter === "all" ? true : filter === "assigned" ? isAssigned(a) : !isAssigned(a)
    );
    const label = filter === "assigned" ? "Assigned Students" : filter === "unassigned" ? "Unassigned Students" : "All Students";
    const studentRows = rows.map((a, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${a.student_name}</td>
        <td>${a.student_email}</td>
        <td>${a.monday_activity || "-"}</td>
        <td>${a.tuesday_activity || "-"}</td>
        <td>${a.wednesday_slot1_activity || "-"}</td>
        <td>${a.wednesday_slot2_activity || "-"}</td>
        <td>${a.thursday_activity || "-"}</td>
        <td>${a.friday_activity || "-"}</td>
      </tr>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Student Allocations</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px; }
        h1 { font-size: 15px; margin-bottom: 2px; }
        .meta { font-size: 10px; color: #555; margin: 0 0 14px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { background: #f3f4f6; text-align: left; padding: 4px 6px; border: 1px solid #ddd; }
        td { padding: 4px 6px; border: 1px solid #ddd; }
        tr:nth-child(even) td { background: #fafafa; }
        @media print { @page { size: landscape; margin: 12mm; } }
      </style></head><body>
      <h1>Student Allocations — ${label}</h1>
      <p class="meta">NLS &nbsp;|&nbsp; Generated ${new Date().toLocaleString()} &nbsp;|&nbsp; ${rows.length} students</p>
      <table>
        <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Monday</th><th>Tuesday</th><th>Wed Slot 1</th><th>Wed Slot 2</th><th>Thursday</th><th>Friday</th></tr></thead>
        <tbody>${studentRows}</tbody>
      </table>
      <script>window.onload=()=>{window.print()}<\/script>
    </body></html>`);
    win.document.close();
  };

  const handleExportCSV = (filter: "all" | "assigned" | "unassigned") => {
    const rows = filteredAllocations.filter(a =>
      filter === "all" ? true : filter === "assigned" ? isAssigned(a) : !isAssigned(a)
    );
    const header = ["Name", "Email", "Class", "Monday", "Tuesday", "Wed Slot 1", "Wed Slot 2", "Thursday", "Friday"].join(",");
    const lines = rows.map(a => [
      `"${a.student_name}"`,
      `"${a.student_email}"`,
      `"${a.student_class || ""}"`,
      `"${a.monday_activity || ""}"`,
      `"${a.tuesday_activity || ""}"`,
      `"${a.wednesday_slot1_activity || ""}"`,
      `"${a.wednesday_slot2_activity || ""}"`,
      `"${a.thursday_activity || ""}"`,
      `"${a.friday_activity || ""}"`,
    ].join(","));
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `allocations_${filter}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderActivityCell = (title: string | null, category: string | null) => {
    if (!title) return <span className="text-muted-foreground">-</span>;
    const cap = capacityMap[title];
    const isNearCap = cap && cap.capacity > 0 && cap.enrollment >= cap.capacity * 0.9;
    return (
      <div className={`rounded px-1.5 py-0.5 text-sm ${getCategoryBg(category)}`}>
        <span>{title}</span>
        {isNearCap && <AlertTriangle className="inline-block ml-1 h-3 w-3 text-amber-500" />}
      </div>
    );
  };

  // Stats
  const totalStudents = allocations.length;
  const fullyAssigned = allocations.filter(isFullyAssigned).length;
  const partiallyAssigned = allocations.filter(a => isAssigned(a) && !isFullyAssigned(a)).length;
  const unassigned = allocations.filter(a => !isAssigned(a)).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="glass-nav sticky top-0 z-30">
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
            <CardTitle>Student Allocations</CardTitle>
            <CardDescription>
              View all student co-curricular activity assignments by day
            </CardDescription>
            {/* Summary stats */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="secondary">{totalStudents} Total</Badge>
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">{fullyAssigned} Fully Assigned</Badge>
              <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">{partiallyAssigned} Partial</Badge>
              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">{unassigned} Unassigned</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 flex-col sm:flex-row flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={activityFilter} onValueChange={setActivityFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="All Activities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activities</SelectItem>
                  {activityOptions.map(act => (
                    <SelectItem key={act} value={act}>{act}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={dayFilter} onValueChange={setDayFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="All Days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Days</SelectItem>
                  {DAYS.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {classOptions.length > 0 && (
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {classOptions.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Export CSV
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExportCSV("all")}>All students</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportCSV("assigned")}>Assigned only</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportCSV("unassigned")}>Unassigned only</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <FileDown className="mr-2 h-4 w-4" />
                    Export PDF
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExportPDF("all")}>All students</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportPDF("assigned")}>Assigned only</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportPDF("unassigned")}>Unassigned only</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Tabs defaultValue="all" className="w-full" value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">All Days</TabsTrigger>
                {DAYS.map(day => (
                  <TabsTrigger key={day} value={day}>{day}</TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="all" className="space-y-4">
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px]">Student</TableHead>
                        <TableHead className="min-w-[200px]">Email</TableHead>
                        <TableHead className="min-w-[150px]">Monday</TableHead>
                        <TableHead className="min-w-[150px]">Tuesday</TableHead>
                        <TableHead className="min-w-[150px]">Wed Slot 1</TableHead>
                        <TableHead className="min-w-[150px]">Wed Slot 2</TableHead>
                        <TableHead className="min-w-[150px]">Thursday</TableHead>
                        <TableHead className="min-w-[150px]">Friday</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAllocations.map(alloc => (
                        <TableRow
                          key={alloc.student_id}
                          className={!isAssigned(alloc) ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}
                        >
                          <TableCell className="font-medium">
                            {alloc.student_name}
                            {alloc.student_class && (
                              <span className="text-xs text-muted-foreground ml-1">({alloc.student_class})</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{alloc.student_email}</TableCell>
                          <TableCell>{renderActivityCell(alloc.monday_activity, alloc.monday_category)}</TableCell>
                          <TableCell>{renderActivityCell(alloc.tuesday_activity, alloc.tuesday_category)}</TableCell>
                          <TableCell>{renderActivityCell(alloc.wednesday_slot1_activity, alloc.wednesday_slot1_category)}</TableCell>
                          <TableCell>{renderActivityCell(alloc.wednesday_slot2_activity, alloc.wednesday_slot2_category)}</TableCell>
                          <TableCell>{renderActivityCell(alloc.thursday_activity, alloc.thursday_category)}</TableCell>
                          <TableCell>{renderActivityCell(alloc.friday_activity, alloc.friday_category)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {DAYS.map(day => {
                const isWed = day === 'Wednesday';
                const dayKey = `${day.toLowerCase()}_activity` as keyof StudentAllocation;
                const catKey = `${day.toLowerCase()}_category` as keyof StudentAllocation;
                return (
                  <TabsContent key={day} value={day}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student Name</TableHead>
                          <TableHead>Email</TableHead>
                          {isWed ? (
                            <>
                              <TableHead>Slot 1</TableHead>
                              <TableHead>Slot 2</TableHead>
                            </>
                          ) : (
                            <TableHead>Activity</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAllocations.map(alloc => (
                          <TableRow key={alloc.student_id}>
                            <TableCell className="font-medium">{alloc.student_name}</TableCell>
                            <TableCell>{alloc.student_email}</TableCell>
                            {isWed ? (
                              <>
                                <TableCell>{renderActivityCell(alloc.wednesday_slot1_activity, alloc.wednesday_slot1_category)}</TableCell>
                                <TableCell>{renderActivityCell(alloc.wednesday_slot2_activity, alloc.wednesday_slot2_category)}</TableCell>
                              </>
                            ) : (
                              <TableCell>
                                {renderActivityCell(alloc[dayKey] as string | null, alloc[catKey] as string | null)}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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

export default AllocationsView;
