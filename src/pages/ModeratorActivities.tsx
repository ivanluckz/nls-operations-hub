import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Edit, Trash2, Users, Search, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import IOSSchoolSkeleton from "@/components/IOSSchoolSkeleton";

interface Activity {
  id: string;
  title: string;
  description: string;
  category: string;
  teacher_in_charge: string;
  teacher_id: string | null;
  schedule: string;
  capacity: number;
  current_enrollment: number;
  is_active: boolean;
  days_of_week: string[];
}

interface Teacher {
  id: string;
  full_name: string;
}

const DAYS_OPTIONS = [
  'Monday',
  'Tuesday',
  'Wednesday Slot 1',
  'Wednesday Slot 2',
  'Thursday',
  'Friday'
];

const ModeratorActivities = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    teacher_ids: [] as string[],
    schedule: "",
    capacity: "",
    days_of_week: ["Monday"] as string[],
  });
  const [teacherSearchTerm, setTeacherSearchTerm] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-open edit dialog from URL param (global search deep-link)
  useEffect(() => {
    const editActivityId = searchParams.get("editActivity");
    if (editActivityId && activities.length > 0 && teachers.length >= 0) {
      const activity = activities.find((a) => a.id === editActivityId);
      if (activity) {
        handleOpenDialog(activity);
        setSearchParams({}, { replace: true });
      }
    }
  }, [activities, teachers, searchParams]);

  const fetchData = async () => {
    try {
      const { data: activitiesData } = await supabase
        .from("activities")
        .select("*")
        .order("title")
        .limit(500);

      setActivities(activitiesData || []);

      // First fetch teacher user_ids
      const { data: teacherRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "teacher");

      const teacherUserIds = (teacherRoles || []).map(r => r.user_id);

      const { data: teachersData } = teacherUserIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", teacherUserIds)
            .order("full_name")
        : { data: [] };

      setTeachers(teachersData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load data",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (activity?: Activity) => {
    if (activity) {
      setEditingActivity(activity);
      // Find teacher IDs that match the teacher_in_charge names
      const teacherNames = activity.teacher_in_charge.split(',').map(n => n.trim().toLowerCase());
      const matchingTeacherIds = teachers
        .filter(t => teacherNames.some(name => t.full_name.toLowerCase().includes(name) || name.includes(t.full_name.toLowerCase())))
        .map(t => t.id);
      // Also include the directly assigned teacher_id
      if (activity.teacher_id && !matchingTeacherIds.includes(activity.teacher_id)) {
        matchingTeacherIds.push(activity.teacher_id);
      }
      setFormData({
        title: activity.title,
        description: activity.description,
        category: activity.category,
        teacher_ids: matchingTeacherIds,
        schedule: activity.schedule,
        capacity: activity.capacity.toString(),
        days_of_week: activity.days_of_week,
      });
    } else {
      setEditingActivity(null);
      setFormData({
        title: "",
        description: "",
        category: "",
        teacher_ids: [],
        schedule: "",
        capacity: "",
        days_of_week: ["Monday"],
      });
    }
    setTeacherSearchTerm("");
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate capacity
    const capacity = parseInt(formData.capacity);
    if (isNaN(capacity) || capacity < 1 || capacity > 1000) {
      toast({
        variant: "destructive",
        title: "Invalid Capacity",
        description: "Capacity must be a number between 1 and 1000",
      });
      return;
    }

    // Issue #41: Validate capacity >= current enrollment when editing
    if (editingActivity && capacity < editingActivity.current_enrollment) {
      toast({
        variant: "destructive",
        title: "Invalid Capacity",
        description: `Capacity cannot be less than current enrollment (${editingActivity.current_enrollment} students)`,
      });
      return;
    }

    // Validate required fields
    if (!formData.title.trim() || !formData.description.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Fields",
        description: "Title and description are required",
      });
      return;
    }

    if (formData.days_of_week.length === 0) {
      toast({
        variant: "destructive",
        title: "Missing Days",
        description: "Please select at least one day or time slot",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Build teacher_in_charge from selected teachers
      const selectedTeacherNames = formData.teacher_ids
        .map(id => teachers.find(t => t.id === id)?.full_name)
        .filter(Boolean);
      const teacherInCharge = selectedTeacherNames.length > 0 
        ? selectedTeacherNames.join(", ") 
        : "TBD";
      
      // Use first selected teacher as primary teacher_id
      const primaryTeacherId = formData.teacher_ids.length > 0 ? formData.teacher_ids[0] : null;

      // Convert Wednesday Slot 1/2 to just "Wednesday" for the DB but keep the slot info
      const processedDays = formData.days_of_week.map(day => {
        if (day === 'Wednesday Slot 1' || day === 'Wednesday Slot 2') {
          return day; // Keep the slot info
        }
        return day;
      });

      const activityData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category.trim(),
        teacher_id: primaryTeacherId,
        teacher_in_charge: teacherInCharge,
        schedule: formData.schedule.trim(),
        capacity: capacity, // Now validated
        days_of_week: processedDays,
        created_by: user.id,
      };

      if (editingActivity) {
        const { error } = await supabase
          .from("activities")
          .update(activityData)
          .eq("id", editingActivity.id);

        if (error) throw error;
        toast({ title: "Activity updated successfully" });
      } else {
        const { error } = await supabase
          .from("activities")
          .insert([activityData]);

        if (error) throw error;
        toast({ title: "Activity created successfully" });
      }

      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error saving activity:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save activity",
      });
    }
  };

  const getActivityTeachers = (activity: Activity): Teacher[] => {
    const names = activity.teacher_in_charge.split(",").map(n => n.trim().toLowerCase());
    const matched = teachers.filter(t =>
      names.some(n => t.full_name.toLowerCase().includes(n) || n.includes(t.full_name.toLowerCase()))
    );
    if (activity.teacher_id && !matched.find(t => t.id === activity.teacher_id)) {
      const primary = teachers.find(t => t.id === activity.teacher_id);
      if (primary) matched.unshift(primary);
    }
    return matched;
  };

  const handleRemoveTeacher = async (activity: Activity, teacherId: string) => {
    const remaining = getActivityTeachers(activity).filter(t => t.id !== teacherId);
    const newInCharge = remaining.length > 0 ? remaining.map(t => t.full_name).join(", ") : "TBD";
    const newPrimary = remaining.length > 0 ? remaining[0].id : null;

    try {
      const { error } = await supabase
        .from("activities")
        .update({ teacher_id: newPrimary, teacher_in_charge: newInCharge })
        .eq("id", activity.id);
      if (error) throw error;
      toast({ title: "Teacher removed" });
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to remove teacher" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this activity?")) return;

    try {
      const { error } = await supabase
        .from("activities")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Activity deleted successfully" });
      fetchData();
    } catch (error: any) {
      console.error("Error deleting activity:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete activity",
      });
    }
  };

  if (loading) {
    return <IOSSchoolSkeleton />;
  }

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header */}
      <header className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/moderator")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Activity
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingActivity ? "Edit Activity" : "Create New Activity"}
                </DialogTitle>
                <DialogDescription>
                  Fill in the details for the co-curricular activity
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Activity Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Days of Week / Time Slots *</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {DAYS_OPTIONS.map(day => (
                      <label key={day} className="flex items-center gap-2 cursor-pointer p-2 border rounded-md hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={formData.days_of_week.includes(day)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, days_of_week: [...formData.days_of_week, day] });
                            } else {
                              setFormData({ ...formData, days_of_week: formData.days_of_week.filter(d => d !== day) });
                            }
                          }}
                          className="rounded border-input"
                        />
                        <span className="text-sm">{day}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Input
                      id="category"
                      placeholder="e.g., Sports, Arts, STEM"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Capacity *</Label>
                    <Input
                      id="capacity"
                      type="number"
                      min="1"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Assign Teachers</Label>
                  {formData.teacher_ids.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {formData.teacher_ids.map(id => {
                        const teacher = teachers.find(t => t.id === id);
                        return teacher ? (
                          <Badge key={id} variant="secondary" className="flex items-center gap-1">
                            {teacher.full_name}
                            <button
                              type="button"
                              onClick={() => setFormData({
                                ...formData,
                                teacher_ids: formData.teacher_ids.filter(tid => tid !== id)
                              })}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                  <Input
                    placeholder="Search teachers..."
                    value={teacherSearchTerm}
                    onChange={(e) => setTeacherSearchTerm(e.target.value)}
                  />
                  {teacherSearchTerm && (
                    <ScrollArea className="h-32 border rounded-md">
                      <div className="p-2 space-y-1">
                        {teachers
                          .filter(t => 
                            t.full_name.toLowerCase().includes(teacherSearchTerm.toLowerCase()) &&
                            !formData.teacher_ids.includes(t.id)
                          )
                          .map(teacher => (
                            <button
                              key={teacher.id}
                              type="button"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  teacher_ids: [...formData.teacher_ids, teacher.id]
                                });
                                setTeacherSearchTerm("");
                              }}
                              className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted"
                            >
                              {teacher.full_name}
                            </button>
                          ))
                        }
                        {teachers.filter(t => 
                          t.full_name.toLowerCase().includes(teacherSearchTerm.toLowerCase()) &&
                          !formData.teacher_ids.includes(t.id)
                        ).length === 0 && (
                          <p className="text-sm text-muted-foreground p-2">No teachers found</p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Search and select one or more teachers. The first selected teacher will be the primary.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule">Schedule *</Label>
                  <Input
                    id="schedule"
                    placeholder="e.g., 3-5 PM or 16:30 - 17:30"
                    value={formData.schedule}
                    onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                    required
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingActivity ? "Update" : "Create"} Activity
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Manage Activities</h1>
          <p className="text-muted-foreground">
            {activities.length} total activities
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search activities by title, category, or teacher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activities
            .filter(activity => 
              activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
              activity.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
              activity.teacher_in_charge.toLowerCase().includes(searchTerm.toLowerCase()) ||
              activity.description.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map((activity) => (
            <Card key={activity.id} className="shadow-card">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">{activity.title}</CardTitle>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline">{activity.category}</Badge>
                      {activity.days_of_week.map(day => (
                        <Badge key={day} className="bg-secondary text-secondary-foreground">{day}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(activity)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(activity.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {activity.description}
                </p>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Teacher(s):</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {getActivityTeachers(activity).length > 0
                        ? getActivityTeachers(activity).map(t => (
                            <span key={t.id} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-xs font-medium">
                              {t.full_name}
                              <button
                                onClick={() => handleRemoveTeacher(activity, t.id)}
                                className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                                title={`Remove ${t.full_name}`}
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          ))
                        : <span className="text-muted-foreground">TBD</span>
                      }
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Schedule:</span>{" "}
                    <span className="font-medium">{activity.schedule}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">
                      {activity.current_enrollment} / {activity.capacity}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      ({Math.round((activity.current_enrollment / activity.capacity) * 100)}% full)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {activities.length === 0 && (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                No activities yet. Create your first activity to get started.
              </p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Create Activity
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default ModeratorActivities;