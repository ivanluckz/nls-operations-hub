import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin/moderator
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check admin/moderator role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "moderator"]);

    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden: admin or moderator role required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { request_id, action, admin_notes } = await req.json();

    if (!request_id || !action || !["approve", "deny"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid request: need request_id and action (approve/deny)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch the request
    const { data: request, error: fetchError } = await adminClient
      .from("student_requests")
      .select("*")
      .eq("id", request_id)
      .single();

    if (fetchError || !request) {
      return new Response(JSON.stringify({ error: "Request not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (request.status !== "pending") {
      return new Response(JSON.stringify({ error: "Request already processed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "deny") {
      await adminClient.from("student_requests").update({
        status: "denied",
        admin_notes: admin_notes || "Request denied",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", request_id);

      return new Response(JSON.stringify({ success: true, message: "Request denied" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Approve: execute the change
    const details = request.details || {};
    let resultMessage = "Request approved";

    if (request.request_type === "swap_activity") {
      // Remove old allocation, add new one
      if (details.current_activity_id) {
        await adminClient.from("allocations").delete()
          .eq("student_id", request.student_id)
          .eq("activity_id", details.current_activity_id);
      }
      if (details.desired_activity_id) {
        const day = details.day_of_week || "Monday";
        await adminClient.from("allocations").insert({
          student_id: request.student_id,
          activity_id: details.desired_activity_id,
          status: "allocated",
          preference_rank: 0,
          day_of_week: day,
          slot_number: 1,
        });
      }
      resultMessage = `Swapped from ${details.current_activity_name || "old"} to ${details.desired_activity_name || "new"}`;

    } else if (request.request_type === "excuse") {
      // Find matching attendance sessions for the excuse date and mark as excused
      const excuseDate = details.excuse_date || new Date().toISOString().split("T")[0];
      const { data: sessions } = await adminClient
        .from("attendance_sessions")
        .select("id")
        .eq("session_date", excuseDate);

      if (sessions && sessions.length > 0) {
        for (const session of sessions) {
          await adminClient.from("attendance_records").upsert({
            session_id: session.id,
            student_id: request.student_id,
            status: "excused",
            marked_by: user.id,
          }, { onConflict: "session_id,student_id" });
        }
      }
      resultMessage = `Excused for ${excuseDate}`;

    } else if (request.request_type === "drop_activity") {
      if (details.activity_id) {
        await adminClient.from("allocations").delete()
          .eq("student_id", request.student_id)
          .eq("activity_id", details.activity_id);
      }
      resultMessage = `Dropped from ${details.activity_name || "activity"}`;
    }

    // Update request status
    await adminClient.from("student_requests").update({
      status: "approved",
      admin_notes: admin_notes || resultMessage,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", request_id);

    return new Response(JSON.stringify({ success: true, message: resultMessage }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
