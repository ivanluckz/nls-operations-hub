import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportRequest {
  reportType: "activity" | "student" | "all";
  activityId?: string;
  studentId?: string;
  startDate?: string;
  endDate?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Please log in to generate reports" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify admin, moderator, or teacher role
    const { data: roleData } = await supabaseAuth
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "moderator", "teacher"]);

    if (!roleData || roleData.length === 0) {
      return new Response(
        JSON.stringify({ error: "Forbidden - Staff access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userRole = roleData[0].role;
    console.log(`User ${user.id} (role: ${userRole}) generating PDF report`);

    const { reportType, activityId, studentId, startDate, endDate }: ReportRequest = await req.json();

    // Validate request
    if (!reportType) {
      return new Response(
        JSON.stringify({ error: "Missing required field: reportType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for data operations
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate date range (default to last 30 days)
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    console.log(`Generating ${reportType} report from ${start.toISOString()} to ${end.toISOString()}`);

    // Build query based on report type
    let query = supabase
      .from("attendance_records")
      .select(`
        id,
        status,
        marked_at,
        student_id,
        session_id
      `)
      .gte("marked_at", start.toISOString())
      .lte("marked_at", end.toISOString());

    if (reportType === "student" && studentId) {
      query = query.eq("student_id", studentId);
    }

    const { data: records, error: recordsError } = await query;

    if (recordsError) {
      console.error("Error fetching records:", recordsError);
      throw recordsError;
    }

    console.log(`Found ${records?.length || 0} attendance records`);

    // Fetch sessions to get activity info
    const sessionIds = [...new Set(records?.map(r => r.session_id) || [])];
    let sessionsQuery = supabase
      .from("attendance_sessions")
      .select("id, activity_id, session_date, day_of_week, slot_number")
      .in("id", sessionIds.length > 0 ? sessionIds : ["00000000-0000-0000-0000-000000000000"]);

    // For teachers, only show their activities
    if (userRole === "teacher") {
      sessionsQuery = sessionsQuery.eq("teacher_id", user.id);
    }

    const { data: sessions } = await sessionsQuery;
    const sessionMap = new Map(sessions?.map(s => [s.id, s]) || []);

    // Filter records for valid sessions (teacher access control)
    const validSessionIds = new Set(sessions?.map(s => s.id) || []);
    const filteredRecords = records?.filter(r => validSessionIds.has(r.session_id)) || [];

    // Further filter by activity if specified
    let finalRecords = filteredRecords;
    if (reportType === "activity" && activityId) {
      finalRecords = filteredRecords.filter(r => {
        const session = sessionMap.get(r.session_id);
        return session?.activity_id === activityId;
      });
    }

    // Fetch student profiles
    const studentIds = [...new Set(finalRecords.map(r => r.student_id))];
    const { data: students } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"]);
    const studentMap = new Map(students?.map(s => [s.id, s]) || []);

    // Fetch activities
    const activityIds = [...new Set(sessions?.map(s => s.activity_id) || [])];
    const { data: activities } = await supabase
      .from("activities")
      .select("id, title, category, teacher_in_charge")
      .in("id", activityIds.length > 0 ? activityIds : ["00000000-0000-0000-0000-000000000000"]);
    const activityMap = new Map(activities?.map(a => [a.id, a]) || []);

    // Calculate statistics
    const totalRecords = finalRecords.length;
    const presentCount = finalRecords.filter(r => r.status === "present").length;
    const absentCount = finalRecords.filter(r => r.status === "absent").length;
    const lateCount = finalRecords.filter(r => r.status === "late").length;
    const excusedCount = finalRecords.filter(r => r.status === "excused").length;
    const attendanceRate = totalRecords > 0 ? ((presentCount / totalRecords) * 100).toFixed(1) : "0";

    // Generate PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Helper function to add new page if needed
    const checkNewPage = (requiredHeight: number = 20) => {
      if (yPos + requiredHeight > 280) {
        doc.addPage();
        yPos = 20;
      }
    };

    // Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    const title = reportType === "activity" 
      ? "Activity Attendance Report" 
      : reportType === "student" 
        ? "Student Attendance Report" 
        : "Overall Attendance Report";
    doc.text(title, pageWidth / 2, yPos, { align: "center" });
    yPos += 10;

    // Subtitle with date range
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Report Period: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 5;
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 15;

    // Activity or Student specific header
    if (reportType === "activity" && activityId) {
      const activity = activityMap.get(activityId);
      if (activity) {
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`Activity: ${activity.title}`, 20, yPos);
        yPos += 7;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Category: ${activity.category}`, 20, yPos);
        yPos += 5;
        doc.text(`Teacher: ${activity.teacher_in_charge}`, 20, yPos);
        yPos += 10;
      }
    } else if (reportType === "student" && studentId) {
      const student = studentMap.get(studentId);
      if (student) {
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`Student: ${student.full_name}`, 20, yPos);
        yPos += 7;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Email: ${student.email}`, 20, yPos);
        yPos += 10;
      }
    }

    // Statistics Section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Summary Statistics", 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    // Draw statistics box
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(20, yPos - 3, pageWidth - 40, 35, 3, 3, "FD");

    yPos += 5;
    doc.text(`Total Records: ${totalRecords}`, 25, yPos);
    doc.text(`Attendance Rate: ${attendanceRate}%`, 100, yPos);
    yPos += 7;
    doc.setTextColor(34, 139, 34); // Green
    doc.text(`Present: ${presentCount}`, 25, yPos);
    doc.setTextColor(255, 165, 0); // Orange
    doc.text(`Late: ${lateCount}`, 70, yPos);
    doc.setTextColor(220, 20, 60); // Red
    doc.text(`Absent: ${absentCount}`, 115, yPos);
    doc.setTextColor(65, 105, 225); // Blue
    doc.text(`Excused: ${excusedCount}`, 160, yPos);
    doc.setTextColor(0, 0, 0); // Reset to black
    yPos += 25;

    // Detailed Records Section
    checkNewPage(40);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Attendance Details", 20, yPos);
    yPos += 10;

    // Table header
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(66, 66, 66);
    doc.setTextColor(255, 255, 255);
    doc.rect(20, yPos - 5, pageWidth - 40, 8, "F");
    
    if (reportType === "student") {
      doc.text("Date", 25, yPos);
      doc.text("Activity", 55, yPos);
      doc.text("Day", 120, yPos);
      doc.text("Status", 155, yPos);
    } else {
      doc.text("Date", 25, yPos);
      doc.text("Student", 55, yPos);
      doc.text("Activity", 115, yPos);
      doc.text("Status", 165, yPos);
    }
    doc.setTextColor(0, 0, 0);
    yPos += 8;

    // Table rows
    doc.setFont("helvetica", "normal");
    let rowCount = 0;
    const maxRows = 100; // Limit rows to prevent huge PDFs

    for (const record of finalRecords.slice(0, maxRows)) {
      checkNewPage(8);
      
      const session = sessionMap.get(record.session_id);
      const student = studentMap.get(record.student_id);
      const activity = session ? activityMap.get(session.activity_id) : null;
      
      // Alternate row colors
      if (rowCount % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(20, yPos - 4, pageWidth - 40, 7, "F");
      }

      const dateStr = record.marked_at ? new Date(record.marked_at).toLocaleDateString() : "N/A";
      
      // Color-code status
      const statusColors: Record<string, [number, number, number]> = {
        present: [34, 139, 34],
        late: [255, 165, 0],
        absent: [220, 20, 60],
        excused: [65, 105, 225]
      };
      
      doc.setTextColor(0, 0, 0);
      if (reportType === "student") {
        doc.text(dateStr, 25, yPos);
        doc.text((activity?.title || "Unknown").substring(0, 30), 55, yPos);
        doc.text(session?.day_of_week || "N/A", 120, yPos);
      } else {
        doc.text(dateStr, 25, yPos);
        doc.text((student?.full_name || "Unknown").substring(0, 25), 55, yPos);
        doc.text((activity?.title || "Unknown").substring(0, 22), 115, yPos);
      }
      
      const [r, g, b] = statusColors[record.status] || [0, 0, 0];
      doc.setTextColor(r, g, b);
      doc.text(record.status.charAt(0).toUpperCase() + record.status.slice(1), reportType === "student" ? 155 : 165, yPos);
      doc.setTextColor(0, 0, 0);
      
      yPos += 7;
      rowCount++;
    }

    if (finalRecords.length > maxRows) {
      yPos += 5;
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`... and ${finalRecords.length - maxRows} more records (limited for PDF size)`, 20, yPos);
      doc.setTextColor(0, 0, 0);
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Page ${i} of ${pageCount} | Ntare-Louisenlund Co-Curricular Management System`,
        pageWidth / 2,
        290,
        { align: "center" }
      );
    }

    // Generate PDF output
    const pdfOutput = doc.output("arraybuffer");
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfOutput)));

    console.log(`PDF generated successfully (${pageCount} pages)`);

    return new Response(
      JSON.stringify({
        pdf: pdfBase64,
        filename: `attendance-report-${reportType}-${new Date().toISOString().split("T")[0]}.pdf`,
        statistics: {
          totalRecords,
          present: presentCount,
          absent: absentCount,
          late: lateCount,
          excused: excusedCount,
          attendanceRate: parseFloat(attendanceRate)
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in generate-pdf-report:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
