import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download } from "lucide-react";
import { format } from "date-fns";
import FloatingChatButton from "@/components/student/FloatingChatButton";

const AcademicAttendanceReports = () => {
  const { toast } = useToast();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [startDate, setStartDate] = useState(format(new Date(Date.now() - 30 * 86400000), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const [c, s] = await Promise.all([
        (supabase as any).from("class_groups").select("id, name").order("name"),
        (supabase as any).from("academic_subjects").select("id, name, code").order("name"),
      ]);
      setClasses(c.data || []);
      setSubjects(s.data || []);
    };
    fetch();
  }, []);

  const fetchRecords = async () => {
    if (!selectedClass) { toast({ title: "Select a class group" }); return; }
    setLoading(true);
    try {
      // Get members of class
      const { data: members } = await (supabase as any).from("class_group_members").select("student_id").eq("class_group_id", selectedClass);
      const studentIds = members?.map((m: any) => m.student_id) || [];
      if (!studentIds.length) { setRecords([]); setLoading(false); return; }

      // Get profiles
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", studentIds);

      // Get sessions in date range
      let slotsQuery = (supabase as any).from("timetable_slots").select("id, subject_id").eq("class_group_id", selectedClass);
      if (selectedSubject !== "all") slotsQuery = slotsQuery.eq("subject_id", selectedSubject);
      const { data: slotsData } = await slotsQuery;
      const slotIds = slotsData?.map((s: any) => s.id) || [];
      if (!slotIds.length) { setRecords([]); setLoading(false); return; }

      const { data: sessions } = await (supabase as any).from("academic_sessions").select("id, slot_id, session_date").in("slot_id", slotIds).gte("session_date", startDate).lte("session_date", endDate);
      const sessionIds = sessions?.map((s: any) => s.id) || [];
      if (!sessionIds.length) { setRecords([]); setLoading(false); return; }

      const { data: attendance } = await (supabase as any).from("academic_attendance").select("*").in("session_id", sessionIds).in("student_id", studentIds);

      // Build summary per student per subject
      const summary: Record<string, { name: string; total: number; present: number; absent: number; late: number; excused: number }> = {};
      for (const sid of studentIds) {
        const p = profiles?.find((pp: any) => pp.id === sid);
        summary[sid] = { name: p?.full_name || "?", total: 0, present: 0, absent: 0, late: 0, excused: 0 };
      }
      for (const a of (attendance || [])) {
        const s = summary[a.student_id];
        if (!s) continue;
        s.total++;
        if (a.status === "present") s.present++;
        else if (a.status === "absent") s.absent++;
        else if (a.status === "late") s.late++;
        else if (a.status === "excused") s.excused++;
      }
      setRecords(Object.entries(summary).map(([id, v]) => ({ id, ...v, pct: v.total > 0 ? Math.round((v.present / v.total) * 100) : null })));
    } catch (error) {
      console.error("Error fetching:", error);
    }
    setLoading(false);
  };

  const exportCSV = () => {
    const header = "Student,Total,Present,Absent,Late,Excused,%Present\n";
    const rows = records.map(r => `"${r.name}",${r.total},${r.present},${r.absent},${r.late},${r.excused},${r.pct ?? "N/A"}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `academic-attendance-${startDate}-${endDate}.csv`;
    a.click();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Academic Attendance Reports</h1>

        <Card>
          <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label>Class Group</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subject</Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>From</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
              <div><Label>To</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={fetchRecords} disabled={loading}>{loading ? "Loading…" : "Generate Report"}</Button>
              <Button variant="outline" disabled={loading || records.length === 0} onClick={async () => {
                try {
                  const { data, error } = await supabase.functions.invoke("generate-academic-pdf-report", {
                    body: { classGroupId: selectedClass, subjectId: selectedSubject, startDate, endDate },
                  });
                  if (error) throw error;
                  if (data.error) throw new Error(data.error);
                  const link = document.createElement("a");
                  link.href = `data:application/pdf;base64,${data.pdf}`;
                  link.download = data.filename;
                  link.click();
                  toast({ title: "PDF Downloaded" });
                } catch (err: any) {
                  toast({ variant: "destructive", title: "PDF Error", description: err.message });
                }
              }}>
                <Download className="w-4 h-4 mr-2" />PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {records.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Results ({records.length} students)</CardTitle>
              <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-2" />CSV</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Present</TableHead>
                    <TableHead className="text-center">Absent</TableHead>
                    <TableHead className="text-center">Late</TableHead>
                    <TableHead className="text-center">Excused</TableHead>
                    <TableHead className="text-center">% Present</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.sort((a, b) => a.name.localeCompare(b.name)).map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-center">{r.total}</TableCell>
                      <TableCell className="text-center">{r.present}</TableCell>
                      <TableCell className="text-center">{r.absent}</TableCell>
                      <TableCell className="text-center">{r.late}</TableCell>
                      <TableCell className="text-center">{r.excused}</TableCell>
                      <TableCell className="text-center">
                        {r.pct !== null ? (
                          <Badge variant={r.pct >= 80 ? "default" : r.pct >= 60 ? "secondary" : "destructive"}>{r.pct}%</Badge>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
      <FloatingChatButton />
    </AdminLayout>
  );
};

export default AcademicAttendanceReports;
