import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Users, Shield, UserCog, GraduationCap, UserX, Trash2, Edit, Search, CheckSquare, Filter } from "lucide-react";
import StudentBulkImport from "@/components/StudentBulkImport";
import TeacherBulkImport from "@/components/TeacherBulkImport";
import { AdminLayout } from "@/components/admin/AdminLayout";
import IOSSchoolSkeleton from "@/components/IOSSchoolSkeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

type AppRole = "student" | "moderator" | "admin" | "teacher" | "rl_coach" | "medical";

interface House {
  id: string;
  name: string;
  color: string;
}

const TEACHER_EMAILS = [
  "alina.herzog@ntare-louisenlund.org",
  "alphonse.maniraguha@ntare-louisenlund.org",
  "bhatia.sakshi@ntare-louisenlund.org",
  "caleb.asiso@ntare-louisenlund.org",
  "christoph.frickhinger@ntare-louisenlund.org",
  "david.nishimwe@ntare-louisenlund.org",
  "david.niyitegeka@ntare-louisenlund.org",
  "davis.omondi@ntare-louisenlund.org",
  "edagbo.blessing@ntare-louisenlund.org",
  "francine.mukankusi@ntare-louisenlund.org",
  "gloria.mutoni@ntare-louisenlund.org",
  "irene.gashagaza@ntare-louisenlund.org",
  "jean.mbarushimana@ntare-louisenlund.org",
  "jean.murenzi@ntare-louisenlund.org",
  "jean.nyabyenda@ntare-louisenlund.org",
  "kathleen.challenor@ntare-louisenlund.org",
  "kennedy.koja@ntare-louisenlund.org",
  "linnet.chebet@ntare-louisenlund.org",
  "lisa.rucyaha@ntare-louisenlund.org",
  "mauritz.viljoen@ntare-louisenlund.org",
  "mildred.nabunje@ntare-louisenlund.org",
  "patrick.muhire@ntare-louisenlund.org",
  "pierre.niyibigira@ntare-louisenlund.org",
  "piotr-tomaszczuk@ntare-louisenlund.org",
  "pontien.ntirenganya@ntare-louisenlund.org",
  "praveen.rana@ntare-louisenlund.org",
  "robert.tugume@ntare-louisenlund.org",
  "scovia.kabanyana@ntare-louisenlund.org",
  "sebastian.wagner@ntare-louisenlund.org",
  "solange.uwiduhaye@ntare-louisenlund.org",
  "stacy.hill@ntare-louisenlund.org",
  "welford.mclellan@ntare-louisenlund.org",
];

interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  house_id: string | null;
  mentor_id: string | null;
  roles: Array<{ role: AppRole }>;
  banned: boolean;
  created_at: string;
}

