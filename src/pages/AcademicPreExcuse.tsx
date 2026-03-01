import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UserCheck, Search, AlertCircle } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import FloatingChatButton from "@/components/student/FloatingChatButton";
import { DATE_RANGE_LIMITS, QUERY_LIMITS } from "@/lib/constants";

interface Student { id: string; full_name: string; email: string; }
interface SlotInfo { slotId: string; subjectName: string; className: string; dayLabel: string; periodLabel: string; }

const DAY_LABELS_MAP: Record<number, string> = { 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday" };

const AcademicPreExcuse = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [slotOptions, setSlotOptions] = useState<SlotInfo[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [excuseDate, setExcuseDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reason, setReason] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      const { data: studentRoles } = await supabase.from("user_roles").select("user_id").eq("role", "student").limit(QUERY_LIMITS.STUDENTS);
      const ids = (studentRoles || []).map(r => r.user_id);
      if (ids.length) {
        const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids).order("full_name").limit(QUERY_LIMITS.STUDENTS);
        setStudents(data || []);
      }
    };
    fetchStudents();
  }, []);

  useEffect(() => {
    if (excuseDate) {
      const diff = differenceInDays(parseISO(excuseDate), new Date());
      if (diff < -DATE_RANGE_LIMITS.MAX_DAYS_PAST) setDateError(`Date cannot be more than ${DATE_RANGE_LIMITS.MAX_DAYS_PAST} days in the past`);
      else if (diff > DATE_RANGE_LIMITS.MAX_DAYS_FUTURE) setDateError(`Date cannot be more than ${DATE_RANGE_LIMITS.MAX_DAYS_FUTURE} days in the future`);
      else setDateError(null);
    }
  }, [excuseDate]);

  useEffect(() => {
    if (!selectedStudent) { setSlotOptions([]); setSelectedSlot(""); return; }
    const loadSlots = async () => {
      setLoadingSlots(true);
      // Get class memberships
      const { data: memberships } = await (supabase as any).from("class_group_members").select("class_group_id").eq("student_id", selectedStudent);
      const groupIds = memberships?.map((m: any) => m.class_group_id) || [];

      let allSlots: any[] = [];
      if (groupIds.length) {
        const { data } = await (supabase as any).from("timetable_slots").select("id, subject_id, class_group_id, day_of_week, period_number").in("class_group_id", groupIds);
        allSlots = data || [];
      }
      // + elective enrollments
      const { data: enrollments } = await (supabase as any).from("timetable_enrollments").select("slot_id").eq("student_id", selectedStudent);
      if (enrollments?.length) {
        const { data: electiveSlots } = await (supabase as any).from("timetable_slots").select("id, subject_id, class_group_id, day_of_week, period_number").in("id", enrollments.map((e: any) => e.slot_id));
        allSlots = [...allSlots, ...(electiveSlots || [])];
      }

      // Get subjects, class groups, periods for labels
      const [subjectsRes, classesRes, periodsRes] = await Promise.all([
        (supabase as any).from("academic_subjects").select("id, name"),
        (supabase as any).from("class_groups").select("id, name"),
        (supabase as any).from("academic_periods").select("sort_order, label").eq("is_break", false),
      ]);
      const subMap = new Map((subjectsRes.data || []).map((s: any) => [s.id, s.name]));
      const cgMap = new Map((classesRes.data || []).map((c: any) => [c.id, c.name]));
      const perMap = new Map((periodsRes.data || []).map((p: any) => [p.sort_order, p.label]));

      setSlotOptions(allSlots.map((sl: any): SlotInfo => ({
        slotId: sl.id,
        subjectName: String(subMap.get(sl.subject_id) || "?"),
        className: String(cgMap.get(sl.class_group_id) || ""),
        dayLabel: DAY_LABELS_MAP[sl.day_of_week as number] || `Day ${sl.day_of_week}`,
        periodLabel: String(perMap.get(sl.period_number) || `P${sl.period_number}`),
      })));
      setSelectedSlot("");
      setLoadingSlots(false);
    };
    loadSlots();
  }, [selectedStudent]);

  const handleSubmit = async () => {
    if (!selectedStudent || !selectedSlot || !excuseDate) {
      toast({ variant: "destructive", title: "Missing fields", description: "Please fill in all required fields" });
      return;
    }
    if (dateError) { toast({ variant: "destructive", title: "Invalid date", description: dateError }); return; }
    if (loading) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await (supabase as any).from("academic_excuses").upsert({
        student_id: selectedStudent,
        slot_id: selectedSlot,
        excuse_date: excuseDate,
        reason: reason.trim() || "Pre-excused by admin",
        created_by: user.id,
      }, { onConflict: "student_id,slot_id,excuse_date" });

      if (error) throw error;

      // Also create an excused attendance record if session exists
      const { data: session } = await (supabase as any).from("academic_sessions").select("id").eq("slot_id", selectedSlot).eq("session_date", excuseDate).maybeSingle();
      if (session) {
        await (supabase as any).from("academic_attendance").upsert({
          session_id: session.id,
          student_id: selectedStudent,
          status: "excused",
        }, { onConflict: "session_id,student_id" });
      }

      toast({ title: "Student Excused", description: `Successfully pre-excused for ${format(parseISO(excuseDate), "MMM d, yyyy")}` });
      setSelectedStudent("");
      setSelectedSlot("");
      setReason("");
      setSlotOptions([]);
    } catch (error: any) {
      console.error("Pre-excuse error:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to pre-excuse student" });
    }
    setLoading(false);
  };

  const filteredStudents = students.filter(s =>
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-primary" />
            Pre-Excuse Students (Academic)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Excuse a student from a class within ±{DATE_RANGE_LIMITS.MAX_DAYS_PAST} days
          </p>
        </div>

        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-2">
              <Label>Search Student</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by name or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Select Student *</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger><SelectValue placeholder="Choose a student" /></SelectTrigger>
                <SelectContent>
                  {filteredStudents.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name} ({s.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedStudent && loadingSlots && (
              <div className="flex gap-2"><Skeleton className="h-6 w-32" /><Skeleton className="h-6 w-28" /></div>
            )}

            {selectedStudent && !loadingSlots && slotOptions.length === 0 && (
              <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>No timetable slots found for this student.</AlertDescription></Alert>
            )}

            {slotOptions.length > 0 && (
              <div className="space-y-2">
                <Label>Select Class Slot *</Label>
                <Select value={selectedSlot} onValueChange={setSelectedSlot}>
                  <SelectTrigger><SelectValue placeholder="Choose a class slot" /></SelectTrigger>
                  <SelectContent>
                    {slotOptions.map(sl => (
                      <SelectItem key={sl.slotId} value={sl.slotId}>
                        {sl.dayLabel} {sl.periodLabel} — {sl.subjectName} {sl.className && `(${sl.className})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {slotOptions.slice(0, 6).map(sl => (
                    <Badge key={sl.slotId} variant={selectedSlot === sl.slotId ? "default" : "outline"}
                      className="cursor-pointer text-xs" onClick={() => setSelectedSlot(sl.slotId)}>
                      {sl.dayLabel.slice(0, 3)} {sl.periodLabel} — {sl.subjectName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={excuseDate} onChange={e => setExcuseDate(e.target.value)} />
                {dateError && <p className="text-xs text-destructive">{dateError}</p>}
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea placeholder="Optional reason..." value={reason} onChange={e => setReason(e.target.value)} rows={2} />
              </div>
            </div>

            <Button onClick={handleSubmit} disabled={loading || !selectedStudent || !selectedSlot || !!dateError} className="w-full">
              {loading ? "Submitting..." : "Pre-Excuse Student"}
            </Button>
          </CardContent>
        </Card>
      </div>
      <FloatingChatButton />
    </AdminLayout>
  );
};

export default AcademicPreExcuse;
