import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Download, Search, Users, ClipboardCheck, AlertTriangle, Clock } from "lucide-react";
import type { AcademicSubject, ClassGroup } from "@/types/academic";
import { format } from "date-fns";

interface AttendanceRow {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  subject_name: string;
  class_name: string;
  session_date: string;
  period_number: number;
  day_of_week: string;
  status: "present" | "late" | "absent" | "excused";
  marked_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  present: "bg-green-100 text-green-800",
  late: "bg-amber-100 text-amber-800",
  absent: "bg-red-100 text-red-800",
  excused: "bg-blue-100 text-blue-800",
};

const AcademicAttendanceReports = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);

  // Filters
  const [filterGroup, setFilterGroup] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  useEffect(() => {
    loadFilters();
  }, []);

  const loadFilters = async () => {
    const [sg, cg] = await Promise.all([
      (supabase as any).from("academic_subjects").select("id, name, color").order("name").limit(200),
      (supabase as any).from("class_groups").select("id, name").order("name").limit(200),
    ]);
    setSubjects(sg.data || []);
    setClassGroups(cg.data || []);
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      // Build query
      let query = (supabase as any)
        .from("academic_attendance")
        .select(`
          id, student_id, status, marked_at,
          academic_sessions!inner(
            session_date, slot_id,
            timetable_slots!inner(
              period_number, day_of_week,
              academic_subjects(name),
              class_groups(name)
            )
          )
        `)
        .order("academic_sessions.session_date", { ascending: false })
        .limit(500);

      if (filterStatus !== "all") query = query.eq("status", filterStatus);
      if (filterFrom) query = query.gte("academic_sessions.session_date", filterFrom);
      if (filterTo) query = query.lte("academic_sessions.session_date", filterTo);

      const { data, error } = await query;
      if (error) throw error;

      // Gather student IDs and fetch profiles
      const studentIds = [...new Set((data || []).map((r: any) => r.student_id))];
      let profilesMap: Record<string, { full_name: string; email: string }> = {};
      if (studentIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", studentIds as string[]);
        (profiles || []).forEach((p: any) => { profilesMap[p.id] = p; });
      }

      const mapped: AttendanceRow[] = (data || []).map((r: any) => {
        const slot = r.academic_sessions?.timetable_slots;
        return {
          id: r.id,
          student_id: r.student_id,
          student_name: profilesMap[r.student_id]?.full_name || r.student_id,
          student_email: profilesMap[r.student_id]?.email || "",
          subject_name: slot?.academic_subjects?.name || "—",
          class_name: slot?.class_groups?.name || "Elective",
          session_date: r.academic_sessions?.session_date || "",
          period_number: slot?.period_number || 0,
          day_of_week: slot?.day_of_week || "",
          status: r.status,
          marked_at: r.marked_at,
        };
      });

      // Apply client-side filters (group/subject require slot relation)
      let filtered = mapped;
      if (filterGroup !== "all") {
        // We need to filter by class group — refetch with group filter
        // (Simplified: re-filter by class_name from already fetched data)
        const groupName = classGroups.find(g => g.id === filterGroup)?.name || "";
        filtered = filtered.filter(r => r.class_name === groupName);
      }
      if (filterSubject !== "all") {
        const subjectName = subjects.find(s => s.id === filterSubject)?.name || "";
        filtered = filtered.filter(r => r.subject_name === subjectName);
      }
      if (studentSearch) {
        const q = studentSearch.toLowerCase();
        filtered = filtered.filter(
          r => r.student_name.toLowerCase().includes(q) || r.student_email.toLowerCase().includes(q)
        );
      }

      setRows(filtered);
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: err.message || "Failed to load reports" });
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = ["Student", "Email", "Class", "Subject", "Date", "Day", "Period", "Status", "Marked At"];
    const dataRows = rows.map(r => [
      r.student_name,
      r.student_email,
      r.class_name,
      r.subject_name,
      r.session_date,
      r.day_of_week,
      `Period ${r.period_number}`,
      r.status,
      r.marked_at ? format(new Date(r.marked_at), "yyyy-MM-dd HH:mm") : "",
    ]);
    const csv = [headers, ...dataRows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `academic-attendance-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Summary counts
  const presentCount = rows.filter(r => r.status === "present").length;
  const lateCount = rows.filter(r => r.status === "late").length;
  const absentCount = rows.filter(r => r.status === "absent").length;
  const excusedCount = rows.filter(r => r.status === "excused").length;
  const presentPct = rows.length > 0 ? Math.round((presentCount / rows.length) * 100) : 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Academic Attendance Reports</h1>
            <p className="text-muted-foreground">Filter and export academic attendance data</p>
          </div>
          {rows.length > 0 && (
            <Button variant="outline" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label>Class Group</Label>
                <Select value={filterGroup} onValueChange={setFilterGroup}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All classes</SelectItem>
                    {classGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subject</Label>
                <Select value={filterSubject} onValueChange={setFilterSubject}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subjects</SelectItem>
                    {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="excused">Excused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>From date</Label>
                <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
              </div>
              <div>
                <Label>To date</Label>
                <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
              </div>
              <div>
                <Label>Student search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Name or email…"
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
            <Button className="mt-4" onClick={fetchReports} disabled={loading}>
              {loading ? "Loading…" : "Run Report"}
            </Button>
          </CardContent>
        </Card>

        {/* Summary cards */}
        {rows.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <ClipboardCheck className="w-8 h-8 text-green-600 shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{presentPct}%</p>
                  <p className="text-xs text-muted-foreground">Present rate</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <Users className="w-8 h-8 text-green-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{presentCount}</p>
                  <p className="text-xs text-muted-foreground">Present</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <Clock className="w-8 h-8 text-amber-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-amber-600">{lateCount}</p>
                  <p className="text-xs text-muted-foreground">Late</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-red-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{absentCount + excusedCount}</p>
                  <p className="text-xs text-muted-foreground">Absent / Excused</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Table */}
        {rows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Records ({rows.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(r => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{r.student_name}</p>
                            <p className="text-xs text-muted-foreground">{r.student_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{r.class_name}</TableCell>
                        <TableCell>{r.subject_name}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.session_date ? format(new Date(r.session_date), "dd MMM yyyy") : "—"}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{r.day_of_week}</span>
                          <br />
                          P{r.period_number}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${STATUS_COLORS[r.status]} border-0`}>
                            {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {rows.length === 0 && !loading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardCheck className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="font-medium">No records yet</p>
              <p className="text-sm text-muted-foreground mt-1">Apply filters and click "Run Report"</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AcademicAttendanceReports;
