import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { isLightColor } from "@/lib/academic-utils";
import FloatingChatButton from "@/components/student/FloatingChatButton";

interface Subject {
  id: string;
  name: string;
  code: string | null;
  color: string;
}

const AcademicSubjects = () => {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState({ name: "", code: "", color: "#6366f1" });

  const fetchSubjects = async () => {
    const { data } = await (supabase as any).from("academic_subjects").select("*").order("name");
    setSubjects(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchSubjects(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        const { error } = await (supabase as any).from("academic_subjects").update({ name: form.name, code: form.code || null, color: form.color }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("academic_subjects").insert({ name: form.name, code: form.code || null, color: form.color });
        if (error) throw error;
      }
      toast({ title: editing ? "Subject updated" : "Subject created" });
      setDialogOpen(false);
      setEditing(null);
      setForm({ name: "", code: "", color: "#6366f1" });
      fetchSubjects();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this subject?")) return;
    const { error } = await (supabase as any).from("academic_subjects").delete().eq("id", id);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else fetchSubjects();
  };

  const openEdit = (s: Subject) => {
    setEditing(s);
    setForm({ name: s.name, code: s.code || "", color: s.color });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", code: "", color: "#6366f1" });
    setDialogOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Subjects</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Add Subject</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Subject</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><Label>Code</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. ENG" /></div>
                <div><Label>Color</Label><div className="flex gap-2 items-center"><Input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-16 h-10 p-1" /><span className="text-sm text-muted-foreground">{form.color}</span></div></div>
                <Button onClick={handleSave} className="w-full" disabled={!form.name.trim()}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Color</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : subjects.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold" style={{ backgroundColor: s.color, color: isLightColor(s.color) ? '#000' : '#fff' }}>
                        {s.code?.slice(0, 3) || "?"}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.code || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <FloatingChatButton />
    </AdminLayout>
  );
};

export default AcademicSubjects;
