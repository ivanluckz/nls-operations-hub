import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Search, Users, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Activity {
  id: string;
  title: string;
  category: string;
  teacher_in_charge: string;
  capacity: number;
  current_enrollment: number;
  days_of_week: string[];
}

interface Student {
  student_id: string;
  student_name: string;
  student_email: string;
  day_of_week: string;
}

interface ActivityWithStudents extends Activity {
  students: Student[];
}

const ActivityRoster = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activities, setActivities] = useState<ActivityWithStudents[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      setUserRole(roleData?.role || "");

      // Fetch all activities
      const { data: activitiesData } = await supabase
        .from("activities")
        .select("id, title, category, teacher_in_charge, capacity, current_enrollment, days_of_week")
        .eq("is_active", true)
        .order("title");

      // Issue #28: Add query limit to prevent loading all records
      const { data: allocationsData } = await supabase
        .from("allocations")
        .select(`
          activity_id,
          day_of_week,
          student_id,
          profiles:student_id (
            full_name,
            email
          )
        `)
        .limit(5000); // Reasonable limit for school-sized datasets

      // Group students by activity
      const activitiesWithStudents: ActivityWithStudents[] = (activitiesData || []).map(activity => {
        const activityAllocations = (allocationsData || []).filter(
          a => a.activity_id === activity.id
        );

        const students: Student[] = activityAllocations.map((alloc: any) => ({
          student_id: alloc.student_id,
          student_name: alloc.profiles?.full_name || "Unknown",
          student_email: alloc.profiles?.email || "",
          day_of_week: alloc.day_of_week,
        }));

        return {
          ...activity,
          students,
        };
      });

      setActivities(activitiesWithStudents);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load activity roster",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleActivity = (activityId: string) => {
    const newExpanded = new Set(expandedActivities);
    if (newExpanded.has(activityId)) {
      newExpanded.delete(activityId);
    } else {
      newExpanded.add(activityId);
    }
    setExpandedActivities(newExpanded);
  };

  const expandAll = () => {
    setExpandedActivities(new Set(filteredActivities.map(a => a.id)));
  };

  const collapseAll = () => {
    setExpandedActivities(new Set());
  };

  const handleBack = () => {
    navigate(userRole === "admin" ? "/admin" : "/moderator");
  };

  const filteredActivities = activities.filter(activity =>
    activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    activity.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    activity.teacher_in_charge.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Activity Roster</h1>
            <p className="text-muted-foreground">View all activities and their enrolled students</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>
              Expand All
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              Collapse All
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search activities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{activities.length}</div>
              <p className="text-sm text-muted-foreground">Total Activities</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">
                {activities.reduce((sum, a) => sum + a.students.length, 0)}
              </div>
              <p className="text-sm text-muted-foreground">Total Enrollments</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">
                {activities.filter(a => a.students.length > 0).length}
              </div>
              <p className="text-sm text-muted-foreground">Active Activities</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">
                {activities.filter(a => a.students.length === 0).length}
              </div>
              <p className="text-sm text-muted-foreground">Empty Activities</p>
            </CardContent>
          </Card>
        </div>

        {/* Activities List */}
        <div className="space-y-4">
          {filteredActivities.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No activities found matching your search.
              </CardContent>
            </Card>
          ) : (
            filteredActivities.map((activity) => (
              <Collapsible
                key={activity.id}
                open={expandedActivities.has(activity.id)}
                onOpenChange={() => toggleActivity(activity.id)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <CardTitle className="text-lg">{activity.title}</CardTitle>
                            <Badge variant="outline">{activity.category}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
                            <span>Teacher: {activity.teacher_in_charge}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {activity.students.length} / {activity.capacity}
                            </span>
                            <span>•</span>
                            <div className="flex gap-1">
                              {activity.days_of_week.map(day => (
                                <Badge key={day} variant="secondary" className="text-xs">
                                  {day}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={activity.students.length > 0 ? "default" : "secondary"}
                          >
                            {activity.students.length} students
                          </Badge>
                          {expandedActivities.has(activity.id) ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {activity.students.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No students enrolled in this activity yet.
                        </p>
                      ) : (
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[50px]">#</TableHead>
                                <TableHead>Student Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Day</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {activity.students
                                .sort((a, b) => a.student_name.localeCompare(b.student_name))
                                .map((student, index) => (
                                  <TableRow key={`${student.student_id}-${student.day_of_week}`}>
                                    <TableCell className="font-medium">{index + 1}</TableCell>
                                    <TableCell>{student.student_name}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {student.student_email}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline">{student.day_of_week}</Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default ActivityRoster;
