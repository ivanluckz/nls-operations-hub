import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Plus, Pencil, Trash2, Search, Users, X, UserPlus } from "lucide-react";
import type { ClassGroup } from "@/types/academic";

interface StudentProfile {
  id: string;
  full_name: string;
  email: string;
}

interface GroupWithMembers extends ClassGroup {
  members: (StudentProfile & { member_id: string })[];
}

const ClassGroups = () => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ClassGroup | null>(null);
  const [formData, setFormData] = useState({ name: "", year_level: "" });
  const [saving, setSaving] = useState(false);

  // Student search for adding members
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentResults, setStudentResults] = useState<StudentProfile[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const { data: groupData, error } = await (supabase as any)
        .from("class_groups")
        .select("*")
        .order("year_level", { ascending: true, nullsFirst: false })
        .order("name")
        .limit(200);
      if (error) throw error;

      // Fetch members for all groups
      const groupIds = (groupData || []).map((g: ClassGroup) => g.id);
      let membersMap: Record<string, (StudentProfile & { member_id: string })[]> = {};

      if (groupIds.length > 0) {
        const { data: memberData } = await (supabase as any)
          .from("class_group_members")
          .select("id, class_group_id, student_id")
          .in("class_group_id", groupIds)
          .limit(5000);

        const studentIds = [...new Set((memberData || []).map((m: any) => m.student_id))];
        let profilesMap: Record<string, StudentProfile> = {};

        if (studentIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", studentIds as string[]);
          (profiles || []).forEach((p: StudentProfile) => { profilesMap[p.id] = p; });
        }

        (memberData || []).forEach((m: any) => {
          if (!membersMap[m.class_group_id]) membersMap[m.class_group_id] = [];
          const profile = profilesMap[m.student_id];
          if (profile) {
            membersMap[m.class_group_id].push({ ...profile, member_id: m.id });
          }
        });
      }

      setGroups(
        (groupData || []).map((g: ClassGroup) => ({
          ...g,
          members: membersMap[g.id] || [],
        }))
      );
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: "Failed to load class groups" });
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingGroup(null);
    setFormData({ name: "", year_level: "" });
    setDialogOpen(true);
  };

  const openEdit = (group: ClassGroup) => {
    setEditingGroup(group);
    setFormData({ name: group.name, year_level: group.year_level || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Group name is required" });
      return;
    }
    setSaving(true);
    try {
      const payload = { name: formData.name.trim(), year_level: formData.year_level.trim() || null };
      if (editingGroup) {
        const { error } = await (supabase as any)
          .from("class_groups")
          .update(payload)
          .eq("id", editingGroup.id);
        if (error) throw error;
        toast({ title: "Class group updated" });
      } else {
        const { error } = await (supabase as any)
          .from("class_groups")
          .insert(payload);
        if (error) throw error;
        toast({ title: "Class group created" });
      }
      setDialogOpen(false);
      fetchGroups();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (group: ClassGroup) => {
    const { error } = await (supabase as any)
      .from("class_groups")
      .delete()
      .eq("id", group.id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Class group deleted" });
      fetchGroups();
    }
  };

  const handleRemoveMember = async (memberId: string, groupId: string) => {
    const { error } = await (supabase as any)
      .from("class_group_members")
      .delete()
      .eq("id", memberId);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      setGroups(prev =>
        prev.map(g =>
          g.id === groupId ? { ...g, members: g.members.filter(m => m.member_id !== memberId) } : g
        )
      );
    }
  };

  const searchStudents = async (query: string, groupId: string) => {
    if (query.length < 2) { setStudentResults([]); return; }
    setSearchingStudents(true);
    try {
      // Get existing member IDs to exclude
      const group = groups.find(g => g.id === groupId);
      const existingIds = (group?.members || []).map(m => m.id);

      // Two-step: get student user_ids, then profiles
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student")
        .limit(1000);
      const studentIds = (roleData || []).map(r => r.user_id);

      if (studentIds.length === 0) { setStudentResults([]); return; }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", studentIds)
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);

      setStudentResults(
        (profiles || []).filter((p: StudentProfile) => !existingIds.includes(p.id))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingStudents(false);
    }
  };

  const handleAddMember = async (student: StudentProfile, groupId: string) => {
    const { error } = await (supabase as any)
      .from("class_group_members")
      .insert({ class_group_id: groupId, student_id: student.id });
    if (error) {
      if (error.code === "23505") {
        toast({ title: "Already in group", description: `${student.full_name} is already a member` });
      } else {
        toast({ variant: "destructive", title: "Error", description: error.message });
      }
    } else {
      toast({ title: "Student added" });
      setStudentSearch("");
      setStudentResults([]);
      fetchGroups();
    }
  };

  const filtered = groups.filter(
    g => g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
         (g.year_level || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Class Groups</h1>
            <p className="text-muted-foreground">Manage class groups and their student membership</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Add Class Group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingGroup ? "Edit Class Group" : "New Class Group"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="gname">Group Name *</Label>
                  <Input
                    id="gname"
                    placeholder="e.g. Form 3A"
                    value={formData.name}
                    onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="year_level">Year Level</Label>
                  <Input
                    id="year_level"
                    placeholder="e.g. Form 3"
                    value={formData.year_level}
                    onChange={e => setFormData(f => ({ ...f, year_level: e.target.value }))}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving…" : editingGroup ? "Save Changes" : "Create Group"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search groups…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Groups */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="font-medium">No class groups found</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first class group to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filtered.map(group => (
              <Card key={group.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                      {group.year_level && (
                        <CardDescription>{group.year_level}</CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{group.members.length} student{group.members.length !== 1 ? "s" : ""}</Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(group)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteGroup(group)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Member chips */}
                  {group.members.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {group.members.map(m => (
                        <Badge key={m.member_id} variant="outline" className="flex items-center gap-1.5 pr-1">
                          <span>{m.full_name}</span>
                          <button
                            onClick={() => handleRemoveMember(m.member_id, group.id)}
                            className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Add student */}
                  {addingToGroup === group.id ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          autoFocus
                          placeholder="Search students by name or email…"
                          value={studentSearch}
                          onChange={e => {
                            setStudentSearch(e.target.value);
                            searchStudents(e.target.value, group.id);
                          }}
                          className="pl-9"
                        />
                      </div>
                      {searchingStudents && (
                        <p className="text-sm text-muted-foreground px-1">Searching…</p>
                      )}
                      {studentResults.length > 0 && (
                        <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                          {studentResults.map(s => (
                            <button
                              key={s.id}
                              className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                              onClick={() => handleAddMember(s, group.id)}
                            >
                              <p className="font-medium text-sm">{s.full_name}</p>
                              <p className="text-xs text-muted-foreground">{s.email}</p>
                            </button>
                          ))}
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setAddingToGroup(null); setStudentSearch(""); setStudentResults([]); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setAddingToGroup(group.id); setStudentSearch(""); setStudentResults([]); }}
                    >
                      <UserPlus className="w-3.5 h-3.5 mr-2" />
                      Add Student
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default ClassGroups;
