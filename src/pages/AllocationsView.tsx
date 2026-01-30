import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Search } from "lucide-react";

interface StudentAllocation {
  student_id: string;
  student_name: string;
  student_email: string;
  monday_activity: string | null;
  tuesday_activity: string | null;
  wednesday_slot1_activity: string | null;
  wednesday_slot2_activity: string | null;
  thursday_activity: string | null;
  friday_activity: string | null;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const AllocationsView = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [allocations, setAllocations] = useState<StudentAllocation[]>([]);
  const [filteredAllocations, setFilteredAllocations] = useState<StudentAllocation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const filtered = allocations.filter(alloc =>
      alloc.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alloc.student_email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredAllocations(filtered);
  }, [searchTerm, allocations]);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setUserRole(roleData?.role || "");

      // First fetch student user_ids
      const { data: studentRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");

      const studentUserIds = (studentRoles || []).map(r => r.user_id);

      const { data: students } = studentUserIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", studentUserIds)
            .order("full_name")
        : { data: [] };

      // Issue #28: Add query limit to prevent loading all records
      const { data: allAllocations } = await supabase
        .from("allocations")
        .select("student_id, activity_id, day_of_week, slot_number, activities(title)")
        .limit(5000); // Reasonable limit for school-sized datasets

      const studentAllocations: StudentAllocation[] = (students || []).map(student => {
        const studentAllocs = (allAllocations || []).filter(a => a.student_id === student.id);
        
        return {
          student_id: student.id,
          student_name: student.full_name,
          student_email: student.email,
          monday_activity: studentAllocs.find(a => a.day_of_week === 'Monday')?.activities?.title || null,
          tuesday_activity: studentAllocs.find(a => a.day_of_week === 'Tuesday')?.activities?.title || null,
          wednesday_slot1_activity: studentAllocs.find(a => a.day_of_week === 'Wednesday' && a.slot_number === 1)?.activities?.title || null,
          wednesday_slot2_activity: studentAllocs.find(a => a.day_of_week === 'Wednesday' && a.slot_number === 2)?.activities?.title || null,
          thursday_activity: studentAllocs.find(a => a.day_of_week === 'Thursday')?.activities?.title || null,
          friday_activity: studentAllocs.find(a => a.day_of_week === 'Friday')?.activities?.title || null,
        };
      });

      setAllocations(studentAllocations);
      setFilteredAllocations(studentAllocations);
    } catch (error) {
      console.error("Error fetching allocations:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load allocations",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(userRole === 'admin' ? '/admin' : '/moderator');
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
      <header className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Student Allocations</CardTitle>
            <CardDescription>
              View all student co-curricular activity assignments by day
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Tabs defaultValue="all" className="w-full">
              <TabsList>
                <TabsTrigger value="all">All Days</TabsTrigger>
                {DAYS.map(day => (
                  <TabsTrigger key={day} value={day}>{day}</TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="all" className="space-y-4">
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px]">Student</TableHead>
                        <TableHead className="min-w-[200px]">Email</TableHead>
                        <TableHead className="min-w-[150px]">Monday</TableHead>
                        <TableHead className="min-w-[150px]">Tuesday</TableHead>
                        <TableHead className="min-w-[150px]">Wed Slot 1</TableHead>
                        <TableHead className="min-w-[150px]">Wed Slot 2</TableHead>
                        <TableHead className="min-w-[150px]">Thursday</TableHead>
                        <TableHead className="min-w-[150px]">Friday</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAllocations.map(alloc => (
                        <TableRow key={alloc.student_id}>
                          <TableCell className="font-medium">{alloc.student_name}</TableCell>
                          <TableCell className="text-sm">{alloc.student_email}</TableCell>
                          <TableCell className="text-sm">{alloc.monday_activity || '-'}</TableCell>
                          <TableCell className="text-sm">{alloc.tuesday_activity || '-'}</TableCell>
                          <TableCell className="text-sm">{alloc.wednesday_slot1_activity || '-'}</TableCell>
                          <TableCell className="text-sm">{alloc.wednesday_slot2_activity || '-'}</TableCell>
                          <TableCell className="text-sm">{alloc.thursday_activity || '-'}</TableCell>
                          <TableCell className="text-sm">{alloc.friday_activity || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {DAYS.map(day => {
                const dayKey = `${day.toLowerCase()}_activity`;
                return (
                  <TabsContent key={day} value={day}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Activity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAllocations.map(alloc => {
                          const activity = alloc[dayKey as keyof StudentAllocation];
                          return (
                            <TableRow key={alloc.student_id}>
                              <TableCell className="font-medium">{alloc.student_name}</TableCell>
                              <TableCell>{alloc.student_email}</TableCell>
                              <TableCell>{activity || 'Not allocated'}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AllocationsView;