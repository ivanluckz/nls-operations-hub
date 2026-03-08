import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  QrCode, LogOut, Stethoscope, ClipboardList, ShieldCheck,
  Users, AlertTriangle, CheckCircle2, Send
} from "lucide-react";
import MealQRScanner from "@/components/kitchen/MealQRScanner";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import AttendanceChart from "@/components/dashboard/AttendanceChart";

interface Visit {
  id: string;
  student_id: string;
  condition: string;
  treatment: string | null;
  notes: string | null;
  visit_date: string;
  scanned_at: string;
  student_name?: string;
}

interface Clearance {
  id: string;
  student_id: string;
  status: string;
  restriction_reason: string | null;
  valid_until: string | null;
  created_at: string;
  student_name?: string;
}

const MedicalDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);

  // Scanning
  const [scanning, setScanning] = useState(false);
  const [scannedStudentId, setScannedStudentId] = useState<string | null>(null);
  const [scannedStudentName, setScannedStudentName] = useState("");

  // Visit form
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [condition, setCondition] = useState("");
  const [treatment, setTreatment] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Clearance form
  const [clearanceDialogOpen, setClearanceDialogOpen] = useState(false);
  const [clearanceStatus, setClearanceStatus] = useState<"cleared" | "restricted">("restricted");
  const [restrictionReason, setRestrictionReason] = useState("");
  const [validUntil, setValidUntil] = useState("");

  // Data
  const [todayVisits, setTodayVisits] = useState<Visit[]>([]);
  const [activeClearances, setActiveClearances] = useState<Clearance[]>([]);
  const [todayWorkoutCount, setTodayWorkoutCount] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
    fetchData();
  }, []);

  const fetchData = async () => {
    const today = new Date().toISOString().split("T")[0];

    const [{ data: visits }, { data: clearances }, { count: workoutCount }] = await Promise.all([
      (supabase as any).from("medical_visits").select("*").eq("visit_date", today).order("scanned_at", { ascending: false }),
      (supabase as any).from("workout_clearances").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("workout_attendance").select("id", { count: "exact", head: true }).eq("workout_date", today),
    ]);

    // Get student names
    const studentIds = new Set<string>();
    (visits || []).forEach((v: any) => studentIds.add(v.student_id));
    (clearances || []).forEach((c: any) => studentIds.add(c.student_id));

    const nameMap: Record<string, string> = {};
    if (studentIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", Array.from(studentIds));
      (profiles || []).forEach((p) => { nameMap[p.id] = p.full_name; });
    }

    setTodayVisits((visits || []).map((v: any) => ({ ...v, student_name: nameMap[v.student_id] || "Unknown" })));
    setActiveClearances((clearances || []).map((c: any) => ({ ...c, student_name: nameMap[c.student_id] || "Unknown" })));
    setTodayWorkoutCount(workoutCount || 0);
  };

  const handleScan = useCallback(async (studentId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", studentId)
      .single();

    setScannedStudentId(studentId);
    setScannedStudentName(profile?.full_name || "Unknown Student");
    setScanning(false);
    setVisitDialogOpen(true);
    setCondition("");
    setTreatment("");
    setVisitNotes("");
  }, []);

  const saveVisit = async () => {
    if (!scannedStudentId || !userId || !condition.trim()) return;
    setSaving(true);

    try {
      const { error } = await (supabase as any).from("medical_visits").insert({
        student_id: scannedStudentId,
        medical_staff_id: userId,
        condition: condition.trim(),
        treatment: treatment.trim() || null,
        notes: visitNotes.trim() || null,
      });

      if (error) throw error;

      toast({ title: "✅ Visit Recorded", description: `${scannedStudentName} - ${condition}` });
      setVisitDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openClearanceDialog = () => {
    if (!scannedStudentId) return;
    setVisitDialogOpen(false);
    setClearanceDialogOpen(true);
    setClearanceStatus("restricted");
    setRestrictionReason("");
    setValidUntil("");
  };

  const saveClearance = async () => {
    if (!scannedStudentId || !userId) return;
    setSaving(true);

    try {
      // Upsert clearance - delete existing first
      await (supabase as any).from("workout_clearances").delete().eq("student_id", scannedStudentId);

      if (clearanceStatus === "cleared") {
        // Remove restriction (just deleted above)
        toast({ title: "✅ Student Cleared", description: `${scannedStudentName} is cleared for workouts` });
      } else {
        const { error } = await (supabase as any).from("workout_clearances").insert({
          student_id: scannedStudentId,
          cleared_by: userId,
          status: "restricted",
          restriction_reason: restrictionReason.trim() || null,
          valid_until: validUntil || null,
        });
        if (error) throw error;
        toast({ title: "⚠️ Student Restricted", description: `${scannedStudentName} restricted from workouts` });
      }

      setClearanceDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // Scanning view
  if (scanning) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scan Student
            </h2>
            <Button variant="outline" onClick={() => setScanning(false)}>Cancel</Button>
          </div>
          <Card>
            <CardContent className="p-4">
              <MealQRScanner onScan={handleScan} isActive={true} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const restrictedCount = activeClearances.filter(c => c.status === "restricted").length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-gradient-to-r from-rose-500/5 via-background to-rose-500/5">
        <div className="container mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center">
              <Stethoscope className="h-6 w-6 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Medical Dashboard</h1>
              <p className="text-sm text-muted-foreground">Student health & clearances</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <ClipboardList className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{todayVisits.length}</p>
              <p className="text-sm text-muted-foreground">Visits Today</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
              <p className="text-2xl font-bold">{restrictedCount}</p>
              <p className="text-sm text-muted-foreground">Restricted</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-2xl font-bold">{todayWorkoutCount}</p>
              <p className="text-sm text-muted-foreground">At Workouts</p>
            </CardContent>
          </Card>
        </div>

        {/* Scan Button */}
        <Button size="lg" className="w-full" onClick={() => setScanning(true)}>
          <QrCode className="h-5 w-5 mr-2" />
          Scan Student QR Code
        </Button>

        {/* Attendance Overview */}
        <AttendanceChart title="Workout Attendance (Last 7 Days)" />

        <Tabs defaultValue="visits" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="visits"><ClipboardList className="h-4 w-4 mr-2" /> Visits</TabsTrigger>
            <TabsTrigger value="clearances"><ShieldCheck className="h-4 w-4 mr-2" /> Clearances</TabsTrigger>
          </TabsList>

          {/* VISITS TAB */}
          <TabsContent value="visits">
            <Card>
              <CardHeader>
                <CardTitle>Today's Visits</CardTitle>
                <CardDescription>{todayVisits.length} students seen today</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead>Treatment</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {todayVisits.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium">{v.student_name}</TableCell>
                          <TableCell>{v.condition}</TableCell>
                          <TableCell>{v.treatment || "—"}</TableCell>
                          <TableCell>{new Date(v.scanned_at).toLocaleTimeString()}</TableCell>
                        </TableRow>
                      ))}
                      {todayVisits.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">No visits today</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CLEARANCES TAB */}
          <TabsContent value="clearances">
            <Card>
              <CardHeader>
                <CardTitle>Workout Clearances</CardTitle>
                <CardDescription>Students currently restricted from workouts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Until</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeClearances.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.student_name}</TableCell>
                          <TableCell>
                            <Badge variant={c.status === "restricted" ? "destructive" : "default"}>
                              {c.status === "restricted" ? "Restricted" : "Cleared"}
                            </Badge>
                          </TableCell>
                          <TableCell>{c.restriction_reason || "—"}</TableCell>
                          <TableCell>{c.valid_until || "Indefinite"}</TableCell>
                        </TableRow>
                      ))}
                      {activeClearances.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">No active restrictions</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Visit Dialog */}
      <Dialog open={visitDialogOpen} onOpenChange={setVisitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Medical Visit</DialogTitle>
            <DialogDescription>Recording visit for {scannedStudentName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Condition *</label>
              <Input
                placeholder="e.g., Headache, Sprain, Fever..."
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Treatment</label>
              <Input
                placeholder="e.g., Rest, Ice pack, Paracetamol..."
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                placeholder="Additional notes..."
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={openClearanceDialog}>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Set Workout Clearance
            </Button>
            <Button onClick={saveVisit} disabled={saving || !condition.trim()}>
              {saving ? "Saving..." : "Save Visit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clearance Dialog */}
      <Dialog open={clearanceDialogOpen} onOpenChange={setClearanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workout Clearance</DialogTitle>
            <DialogDescription>Set workout status for {scannedStudentName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={clearanceStatus} onValueChange={(v) => setClearanceStatus(v as "cleared" | "restricted")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restricted">🚫 Restricted</SelectItem>
                  <SelectItem value="cleared">✅ Cleared</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {clearanceStatus === "restricted" && (
              <>
                <div>
                  <label className="text-sm font-medium">Reason</label>
                  <Input
                    placeholder="e.g., Ankle injury, recovering from illness..."
                    value={restrictionReason}
                    onChange={(e) => setRestrictionReason(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Restricted Until</label>
                  <Input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={saveClearance} disabled={saving}>
              {saving ? "Saving..." : "Save Clearance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MedicalDashboard;
