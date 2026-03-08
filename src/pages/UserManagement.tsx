import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
 import { Users, Shield, UserCog, GraduationCap, UserX, Trash2, Edit, Search } from "lucide-react";
import StudentBulkImport from "@/components/StudentBulkImport";
import TeacherBulkImport from "@/components/TeacherBulkImport";
 import { AdminLayout } from "@/components/admin/AdminLayout";
 import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Profile {
  id: string;
  email: string;
  full_name: string;
   avatar_url: string | null;
  roles: Array<{ role: "student" | "moderator" | "admin" | "teacher" | "rl_coach" | "medical" }>;
  banned: boolean;
  created_at: string;
}

const UserManagement = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"student" | "moderator" | "admin" | "teacher" | "rl_coach" | "medical">("student");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
         .select("id, email, full_name, avatar_url, banned, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const usersWithRoles: Profile[] = profilesData?.map(profile => ({
        ...profile,
        roles: (rolesData || []).filter((r) => r.user_id === profile.id) as any
      })) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (user: Profile) => {
    setEditingUser(user);
    setEditName(user.full_name);
    setEditRole(user.roles[0]?.role || "student");
  };

   const getInitials = (name: string) => {
     return name
       .split(" ")
       .map((n) => n[0])
       .join("")
       .toUpperCase()
       .slice(0, 2);
   };
 
  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      // Update profile name
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: editName })
        .eq("id", editingUser.id);

      if (profileError) throw profileError;

      // Update role
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", editingUser.id);

      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({ user_id: editingUser.id, role: editRole });

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    }
  };

  const handleBanUser = async (userId: string, currentBanStatus: boolean) => {
    // Add confirmation dialog for destructive operations (Issue #42)
    const action = currentBanStatus ? "unban" : "ban";
    if (!confirm(`Are you sure you want to ${action} this user?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ banned: !currentBanStatus })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: currentBanStatus ? "User unbanned successfully" : "User banned successfully",
      });

      fetchUsers();
    } catch (error) {
      console.error("Error banning user:", error);
      toast({
        title: "Error",
        description: "Failed to ban/unban user",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User deleted successfully",
      });

      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  const filterBySearch = (userList: Profile[]) => {
    if (!searchQuery.trim()) return userList;
    const query = searchQuery.toLowerCase();
    return userList.filter(user =>
      user.full_name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    );
  };

  const getUsersByRole = (role: string) => {
    return users.filter(user => user.roles[0]?.role === role);
  };

  const renderUserTable = (filteredUsers: Profile[]) => (
    <Table>
      <TableHeader>
        <TableRow>
           <TableHead className="w-12"></TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredUsers.length === 0 ? (
          <TableRow>
             <TableCell colSpan={6} className="text-center text-muted-foreground">
              No users found in this category
            </TableCell>
          </TableRow>
        ) : (
          filteredUsers.map((user) => (
            <TableRow key={user.id}>
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
                {user.banned ? (
                  <Badge variant="destructive">Banned</Badge>
                ) : (
                   <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                    Active
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {new Date(user.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(user)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBanUser(user.id, user.banned)}
                  >
                    <UserX className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteUser(user.id)}
                  >
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const filteredUsers = filterBySearch(users);
  const adminUsers = filterBySearch(getUsersByRole("admin"));
  const moderatorUsers = filterBySearch(getUsersByRole("moderator"));
  const teacherUsers = filterBySearch(getUsersByRole("teacher"));
  const studentUsers = filterBySearch(getUsersByRole("student"));

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

        {/* Users by Role */}
        <Card>
          <CardHeader>
            <CardTitle>Users by Role</CardTitle>
            <CardDescription>
              Browse and manage users organized by their role
            </CardDescription>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="all">
                  All ({filteredUsers.length})
                </TabsTrigger>
                <TabsTrigger value="admin">
                  Admins ({adminUsers.length})
                </TabsTrigger>
                <TabsTrigger value="moderator">
                  Moderators ({moderatorUsers.length})
                </TabsTrigger>
                <TabsTrigger value="teacher">
                  Teachers ({teacherUsers.length})
                </TabsTrigger>
                <TabsTrigger value="student">
                  Students ({studentUsers.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-6">
                {renderUserTable(filteredUsers)}
              </TabsContent>

              <TabsContent value="admin" className="mt-6">
                {renderUserTable(adminUsers)}
              </TabsContent>

              <TabsContent value="moderator" className="mt-6">
                {renderUserTable(moderatorUsers)}
              </TabsContent>

              <TabsContent value="teacher" className="mt-6">
                {renderUserTable(teacherUsers)}
              </TabsContent>

              <TabsContent value="student" className="mt-6">
                {renderUserTable(studentUsers)}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and role
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select value={editRole} onValueChange={(value: any) => setEditRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
       </div>
     </AdminLayout>
  );
};

export default UserManagement;