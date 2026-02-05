import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AllocationData {
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Please log in" }),
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
        JSON.stringify({ error: "Unauthorized - Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify admin or moderator role
    const { data: roleData } = await supabaseAuth
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "moderator"]);

    if (!roleData || roleData.length === 0) {
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin/Moderator access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`User ${user.id} generating allocations PDF`);

    // Use service role for data operations
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse optional filters
    const body = await req.json().catch(() => ({}));
    const { filterDay } = body;

    // Fetch student user_ids
    const { data: studentRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "student");

    const studentUserIds = (studentRoles || []).map(r => r.user_id);

    if (studentUserIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "No students found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch students
    const { data: students } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", studentUserIds)
      .order("full_name");

    // Fetch allocations with activity titles
    const { data: allAllocations } = await supabase
      .from("allocations")
      .select("student_id, activity_id, day_of_week, slot_number, activities(title)")
      .limit(5000);

    // Helper to get activity title from allocation
    const getActivityTitle = (alloc: { activities: { title: string } | { title: string }[] | null }): string | null => {
      if (!alloc.activities) return null;
      if (Array.isArray(alloc.activities)) {
        return alloc.activities[0]?.title || null;
      }
      return alloc.activities.title || null;
    };

    // Build allocation data
    const allocations: AllocationData[] = (students || []).map(student => {
      const studentAllocs = (allAllocations || []).filter(a => a.student_id === student.id);
      
      return {
        student_id: student.id,
        student_name: student.full_name,
        student_email: student.email,
        monday_activity: getActivityTitle(studentAllocs.find(a => a.day_of_week === 'Monday') || { activities: null }),
        tuesday_activity: getActivityTitle(studentAllocs.find(a => a.day_of_week === 'Tuesday') || { activities: null }),
        wednesday_slot1_activity: getActivityTitle(studentAllocs.find(a => a.day_of_week === 'Wednesday' && a.slot_number === 1) || { activities: null }),
        wednesday_slot2_activity: getActivityTitle(studentAllocs.find(a => a.day_of_week === 'Wednesday' && a.slot_number === 2) || { activities: null }),
        thursday_activity: getActivityTitle(studentAllocs.find(a => a.day_of_week === 'Thursday') || { activities: null }),
        friday_activity: getActivityTitle(studentAllocs.find(a => a.day_of_week === 'Friday') || { activities: null }),
      };
    });

    console.log(`Found ${allocations.length} student allocations`);

    // Generate PDF
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;

    // Helper function
    const checkNewPage = (requiredHeight: number = 10) => {
      if (yPos + requiredHeight > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
        return true;
      }
      return false;
    };

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    const title = filterDay ? `Student Allocations - ${filterDay}` : "Student Allocations - All Days";
    doc.text(title, pageWidth / 2, yPos, { align: "center" });
    yPos += 8;

    // Subtitle
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()} | Total Students: ${allocations.length}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 15;

    // Table header
    const colWidths = filterDay 
      ? [60, 80, 120]  // Single day view
      : [45, 42, 42, 42, 42, 42, 42]; // All days view
    
    const headers = filterDay
      ? ["Student Name", "Email", "Activity"]
      : ["Student", "Monday", "Tuesday", "Wed S1", "Wed S2", "Thursday", "Friday"];

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(66, 66, 66);
    doc.setTextColor(255, 255, 255);
    doc.rect(10, yPos - 5, pageWidth - 20, 8, "F");

    let xPos = 15;
    headers.forEach((header, i) => {
      doc.text(header, xPos, yPos);
      xPos += colWidths[i];
    });
    doc.setTextColor(0, 0, 0);
    yPos += 8;

    // Table rows
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    allocations.forEach((alloc, index) => {
      checkNewPage(8);

      // Alternate row colors
      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(10, yPos - 4, pageWidth - 20, 7, "F");
      }

      xPos = 15;

      if (filterDay) {
        // Single day view
        const activityKey = `${filterDay.toLowerCase()}_activity` as keyof AllocationData;
        const activity = alloc[activityKey] as string | null;
        
        doc.text(alloc.student_name.substring(0, 25), xPos, yPos);
        xPos += colWidths[0];
        doc.text(alloc.student_email.substring(0, 35), xPos, yPos);
        xPos += colWidths[1];
        doc.text(activity || "Not allocated", xPos, yPos);
      } else {
        // All days view
        doc.text(alloc.student_name.substring(0, 20), xPos, yPos);
        xPos += colWidths[0];
        doc.text((alloc.monday_activity || "-").substring(0, 18), xPos, yPos);
        xPos += colWidths[1];
        doc.text((alloc.tuesday_activity || "-").substring(0, 18), xPos, yPos);
        xPos += colWidths[2];
        doc.text((alloc.wednesday_slot1_activity || "-").substring(0, 18), xPos, yPos);
        xPos += colWidths[3];
        doc.text((alloc.wednesday_slot2_activity || "-").substring(0, 18), xPos, yPos);
        xPos += colWidths[4];
        doc.text((alloc.thursday_activity || "-").substring(0, 18), xPos, yPos);
        xPos += colWidths[5];
        doc.text((alloc.friday_activity || "-").substring(0, 18), xPos, yPos);
      }

      yPos += 7;
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Page ${i} of ${pageCount} | Ntare-Louisenlund Co-Curricular Management System`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );
    }

    // Generate PDF output
    const pdfOutput = doc.output("arraybuffer");
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfOutput)));

    console.log(`Allocations PDF generated (${pageCount} pages)`);

    return new Response(
      JSON.stringify({
        pdf: pdfBase64,
        filename: `student-allocations-${new Date().toISOString().split("T")[0]}.pdf`,
        statistics: {
          totalStudents: allocations.length,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error generating allocations PDF:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
