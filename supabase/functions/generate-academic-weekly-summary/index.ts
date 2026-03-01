import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: roleData } = await supabaseAuth.from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin", "moderator"]);
    if (!roleData?.length) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];

    // Get sessions in the past week
    const { data: sessions } = await supabase.from("academic_sessions").select("id, slot_id, session_date").gte("session_date", startStr).lte("session_date", endStr);
    const sessionIds = sessions?.map(s => s.id) || [];

    if (!sessionIds.length) {
      return new Response(JSON.stringify({
        summary: "No academic sessions were recorded in the past week.",
        statistics: { totalIssues: 0, absent: 0, late: 0, excused: 0 },
        dateRange: { start: startDate.toLocaleDateString(), end: endDate.toLocaleDateString() },
        repeatOffenders: [],
        problematicSubjects: [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get attendance
    const { data: attendance } = await supabase.from("academic_attendance").select("session_id, student_id, status").in("session_id", sessionIds);
    const issues = (attendance || []).filter(a => a.status !== "present");

    // Get profiles
    const studentIds = [...new Set(issues.map(a => a.student_id))];
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);
    const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

    // Get slot -> subject mapping
    const slotIds = [...new Set(sessions?.map(s => s.slot_id) || [])];
    const { data: slots } = await supabase.from("timetable_slots").select("id, subject_id").in("id", slotIds.length ? slotIds : ["00000000-0000-0000-0000-000000000000"]);
    const slotSubjectMap = new Map(slots?.map(s => [s.id, s.subject_id]) || []);

    const { data: subjects } = await supabase.from("academic_subjects").select("id, name");
    const subjectMap = new Map(subjects?.map(s => [s.id, s.name]) || []);

    // Session -> slot mapping
    const sessionSlotMap = new Map(sessions?.map(s => [s.id, s.slot_id]) || []);

    // Stats
    const absentCount = issues.filter(a => a.status === "absent").length;
    const lateCount = issues.filter(a => a.status === "late").length;
    const excusedCount = issues.filter(a => a.status === "excused").length;

    // Repeat offenders
    const studentCounts = new Map<string, number>();
    issues.forEach(a => studentCounts.set(a.student_id, (studentCounts.get(a.student_id) || 0) + 1));
    const repeatOffenders = Array.from(studentCounts.entries())
      .filter(([, c]) => c >= 2)
      .map(([id, count]) => ({ name: profileMap.get(id) || "Unknown", count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Problematic subjects
    const subjectCounts = new Map<string, number>();
    issues.forEach(a => {
      const slotId = sessionSlotMap.get(a.session_id);
      const subjectId = slotId ? slotSubjectMap.get(slotId) : null;
      if (subjectId) subjectCounts.set(subjectId, (subjectCounts.get(subjectId) || 0) + 1);
    });
    const problematicSubjects = Array.from(subjectCounts.entries())
      .map(([id, count]) => ({ name: subjectMap.get(id) || "Unknown", count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // AI summary
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You generate professional weekly academic attendance reports. Mention specific student names. Be concise but actionable. Use markdown formatting." },
          { role: "user", content: `Generate a weekly ACADEMIC attendance summary:\n\nDate Range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}\nTotal issues: ${issues.length} (${absentCount} absent, ${lateCount} late, ${excusedCount} excused)\n\nRepeat offenders:\n${repeatOffenders.map(s => `- ${s.name}: ${s.count} issues`).join("\n") || "None"}\n\nSubjects with issues:\n${problematicSubjects.map(s => `- ${s.name}: ${s.count} issues`).join("\n") || "None"}\n\nProvide: 1) Executive summary 2) Key concerns with names 3) Subject analysis 4) Recommendations` }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResponse.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content || "Unable to generate summary.";

    return new Response(JSON.stringify({
      summary,
      statistics: { totalIssues: issues.length, absent: absentCount, late: lateCount, excused: excusedCount },
      dateRange: { start: startDate.toLocaleDateString(), end: endDate.toLocaleDateString() },
      repeatOffenders,
      problematicSubjects,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
