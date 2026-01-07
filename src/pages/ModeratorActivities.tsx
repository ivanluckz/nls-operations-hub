import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Edit, Trash2, Users } from "lucide-react";

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
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    teacher_id: "",
    teacher_in_charge: "",
    schedule: "",
    capacity: "",
    days_of_week: ["Monday"] as string[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: activitiesData } = await supabase
        .from("activities")
        .select("*")
        .order("title");

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
      setFormData({
        title: activity.title,
        description: activity.description,
        category: activity.category,
        teacher_id: activity.teacher_id || "",
        teacher_in_charge: activity.teacher_in_charge || "",
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
        teacher_id: "",
        teacher_in_charge: "",
        schedule: "",
        capacity: "",
        days_of_week: ["Monday"],
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Determine teacher_in_charge value
      let teacherInCharge = formData.teacher_in_charge;
      if (formData.teacher_id) {
        const selectedTeacher = teachers.find(t => t.id === formData.teacher_id);
        if (selectedTeacher) {
          teacherInCharge = teacherInCharge 
            ? `${selectedTeacher.full_name}, ${teacherInCharge}` 
            : selectedTeacher.full_name;
        }
      }
      if (!teacherInCharge) teacherInCharge = "TBD";

      // Convert Wednesday Slot 1/2 to just "Wednesday" for the DB but keep the slot info
      const processedDays = formData.days_of_week.map(day => {
        if (day === 'Wednesday Slot 1' || day === 'Wednesday Slot 2') {
          return day; // Keep the slot info
        }
        return day;
      });

      const activityData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        teacher_id: formData.teacher_id || null,
        teacher_in_charge: teacherInCharge,
        schedule: formData.schedule,
        capacity: parseInt(formData.capacity),
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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
                  <Label htmlFor="teacher">Assign Teacher (from registered teachers)</Label>
                  <select
                    id="teacher"
                    value={formData.teacher_id}
                    onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">No teacher assigned yet</option>
                    {teachers.map(teacher => (
                      <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Teachers appear here after they register with their name matching an activity
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher_in_charge">Teacher(s) In Charge (Manual Entry)</Label>
                  <Input
                    id="teacher_in_charge"
                    placeholder="e.g., Teacher Smith, Teacher Johnson"
                    value={formData.teacher_in_charge}
                    onChange={(e) => setFormData({ ...formData, teacher_in_charge: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter teacher name(s) manually. Use commas to separate multiple teachers.
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activities.map((activity) => (
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
                    <span className="text-muted-foreground">Teacher(s):</span>{" "}
                    <span className="font-medium">{activity.teacher_in_charge}</span>
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