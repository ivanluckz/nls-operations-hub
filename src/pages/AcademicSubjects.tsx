import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Plus, Pencil, Trash2, Search, BookOpen } from "lucide-react";
import type { AcademicSubject } from "@/types/academic";
import { textColorForBg } from "@/types/academic";

const DEFAULT_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
];

const AcademicSubjects = () => {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<AcademicSubject | null>(null);
  const [formData, setFormData] = useState({ name: "", code: "", color: "#6366f1" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("academic_subjects")
        .select("*")
        .order("name")
        .limit(200);
      if (error) throw error;
      setSubjects(data || []);
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: "Failed to load subjects" });
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingSubject(null);
    setFormData({ name: "", code: "", color: "#6366f1" });
    setDialogOpen(true);
  };

  const openEdit = (subject: AcademicSubject) => {
    setEditingSubject(subject);
    setFormData({ name: subject.name, code: subject.code || "", color: subject.color });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Subject name is required" });
      return;
    }
    setSaving(true);
    try {
      if (editingSubject) {
        const { error } = await (supabase as any)
          .from("academic_subjects")
          .update({ name: formData.name.trim(), code: formData.code.trim() || null, color: formData.color })
          .eq("id", editingSubject.id);
        if (error) throw error;
        toast({ title: "Subject updated" });
      } else {
        const { error } = await (supabase as any)
          .from("academic_subjects")
          .insert({ name: formData.name.trim(), code: formData.code.trim() || null, color: formData.color });
        if (error) throw error;
        toast({ title: "Subject created" });
      }
      setDialogOpen(false);
      fetchSubjects();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Failed to save subject" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (subject: AcademicSubject) => {
    // Check if subject has any timetable slots
    const { count } = await (supabase as any)
      .from("timetable_slots")
      .select("id", { count: "exact", head: true })
      .eq("subject_id", subject.id);

    if (count && count > 0) {
      toast({
        variant: "destructive",
        title: "Cannot delete",
        description: `This subject is used in ${count} timetable slot(s). Remove those slots first.`,
      });
      return;
    }

    const { error } = await (supabase as any)
      .from("academic_subjects")
      .delete()
      .eq("id", subject.id);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Subject deleted" });
      fetchSubjects();
    }
  };

  const filtered = subjects.filter(
    s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
         (s.code || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Academic Subjects</h1>
            <p className="text-muted-foreground">Manage school subjects for the timetable</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Add Subject
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSubject ? "Edit Subject" : "New Subject"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="name">Subject Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Mathematics"
                    value={formData.name}
                    onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="code">Code (optional)</Label>
                  <Input
                    id="code"
                    placeholder="e.g. MATH"
                    value={formData.code}
                    onChange={e => setFormData(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    maxLength={10}
                  />
                </div>
                <div>
                  <Label>Color</Label>
                  <div className="flex items-center gap-3 mt-1">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={e => setFormData(f => ({ ...f, color: e.target.value }))}
                      className="h-10 w-16 rounded border cursor-pointer"
                    />
                    <div className="flex flex-wrap gap-2">
                      {DEFAULT_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => setFormData(f => ({ ...f, color: c }))}
                          className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                          style={{
                            backgroundColor: c,
                            borderColor: formData.color === c ? "#000" : "transparent",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Preview */}
                  <div
                    className="mt-2 px-3 py-1.5 rounded text-sm font-medium w-fit"
                    style={{ backgroundColor: formData.color, color: textColorForBg(formData.color) }}
                  >
                    {formData.name || "Preview"} {formData.code ? `(${formData.code})` : ""}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving…" : editingSubject ? "Save Changes" : "Create Subject"}
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
            placeholder="Search subjects…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="font-medium">No subjects found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm ? "Try a different search" : "Create your first subject to get started"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(subject => (
              <Card key={subject.id} className="overflow-hidden">
                {/* Color strip */}
                <div className="h-2" style={{ backgroundColor: subject.color }} />
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{subject.name}</CardTitle>
                      {subject.code && (
                        <span
                          className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-mono font-semibold"
                          style={{ backgroundColor: subject.color, color: textColorForBg(subject.color) }}
                        >
                          {subject.code}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(subject)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(subject)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AcademicSubjects;
