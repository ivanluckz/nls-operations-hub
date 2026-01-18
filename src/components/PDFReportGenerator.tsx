import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, FileDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Activity {
  id: string;
  title: string;
}

interface Student {
  id: string;
  full_name: string;
}

interface PDFReportGeneratorProps {
  activities?: Activity[];
  students?: Student[];
  userRole?: "admin" | "moderator" | "teacher";
}

export function PDFReportGenerator({ activities = [], students = [], userRole = "teacher" }: PDFReportGeneratorProps) {
  const [reportType, setReportType] = useState<"all" | "activity" | "student">("all");
  const [selectedActivity, setSelectedActivity] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateReport = async () => {
    if (reportType === "activity" && !selectedActivity) {
      toast.error("Please select an activity");
      return;
    }
    if (reportType === "student" && !selectedStudent) {
      toast.error("Please select a student");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-pdf-report", {
        body: {
          reportType,
          activityId: reportType === "activity" ? selectedActivity : undefined,
          studentId: reportType === "student" ? selectedStudent : undefined,
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
        },
      });

      if (error) throw error;

      if (data?.pdf) {
        // Convert base64 to blob and download
        const binaryString = atob(data.pdf);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/pdf" });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = data.filename || "attendance-report.pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success("PDF report downloaded successfully!", {
          description: `Attendance rate: ${data.statistics?.attendanceRate || 0}%`,
        });
      }
    } catch (error: unknown) {
      console.error("Error generating PDF:", error);
      const message = error instanceof Error ? error.message : "Failed to generate PDF report";
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileDown className="h-5 w-5" />
          Generate Attendance Report
        </CardTitle>
        <CardDescription>
          Download PDF attendance reports for activities or students
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Report Type */}
        <div className="space-y-2">
          <Label>Report Type</Label>
          <Select value={reportType} onValueChange={(v) => setReportType(v as typeof reportType)}>
            <SelectTrigger>
              <SelectValue placeholder="Select report type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Overall Report</SelectItem>
              <SelectItem value="activity">Activity Report</SelectItem>
              {(userRole === "admin" || userRole === "moderator") && (
                <SelectItem value="student">Student Report</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Activity Selection */}
        {reportType === "activity" && (
          <div className="space-y-2">
            <Label>Select Activity</Label>
            <Select value={selectedActivity} onValueChange={setSelectedActivity}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an activity" />
              </SelectTrigger>
              <SelectContent>
                {activities.map((activity) => (
                  <SelectItem key={activity.id} value={activity.id}>
                    {activity.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Student Selection */}
        {reportType === "student" && (userRole === "admin" || userRole === "moderator") && (
          <div className="space-y-2">
            <Label>Select Student</Label>
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a student" />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Date Range */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Generate Button */}
        <Button 
          onClick={handleGenerateReport} 
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating PDF...
            </>
          ) : (
            <>
              <FileDown className="mr-2 h-4 w-4" />
              Download PDF Report
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
