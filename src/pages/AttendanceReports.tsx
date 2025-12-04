import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, AlertTriangle, Clock, UserX, CheckCircle, Calendar } from "lucide-react";
import { format } from "date-fns";

interface AttendanceNotification {
  id: string;
  session_id: string;
  student_id: string;
  activity_id: string;
  status: string;
  notified_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  notes: string | null;
  student_name?: string;
  student_email?: string;
  activity_title?: string;
  session_date?: string;
}

const AttendanceReports = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<AttendanceNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("admin");

  useEffect(() => {
    fetchUserRole();
    fetchNotifications();
  }, [filterStatus, filterDate]);

  const fetchUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData) {
      setUserRole(roleData.role);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const role = roleData?.role;
      const isAdminOrMod = role === "admin" || role === "moderator";

      let query = supabase
        .from("attendance_notifications")
        .select(`
          *,
          attendance_sessions!inner (
            session_date,
            activities!inner (
              id,
              title,
              teacher_id
            )
          ),
          profiles:student_id (
            full_name,
            email
          )
        `)
        .order("notified_at", { ascending: false });

      // Teachers only see their own activities
      if (!isAdminOrMod) {
        query = query.eq("attendance_sessions.activities.teacher_id", user.id);
      }

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      if (filterDate) {
        query = query.eq("attendance_sessions.session_date", filterDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedData = (data || []).map((item: any) => ({
        id: item.id,
        session_id: item.session_id,
        student_id: item.student_id,
        activity_id: item.activity_id,
        status: item.status,
        notified_at: item.notified_at,
        acknowledged_by: item.acknowledged_by,
        acknowledged_at: item.acknowledged_at,
        notes: item.notes,
        student_name: item.profiles?.full_name || "Unknown",
        student_email: item.profiles?.email || "",
        activity_title: item.attendance_sessions?.activities?.title || "Unknown",
        session_date: item.attendance_sessions?.session_date,
      }));

      setNotifications(formattedData);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load attendance reports",
      });
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeNotification = async (notificationId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("attendance_notifications")
        .update({
          acknowledged_by: user.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq("id", notificationId);

      if (error) throw error;

      toast({
        title: "Acknowledged",
        description: "Notification has been acknowledged",
      });

      fetchNotifications();
    } catch (error) {
      console.error("Error acknowledging notification:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to acknowledge notification",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "absent":
        return <Badge variant="destructive" className="gap-1"><UserX className="w-3 h-3" /> Absent</Badge>;
      case "late":
        return <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800"><Clock className="w-3 h-3" /> Late</Badge>;
      case "excused":
        return <Badge variant="outline" className="gap-1 bg-blue-100 text-blue-800"><CheckCircle className="w-3 h-3" /> Excused</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const absentCount = notifications.filter(n => n.status === "absent").length;
  const lateCount = notifications.filter(n => n.status === "late").length;
  const excusedCount = notifications.filter(n => n.status === "excused").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/${userRole}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Attendance Reports</h1>
            <p className="text-sm text-muted-foreground">View absent, late, and excused students</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-destructive/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Absent</p>
                  <p className="text-3xl font-bold text-destructive">{absentCount}</p>
                </div>
                <UserX className="w-10 h-10 text-destructive/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-500/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Late</p>
                  <p className="text-3xl font-bold text-amber-600">{lateCount}</p>
                </div>
                <Clock className="w-10 h-10 text-amber-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-500/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Excused</p>
                  <p className="text-3xl font-bold text-blue-600">{excusedCount}</p>
                </div>
                <CheckCircle className="w-10 h-10 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="excused">Excused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Date</label>
                <Input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Attendance Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No attendance issues found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reported</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{notification.student_name}</p>
                          <p className="text-sm text-muted-foreground">{notification.student_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{notification.activity_title}</TableCell>
                      <TableCell>
                        {notification.session_date && format(new Date(notification.session_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{getStatusBadge(notification.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(notification.notified_at), "MMM d, HH:mm")}
                      </TableCell>
                      <TableCell>
                        {notification.acknowledged_at ? (
                          <Badge variant="outline" className="bg-green-100 text-green-800">
                            Acknowledged
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => acknowledgeNotification(notification.id)}
                          >
                            Acknowledge
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AttendanceReports;