const UserManagement = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<AppRole>("student");
  const [editHouseId, setEditHouseId] = useState<string | null>(null);
  const [editMentorId, setEditMentorId] = useState<string | null>(null);
  const [houses, setHouses] = useState<House[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; full_name: string }[]>([]);
  const [allWorkouts, setAllWorkouts] = useState<{ id: string; name: string }[]>([]);
  const [editWorkoutIds, setEditWorkoutIds] = useState<string[]>([]);
  const [editStudentWorkoutId, setEditStudentWorkoutId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterMentor, setFilterMentor] = useState<string>("all");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkRoleDialogOpen, setBulkRoleDialogOpen] = useState(false);
  const [bulkRole, setBulkRole] = useState<AppRole>("student");
  const [bulkUpdating, setBulkUpdating] = useState(false);

  async function fetchUsersInit() {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, house_id, mentor_id, banned, created_at" as any)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const usersWithRoles: Profile[] = (profilesData || []).map((profile: any) => ({
        ...profile,
        roles: (rolesData || []).filter((r) => r.user_id === profile.id) as any
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsersInit();
    (supabase as any).from("houses").select("id, name, color").order("name").then(({ data }: any) => {
      if (data) setHouses(data);
    });
    (supabase as any).from("profiles").select("id, full_name").in("email", TEACHER_EMAILS).order("full_name").then(({ data }: any) => {
      if (data) setTeachers(data.filter((t: any) => t.full_name));
    });
    (supabase as any).from("workouts").select("id, name").order("name").then(({ data }: any) => {
      if (data) setAllWorkouts(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-open edit dialog from URL param (global search deep-link)
  useEffect(() => {
    const editUserId = searchParams.get("editUser");
    if (editUserId && users.length > 0) {
      const user = users.find((u) => u.id === editUserId);
      if (user) {
        openEditDialog(user);
        setSearchParams({}, { replace: true });
      }
    }
  }, [users, searchParams, setSearchParams]);

  const fetchUsers = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, house_id, mentor_id, banned, created_at" as any)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const usersWithRoles: Profile[] = (profilesData || []).map((profile: any) => ({
        ...profile,
        roles: (rolesData || []).filter((r) => r.user_id === profile.id) as any
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = async (user: Profile) => {
    setEditingUser(user);
    setEditName(user.full_name);
    setEditRole(user.roles[0]?.role || "student");
    setEditHouseId(user.house_id || null);
    setEditMentorId((user as any).mentor_id || null);
    // Pre-load workout assignments for this user (only relevant for teachers)
    const { data } = await (supabase as any)
      .from("workout_teachers")
      .select("workout_id")
      .eq("teacher_id", user.id);
    setEditWorkoutIds((data || []).map((r: any) => r.workout_id));
    // Pre-load student's morning workout signup (single workout enforced)
    const { data: signups } = await (supabase as any)
      .from("workout_signups")
      .select("workout_id, created_at")
      .eq("student_id", user.id)
      .order("created_at", { ascending: true });
    setEditStudentWorkoutId(signups?.[0]?.workout_id ?? null);
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: editName, house_id: editHouseId, mentor_id: editMentorId } as any)
        .eq("id", editingUser.id);
      if (profileError) throw profileError;

      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", editingUser.id);
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({ user_id: editingUser.id, role: editRole });
      if (insertError) throw insertError;

      // Sync morning workout assignments (only meaningful for teachers)
      await (supabase as any).from("workout_teachers").delete().eq("teacher_id", editingUser.id);
      const uniqueWorkoutIds = Array.from(new Set(editWorkoutIds.filter(Boolean)));
      if (editRole === "teacher" && uniqueWorkoutIds.length) {
        const rows = uniqueWorkoutIds.map((wid) => ({ workout_id: wid, teacher_id: editingUser.id }));
        const { error: wtError } = await (supabase as any)
          .from("workout_teachers")
          .upsert(rows, { onConflict: "workout_id,teacher_id", ignoreDuplicates: true });
        if (wtError) throw wtError;
      }

      // Sync student's morning workout (enforce single workout per student)
      if (editRole === "student") {
        const { error: delSignupErr } = await (supabase as any)
          .from("workout_signups")
          .delete()
          .eq("student_id", editingUser.id);
        if (delSignupErr) throw delSignupErr;
        if (editStudentWorkoutId) {
          const { error: insSignupErr } = await (supabase as any)
            .from("workout_signups")
            .insert({ student_id: editingUser.id, workout_id: editStudentWorkoutId });
          if (insSignupErr) throw insSignupErr;
        }
      }

      toast({ title: "Success", description: "User updated successfully" });
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      toast({ title: "Error", description: "Failed to update user", variant: "destructive" });
    }
  };

  const handleBanUser = async (userId: string, currentBanStatus: boolean) => {
    const action = currentBanStatus ? "unban" : "ban";
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ banned: !currentBanStatus })
        .eq("id", userId);
      if (error) throw error;
      toast({ title: "Success", description: currentBanStatus ? "User unbanned successfully" : "User banned successfully" });
      fetchUsers();
    } catch (error) {
      console.error("Error banning user:", error);
      toast({ title: "Error", description: "Failed to ban/unban user", variant: "destructive" });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
      toast({ title: "Success", description: "User deleted successfully" });
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({ title: "Error", description: "Failed to delete user", variant: "destructive" });
    }
  };

  // Bulk role change
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAll = (userList: Profile[]) => {
    const allIds = userList.map(u => u.id);
    const allSelected = allIds.every(id => selectedUsers.has(id));
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (allSelected) {
        allIds.forEach(id => next.delete(id));
      } else {
        allIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleBulkRoleChange = async () => {
    if (selectedUsers.size === 0) return;
    setBulkUpdating(true);
    try {
      // Delete existing roles for selected users
      for (const userId of selectedUsers) {
        const { error: deleteError } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId);
        if (deleteError) throw deleteError;

        const { error: insertError } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: bulkRole });
        if (insertError) throw insertError;
      }

      toast({
        title: "Success",
        description: `Changed role to ${bulkRole} for ${selectedUsers.size} user(s)`,
      });
      setSelectedUsers(new Set());
      setBulkRoleDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error("Error bulk updating roles:", error);
      toast({ title: "Error", description: "Failed to bulk update roles", variant: "destructive" });
    } finally {
      setBulkUpdating(false);
    }
  };

  const filterBySearch = (userList: Profile[]) => {
    let result = userList;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(user =>
        user.full_name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
      );
    }
    if (filterClass !== "all") {
      if (filterClass === "none") {
        result = result.filter(user => !(user as any).student_class);
      } else {
        result = result.filter(user => (user as any).student_class === filterClass);
      }
    }
    if (filterMentor !== "all") {
      if (filterMentor === "none") {
        result = result.filter(user => !(user as any).mentor_id);
      } else {
        result = result.filter(user => (user as any).mentor_id === filterMentor);
      }
    }
    return result;
  };

  const getUsersByRole = (role: string) => {
    return users.filter(user => user.roles[0]?.role === role);
  };

  const renderUserTable = (filteredUsers: Profile[]) => {
    const allSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUsers.has(u.id));
    const someSelected = filteredUsers.some(u => selectedUsers.has(u.id));

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    const input = el.querySelector('button');
                    if (input) input.setAttribute('data-indeterminate', String(someSelected && !allSelected));
                  }
                }}
                onCheckedChange={() => toggleSelectAll(filteredUsers)}
              />
            </TableHead>
            <TableHead className="w-12"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Class</TableHead>
            <TableHead>Mentor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground">
                No users found in this category
              </TableCell>
            </TableRow>
          ) : (
            filteredUsers.map((user) => (
              <TableRow key={user.id} className={selectedUsers.has(user.id) ? "bg-primary/5" : ""}>
                <TableCell>
                  <Checkbox
                    checked={selectedUsers.has(user.id)}
                    onCheckedChange={() => toggleUserSelection(user.id)}
                  />
                </TableCell>
                <TableCell>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {getInitials(user.full_name)}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell className="font-medium">{user.full_name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {user.roles[0]?.role || "none"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {(user as any).student_class ? (
                    <Badge variant="secondary">{(user as any).student_class}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {(user as any).mentor_id ? (
                    <span className="text-sm">{teachers.find(t => t.id === (user as any).mentor_id)?.full_name || "Unknown"}</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {user.banned ? (
                    <Badge variant="destructive">Banned</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                      Active
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEditDialog(user)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleBanUser(user.id, user.banned)}>
                      <UserX className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteUser(user.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    );
  };

  if (loading) {
    return (
      <AdminLayout>
        <IOSSchoolSkeleton fullScreen={false} />
      </AdminLayout>
    );
  }

  const filteredUsers = filterBySearch(users);
  const adminUsers = filterBySearch(getUsersByRole("admin"));
  const moderatorUsers = filterBySearch(getUsersByRole("moderator"));
  const teacherUsers = filterBySearch(getUsersByRole("teacher"));
  const studentUsers = filterBySearch(getUsersByRole("student"));
  const rlCoachUsers = filterBySearch(getUsersByRole("rl_coach"));
  const medicalUsers = filterBySearch(getUsersByRole("medical"));
  const kitchenUsers = filterBySearch(getUsersByRole("kitchen_staff"));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground">View and manage users by role</p>
          </div>
          <div className="flex gap-2">
            <TeacherBulkImport onComplete={fetchUsers} />
            <StudentBulkImport onComplete={fetchUsers} />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admins</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminUsers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Moderators</CardTitle>
              <UserCog className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{moderatorUsers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Teachers</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teacherUsers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{studentUsers.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Bulk Action Bar */}
        {selectedUsers.size > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-primary" />
                <span className="font-medium">{selectedUsers.size} user(s) selected</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedUsers(new Set())}>
                  Clear Selection
                </Button>
                <Button size="sm" onClick={() => setBulkRoleDialogOpen(true)}>
                  Change Role
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Users by Role */}
        <Card>
          <CardHeader>
            <CardTitle>Users by Role</CardTitle>
            <CardDescription>
              Browse and manage users organized by their role. Select users with checkboxes for bulk role changes.
            </CardDescription>
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  <SelectItem value="none">No Class</SelectItem>
                  {["7A","7B","7C","7D","7E","8A","8B","8C","8D","8E","8F"].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterMentor} onValueChange={setFilterMentor}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Mentor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Mentors</SelectItem>
                  <SelectItem value="none">No Mentor</SelectItem>
                  {teachers.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="flex flex-wrap h-auto gap-1 bg-muted p-1">
                <TabsTrigger value="all">All ({filteredUsers.length})</TabsTrigger>
                <TabsTrigger value="admin">Admins ({adminUsers.length})</TabsTrigger>
                <TabsTrigger value="moderator">Mods ({moderatorUsers.length})</TabsTrigger>
                <TabsTrigger value="teacher">Teachers ({teacherUsers.length})</TabsTrigger>
                <TabsTrigger value="student">Students ({studentUsers.length})</TabsTrigger>
                <TabsTrigger value="rl_coach">RL Coaches ({rlCoachUsers.length})</TabsTrigger>
                <TabsTrigger value="medical">Medical ({medicalUsers.length})</TabsTrigger>
                <TabsTrigger value="kitchen_staff">Kitchen ({kitchenUsers.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="mt-6">{renderUserTable(filteredUsers)}</TabsContent>
              <TabsContent value="admin" className="mt-6">{renderUserTable(adminUsers)}</TabsContent>
              <TabsContent value="moderator" className="mt-6">{renderUserTable(moderatorUsers)}</TabsContent>
              <TabsContent value="teacher" className="mt-6">{renderUserTable(teacherUsers)}</TabsContent>
              <TabsContent value="student" className="mt-6">{renderUserTable(studentUsers)}</TabsContent>
              <TabsContent value="rl_coach" className="mt-6">{renderUserTable(rlCoachUsers)}</TabsContent>
              <TabsContent value="medical" className="mt-6">{renderUserTable(medicalUsers)}</TabsContent>
              <TabsContent value="kitchen_staff" className="mt-6">{renderUserTable(kitchenUsers)}</TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Edit User Dialog */}
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update user information and role</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Select value={editRole} onValueChange={(value: any) => setEditRole(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="rl_coach">RL Coach</SelectItem>
                    <SelectItem value="medical">Medical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="house">House</Label>
                <Select value={editHouseId || "none"} onValueChange={(v) => setEditHouseId(v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="No house" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No house</SelectItem>
                    {houses.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        <span style={{ color: h.color }}>{h.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editRole === "student" && (
                <div className="grid gap-2">
                  <Label htmlFor="mentor">Mentor Teacher</Label>
                  <Select value={editMentorId || "none"} onValueChange={(v) => setEditMentorId(v === "none" ? null : v)}>
                    <SelectTrigger><SelectValue placeholder="No mentor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No mentor</SelectItem>
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {editRole === "teacher" && (
                <div className="grid gap-2">
                  <Label>Morning Workouts assigned</Label>
                  {allWorkouts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No workouts created yet. Add some in Morning Workouts.</p>
                  ) : (
                    <div className="border rounded-md max-h-40 overflow-y-auto p-1">
                      {allWorkouts.map((w) => {
                        const on = editWorkoutIds.includes(w.id);
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => setEditWorkoutIds((prev) =>
                              prev.includes(w.id) ? prev.filter((x) => x !== w.id) : [...prev, w.id]
                            )}
                            className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between ${on ? "bg-primary/10" : "hover:bg-muted"}`}
                          >
                            <span>{w.name}</span>
                            {on && <Badge className="text-[10px]">Assigned</Badge>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
              <Button onClick={handleUpdateUser}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Role Change Dialog */}
        <Dialog open={bulkRoleDialogOpen} onOpenChange={setBulkRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bulk Role Change</DialogTitle>
              <DialogDescription>
                Change the role for {selectedUsers.size} selected user(s). This will replace their current role.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>New Role</Label>
                <Select value={bulkRole} onValueChange={(value: any) => setBulkRole(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="rl_coach">RL Coach</SelectItem>
                    <SelectItem value="medical">Medical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkRoleDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleBulkRoleChange} disabled={bulkUpdating}>
                {bulkUpdating ? "Updating..." : `Change ${selectedUsers.size} user(s)`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default UserManagement;
