import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: roleData } = await supabaseAuth.from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin", "moderator", "teacher"]);
    if (!roleData?.length) return new Response(JSON.stringify({ error: "Staff access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { classGroupId, subjectId, startDate, endDate } = await req.json();
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 86400000);
    let end = endDate ? new Date(endDate) : new Date();
    if (start > end) { const t = start; start = end; end = t; }

    // Get class members
    let studentIds: string[] = [];
    let className = "All Classes";
    if (classGroupId) {
      const { data: members } = await supabase.from("class_group_members").select("student_id").eq("class_group_id", classGroupId);
      studentIds = members?.map(m => m.student_id) || [];
      const { data: cg } = await supabase.from("class_groups").select("name").eq("id", classGroupId).single();
      className = cg?.name || className;
    }

    // Get slots
    let slotsQuery = supabase.from("timetable_slots").select("id, subject_id");
    if (classGroupId) slotsQuery = slotsQuery.eq("class_group_id", classGroupId);
    if (subjectId && subjectId !== "all") slotsQuery = slotsQuery.eq("subject_id", subjectId);
    const { data: slotsData } = await slotsQuery;
    const slotIds = slotsData?.map(s => s.id) || [];

    if (!slotIds.length) {
      return new Response(JSON.stringify({ error: "No timetable slots found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: sessions } = await supabase.from("academic_sessions").select("id, slot_id, session_date").in("slot_id", slotIds).gte("session_date", start.toISOString().split("T")[0]).lte("session_date", end.toISOString().split("T")[0]);
    const sessionIds = sessions?.map(s => s.id) || [];

    let attQuery = supabase.from("academic_attendance").select("*").in("session_id", sessionIds.length ? sessionIds : ["00000000-0000-0000-0000-000000000000"]);
    if (studentIds.length) attQuery = attQuery.in("student_id", studentIds);
    const { data: attendance } = await attQuery;

    // Get profiles & subjects
    const allStudentIds = [...new Set((attendance || []).map(a => a.student_id))];
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", allStudentIds.length ? allStudentIds : ["00000000-0000-0000-0000-000000000000"]);
    const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
    const { data: subjectsData } = await supabase.from("academic_subjects").select("id, name");
    const subjectMap = new Map(subjectsData?.map(s => [s.id, s.name]) || []);

    // Build per-student summary
    const summary: Record<string, { name: string; total: number; present: number; absent: number; late: number; excused: number }> = {};
    for (const sid of allStudentIds) {
      summary[sid] = { name: profileMap.get(sid) || "?", total: 0, present: 0, absent: 0, late: 0, excused: 0 };
    }
    for (const a of (attendance || [])) {
      const s = summary[a.student_id];
      if (!s) continue;
      s.total++;
      if (a.status === "present") s.present++;
      else if (a.status === "absent") s.absent++;
      else if (a.status === "late") s.late++;
      else if (a.status === "excused") s.excused++;
    }
    const rows = Object.values(summary).sort((a, b) => a.name.localeCompare(b.name));

    // Generate PDF
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    let y = 20;
    const checkPage = (h = 20) => { if (y + h > 280) { doc.addPage(); y = 20; } };

    doc.setFontSize(18); doc.setFont("helvetica", "bold");
    doc.text("Academic Attendance Report", pw / 2, y, { align: "center" }); y += 8;
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`${className} | ${start.toLocaleDateString()} – ${end.toLocaleDateString()}`, pw / 2, y, { align: "center" }); y += 5;
    doc.text(`Generated: ${new Date().toLocaleString()}`, pw / 2, y, { align: "center" }); y += 12;

    // Stats box
    const totalRecs = (attendance || []).length;
    const presentCount = (attendance || []).filter(a => a.status === "present").length;
    const rate = totalRecs > 0 ? ((presentCount / totalRecs) * 100).toFixed(1) : "0";
    doc.setDrawColor(200, 200, 200); doc.setFillColor(245, 245, 245);
    doc.roundedRect(20, y - 3, pw - 40, 20, 3, 3, "FD"); y += 5;
    doc.text(`Total: ${totalRecs}  |  Attendance: ${rate}%  |  Present: ${presentCount}  |  Absent: ${(attendance || []).filter(a => a.status === "absent").length}  |  Late: ${(attendance || []).filter(a => a.status === "late").length}`, 25, y); y += 22;

    // Table
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.setFillColor(66, 66, 66); doc.setTextColor(255, 255, 255);
    doc.rect(20, y - 5, pw - 40, 8, "F");
    doc.text("Student", 25, y); doc.text("Total", 90, y); doc.text("Present", 110, y); doc.text("Absent", 130, y); doc.text("Late", 150, y); doc.text("Excused", 165, y); doc.text("%", 185, y);
    doc.setTextColor(0, 0, 0); y += 8;

    doc.setFont("helvetica", "normal");
    for (let i = 0; i < Math.min(rows.length, 100); i++) {
      checkPage(8);
      const r = rows[i];
      if (i % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(20, y - 4, pw - 40, 7, "F"); }
      doc.text(r.name.substring(0, 30), 25, y);
      doc.text(String(r.total), 95, y);
      doc.text(String(r.present), 115, y);
      doc.text(String(r.absent), 135, y);
      doc.text(String(r.late), 155, y);
      doc.text(String(r.excused), 170, y);
      const pct = r.total > 0 ? Math.round((r.present / r.total) * 100) : 0;
      const [cr, cg, cb] = pct >= 80 ? [34, 139, 34] : pct >= 60 ? [255, 165, 0] : [220, 20, 60];
      doc.setTextColor(cr, cg, cb); doc.text(`${pct}%`, 187, y); doc.setTextColor(0, 0, 0);
      y += 7;
    }

    // Footer
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(128, 128, 128);
      doc.text(`Page ${i}/${pages} | Ntare-Louisenlund Academic`, pw / 2, 290, { align: "center" });
    }

    const pdfOutput = doc.output("arraybuffer");
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfOutput)));

    return new Response(JSON.stringify({ pdf: pdfBase64, filename: `academic-report-${new Date().toISOString().split("T")[0]}.pdf` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
