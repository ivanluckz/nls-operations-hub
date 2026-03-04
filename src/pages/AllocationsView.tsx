import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Search, FileDown, Loader2, FileSpreadsheet, ChevronDown } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

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

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-allocations-pdf", {
        body: {
          filterDay: activeTab !== "all" ? activeTab : undefined,
        },
      });

      if (error) throw error;

      if (data?.pdf) {
        const binaryString = atob(data.pdf);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/pdf" });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = data.filename || "student-allocations.pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        sonnerToast.success("PDF exported successfully!", {
          description: `${data.statistics?.totalStudents || 0} students included`,
        });
      }
    } catch (error: unknown) {
      console.error("Error exporting PDF:", error);
      const message = error instanceof Error ? error.message : "Failed to export PDF";
      sonnerToast.error(message);
    } finally {
      setIsExporting(false);
    }
  };

  const isAssigned = (alloc: StudentAllocation) =>
    !!(alloc.monday_activity || alloc.tuesday_activity ||
       alloc.wednesday_slot1_activity || alloc.wednesday_slot2_activity ||
       alloc.thursday_activity || alloc.friday_activity);

  const handleExportCSV = (filter: "all" | "assigned" | "unassigned") => {
    const rows = filteredAllocations.filter(a =>
      filter === "all" ? true : filter === "assigned" ? isAssigned(a) : !isAssigned(a)
    );
    const header = ["Name", "Email", "Monday", "Tuesday", "Wed Slot 1", "Wed Slot 2", "Thursday", "Friday"].join(",");
    const lines = rows.map(a => [
      `"${a.student_name}"`,
      `"${a.student_email}"`,
      `"${a.monday_activity || ""}"`,
      `"${a.tuesday_activity || ""}"`,
      `"${a.wednesday_slot1_activity || ""}"`,
      `"${a.wednesday_slot2_activity || ""}"`,
      `"${a.thursday_activity || ""}"`,
      `"${a.friday_activity || ""}"`,
    ].join(","));
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `allocations_${filter}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

            <div className="flex justify-end gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Export CSV
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExportCSV("all")}>
                    All students
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportCSV("assigned")}>
                    Assigned only
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportCSV("unassigned")}>
                    Unassigned only
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={handleExportPDF} disabled={isExporting} variant="outline">
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileDown className="mr-2 h-4 w-4" />
                    Export PDF
                  </>
                )}
              </Button>
            </div>

            <Tabs defaultValue="all" className="w-full" value={activeTab} onValueChange={setActiveTab}>
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