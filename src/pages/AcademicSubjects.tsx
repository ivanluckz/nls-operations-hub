import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { isLightColor } from "@/lib/academic-utils";
import FloatingChatButton from "@/components/student/FloatingChatButton";

interface Subject { id: string; name: string; code: string | null; color: string; }

const COLOR_PRESETS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#78716c",
  "#475569",
];

const AcademicSubjects = () => {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState({ name: "", code: "", color: "#6366f1" });
  const [filter, setFilter] = useState("");

  const fetchData = async () => {
    const [{ data: subs }, { data: slots }] = await Promise.all([
      (supabase as any).from("academic_subjects").select("*").order("name"),
      (supabase as any).from("timetable_slots").select("subject_id"),
    ]);
    setSubjects(subs || []);
    const counts: Record<string, number> = {};
    for (const s of (slots || [])) counts[s.subject_id] = (counts[s.subject_id] || 0) + 1;
    setSlotCounts(counts);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

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
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this subject?")) return;
    const { error } = await (supabase as any).from("academic_subjects").delete().eq("id", id);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else fetchData();
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

  const filtered = filter
    ? subjects.filter(s => s.name.toLowerCase().includes(filter.toLowerCase()) || (s.code || "").toLowerCase().includes(filter.toLowerCase()))
    : subjects;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold">Subjects</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Filter subjects…" value={filter} onChange={e => setFilter(e.target.value)} className="pl-9 w-48" />
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Add Subject</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Subject</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                  <div><Label>Code</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. ENG" /></div>
                  <div>
                    <Label>Color</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {COLOR_PRESETS.map(c => (
                        <button key={c} className={`w-7 h-7 rounded-md border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
                          style={{ backgroundColor: c }} onClick={() => setForm(f => ({ ...f, color: c }))} />
                      ))}
                    </div>
                    <div className="flex gap-2 items-center mt-2">
                      <Input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-16 h-10 p-1" />
                      <span className="text-sm text-muted-foreground">{form.color}</span>
                    </div>
                  </div>
                  <Button onClick={handleSave} className="w-full" disabled={!form.name.trim()}>Save</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Color</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{filter ? "No matching subjects" : "No subjects yet"}</TableCell></TableRow>
                ) : filtered.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold" style={{ backgroundColor: s.color, color: isLightColor(s.color) ? '#000' : '#fff' }}>
                        {s.code?.slice(0, 3) || "?"}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.code || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {slotCounts[s.id] || 0} slot{(slotCounts[s.id] || 0) !== 1 ? "s" : ""}
                      </Badge>
                    </TableCell>
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
