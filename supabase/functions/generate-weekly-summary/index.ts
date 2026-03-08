import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

// Issue #21: Use specific allowed origins instead of wildcard
const getAllowedOrigin = (req: Request): string => {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigins = [
    "https://id-preview--f393e585-fc10-4a2e-a662-735d93b755e9.lovable.app",
    "https://nls-co-curricular.lovable.app",
    "http://localhost:5173",
    "http://localhost:3000"
  ];
  return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
};

const getCorsHeaders = (req: Request) => ({
  "Access-Control-Allow-Origin": getAllowedOrigin(req),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Please log in to view weekly summary" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Create client with user's auth token to verify authentication
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

    // Verify admin or moderator role
    const { data: roleData } = await supabaseAuth
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "moderator"]);

    if (!roleData || roleData.length === 0) {
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin or Moderator access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Authenticated user ${user.id} (role: ${roleData[0].role}) generating weekly summary`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use service role key for data operations (internal operation)
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get date range for the past week
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    console.log("Fetching attendance data from", startDate.toISOString(), "to", endDate.toISOString());

    // Fetch attendance notifications from the past week
    const { data: notifications, error: notifError } = await supabase
      .from("attendance_notifications")
      .select(`
        id,
        status,
        notified_at,
        notes,
        student_id,
        activity_id
      `)
      .gte("notified_at", startDate.toISOString())
      .lte("notified_at", endDate.toISOString());

    if (notifError) {
      console.error("Error fetching notifications:", notifError);
      throw notifError;
    }

    console.log("Found", notifications?.length || 0, "attendance notifications");

    // Fetch student profiles
    const studentIds = [...new Set(notifications?.map(n => n.student_id) || [])];
    const { data: students } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"]);

    // Fetch activities
    const activityIds = [...new Set(notifications?.map(n => n.activity_id) || [])];
    const { data: activities } = await supabase
      .from("activities")
      .select("id, title")
      .in("id", activityIds.length > 0 ? activityIds : ["00000000-0000-0000-0000-000000000000"]);

    // Create lookup maps
    const studentMap = new Map(students?.map(s => [s.id, s.full_name]) || []);
    const activityMap = new Map(activities?.map(a => [a.id, a.title]) || []);

    // Calculate statistics
    const absentCount = notifications?.filter(n => n.status === "absent").length || 0;
    const lateCount = notifications?.filter(n => n.status === "late").length || 0;
    const excusedCount = notifications?.filter(n => n.status === "excused").length || 0;
    const totalIssues = notifications?.length || 0;

    // Find students with multiple issues
    const studentIssueCount = new Map<string, number>();
    notifications?.forEach(n => {
      const current = studentIssueCount.get(n.student_id) || 0;
      studentIssueCount.set(n.student_id, current + 1);
    });

    const repeatOffenders = Array.from(studentIssueCount.entries())
      .filter(([_, count]) => count >= 2)
      .map(([id, count]) => ({
        name: studentMap.get(id) || "Unknown",
        label: `Student-${id.slice(0, 6)}`,
        id,
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Find activities with most issues
    const activityIssueCount = new Map<string, number>();
    notifications?.forEach(n => {
      const current = activityIssueCount.get(n.activity_id) || 0;
      activityIssueCount.set(n.activity_id, current + 1);
    });

    const problematicActivities = Array.from(activityIssueCount.entries())
      .map(([id, count]) => ({
        name: activityMap.get(id) || "Unknown",
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Build detailed records with anonymized IDs for AI context (privacy: no PII sent to external AI)
    // Create anonymized student labels for AI prompt
    const studentAnonMap = new Map<string, string>();
    let anonCounter = 1;
    studentIds.forEach(id => {
      studentAnonMap.set(id, `Student ${anonCounter++}`);
    });

    const detailedRecords = notifications?.map(n => ({
      studentLabel: studentAnonMap.get(n.student_id) || "Unknown Student",
      studentId: n.student_id,
      studentName: studentMap.get(n.student_id) || "Unknown Student",
      activityName: activityMap.get(n.activity_id) || "Unknown Activity",
      status: n.status,
      date: n.notified_at ? new Date(n.notified_at).toLocaleDateString() : "Unknown date",
      notes: n.notes || ""
    })) || [];

    // Group by status for detailed breakdown
    const absentRecords = detailedRecords.filter(r => r.status === "absent");
    const lateRecords = detailedRecords.filter(r => r.status === "late");
    const excusedRecords = detailedRecords.filter(r => r.status === "excused");

    // Build context for AI
    const dataContext = {
      dateRange: {
        start: startDate.toLocaleDateString(),
        end: endDate.toLocaleDateString()
      },
      statistics: {
        totalIssues,
        absent: absentCount,
        late: lateCount,
        excused: excusedCount
      },
      repeatOffenders,
      problematicActivities
    };

    console.log("Data context for AI:", JSON.stringify(dataContext));

    // Generate summary using Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an assistant that generates professional weekly attendance summary reports for a school's co-curricular activity system. 
Write in a formal but friendly tone. Be concise but informative. 
Include actionable recommendations when appropriate.
Format with clear sections using markdown.
Use the anonymized student labels (e.g. "Student 1") as provided - they will be replaced with real names after generation.`
          },
          {
            role: "user",
            content: `Generate a weekly attendance summary report based on this data:

Date Range: ${dataContext.dateRange.start} to ${dataContext.dateRange.end}

Statistics:
- Total attendance issues: ${dataContext.statistics.totalIssues}
- Absences: ${dataContext.statistics.absent}
- Late arrivals: ${dataContext.statistics.late}
- Excused absences: ${dataContext.statistics.excused}

Students with multiple issues this week (PRIORITY):
${repeatOffenders.length > 0 ? repeatOffenders.map(s => `- ${s.label}: ${s.count} issues`).join("\n") : "None"}

Activities with most attendance issues:
${problematicActivities.length > 0 ? problematicActivities.map(a => `- ${a.name}: ${a.count} issues`).join("\n") : "None"}

Detailed Absent Students:
${absentRecords.length > 0 ? absentRecords.slice(0, 15).map(r => `- ${r.studentLabel} was absent from ${r.activityName} on ${r.date}`).join("\n") : "No absences"}

Detailed Late Students:
${lateRecords.length > 0 ? lateRecords.slice(0, 10).map(r => `- ${r.studentLabel} was late to ${r.activityName} on ${r.date}`).join("\n") : "No late arrivals"}

Excused Students:
${excusedRecords.length > 0 ? excusedRecords.slice(0, 10).map(r => `- ${r.studentLabel} was excused from ${r.activityName} on ${r.date}${r.notes ? ` (${r.notes})` : ""}`).join("\n") : "No excused absences"}

Please provide:
1. An executive summary (2-3 sentences)
2. Key highlights and concerns - mention specific students who need attention
3. Breakdown by status type with student identifiers
4. Recommendations for improvement
5. Any positive trends to note`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawSummary = aiData.choices?.[0]?.message?.content || "Unable to generate summary.";

    // Post-process: replace anonymized labels with real names (names stay server-side, never sent to AI)
    let summary = rawSummary;
    studentAnonMap.forEach((label, id) => {
      const realName = studentMap.get(id);
      if (realName) {
        summary = summary.replaceAll(label, realName);
      }
    });
    // Also replace repeat offender labels
    repeatOffenders.forEach(r => {
      summary = summary.replaceAll(r.label, r.name);
    });

    console.log("Successfully generated summary");

    return new Response(
      JSON.stringify({
        summary,
        statistics: dataContext.statistics,
        dateRange: dataContext.dateRange,
        repeatOffenders,
        problematicActivities
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in generate-weekly-summary:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
