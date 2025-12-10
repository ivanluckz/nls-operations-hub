import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
Format with clear sections using markdown.`
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

Students with multiple issues this week:
${repeatOffenders.length > 0 ? repeatOffenders.map(s => `- ${s.name}: ${s.count} issues`).join("\n") : "None"}

Activities with most attendance issues:
${problematicActivities.length > 0 ? problematicActivities.map(a => `- ${a.name}: ${a.count} issues`).join("\n") : "None"}

Please provide:
1. An executive summary (2-3 sentences)
2. Key highlights and concerns
3. Recommendations for improvement
4. Any positive trends to note`
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
    const summary = aiData.choices?.[0]?.message?.content || "Unable to generate summary.";

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
