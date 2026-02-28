import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, X, Search, Users } from "lucide-react";
import FloatingChatButton from "@/components/student/FloatingChatButton";

interface ClassGroup {
  id: string;
  name: string;
  year_level: string | null;
}

interface Member {
  id: string;
  student_id: string;
  full_name: string;
  email: string;
}

const AcademicClasses = () => {
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClassGroup | null>(null);
  const [form, setForm] = useState({ name: "", year_level: "" });
  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; full_name: string; email: string }[]>([]);

  const fetchClasses = async () => {
    const { data } = await (supabase as any).from("class_groups").select("*").order("name");
    setClasses(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchClasses(); }, []);

  const fetchMembers = async (classId: string) => {
    const { data: memberData } = await (supabase as any).from("class_group_members").select("id, student_id").eq("class_group_id", classId);
    if (!memberData?.length) { setMembers([]); return; }
    const ids = memberData.map((m: any) => m.student_id);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    setMembers(memberData.map((m: any) => {
      const p = profiles?.find((p: any) => p.id === m.student_id);
      return { id: m.id, student_id: m.student_id, full_name: p?.full_name || "?", email: p?.email || "" };
    }));
  };

  const handleSelectClass = (c: ClassGroup) => {
    setSelectedClass(c);
    fetchMembers(c.id);
  };

  const handleSaveClass = async () => {
    try {
      if (editing) {
        await (supabase as any).from("class_groups").update({ name: form.name, year_level: form.year_level || null }).eq("id", editing.id);
      } else {
        await (supabase as any).from("class_groups").insert({ name: form.name, year_level: form.year_level || null });
      }
      toast({ title: editing ? "Class updated" : "Class created" });
      setDialogOpen(false);
      setEditing(null);
      fetchClasses();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!confirm("Delete this class group?")) return;
    await (supabase as any).from("class_groups").delete().eq("id", id);
    if (selectedClass?.id === id) { setSelectedClass(null); setMembers([]); }
    fetchClasses();
  };

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    const { data } = await supabase.from("profiles").select("id, full_name, email").ilike("full_name", `%${searchQuery}%`).limit(10);
    setSearchResults(data || []);
  };

  useEffect(() => {
    const t = setTimeout(handleSearch, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const addMember = async (studentId: string) => {
    if (!selectedClass) return;
    const existing = members.find(m => m.student_id === studentId);
    if (existing) { toast({ title: "Already in class" }); return; }
    const { error } = await (supabase as any).from("class_group_members").insert({ class_group_id: selectedClass.id, student_id: studentId });
    if (error) {
      if (error.code === "23505") toast({ title: "Already a member" });
      else toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }
    fetchMembers(selectedClass.id);
    setSearchQuery("");
    setSearchResults([]);
  };

  const removeMember = async (memberId: string) => {
    await (supabase as any).from("class_group_members").delete().eq("id", memberId);
    if (selectedClass) fetchMembers(selectedClass.id);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Class Groups</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditing(null); setForm({ name: "", year_level: "" }); }}><Plus className="w-4 h-4 mr-2" />Add Class</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Class Group</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Form 3A" /></div>
                <div><Label>Year Level</Label><Input value={form.year_level} onChange={e => setForm(f => ({ ...f, year_level: e.target.value }))} placeholder="e.g. Form 3" /></div>
                <Button onClick={handleSaveClass} className="w-full" disabled={!form.name.trim()}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Class list */}
          <div className="space-y-3">
            {loading ? <p className="text-muted-foreground">Loading…</p> : classes.map(c => (
              <Card key={c.id} className={`cursor-pointer transition-all hover:shadow-md ${selectedClass?.id === c.id ? "border-primary ring-1 ring-primary" : ""}`} onClick={() => handleSelectClass(c)}>
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={e => { e.stopPropagation(); setEditing(c); setForm({ name: c.name, year_level: c.year_level || "" }); setDialogOpen(true); }}><Pencil className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={e => { e.stopPropagation(); handleDeleteClass(c.id); }}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                    </div>
                  </div>
                  {c.year_level && <CardDescription>{c.year_level}</CardDescription>}
                </CardHeader>
              </Card>
            ))}
            {!loading && classes.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No class groups yet</p>}
          </div>

          {/* Members panel */}
          <div className="lg:col-span-2">
            {selectedClass ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />{selectedClass.name} — Members</CardTitle>
                  <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search students to add…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
                    {searchResults.length > 0 && searchQuery.length >= 2 && (
                      <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {searchResults.filter(s => !members.find(m => m.student_id === s.id)).map(s => (
                          <button key={s.id} className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between" onClick={() => addMember(s.id)}>
                            <span>{s.full_name}</span><span className="text-muted-foreground">{s.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {members.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No members yet. Search and add students above.</p> : (
                    <div className="flex flex-wrap gap-2">
                      {members.map(m => (
                        <Badge key={m.id} variant="secondary" className="gap-1 py-1.5 px-3">
                          {m.full_name}
                          <button onClick={() => removeMember(m.id)} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <p>Select a class group to manage members</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <FloatingChatButton />
    </AdminLayout>
  );
};

export default AcademicClasses;
