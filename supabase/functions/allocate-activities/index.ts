import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security: Verify the user is authenticated and is a moderator
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is a moderator
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Authentication error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "moderator") {
      console.error("Authorization error:", profileError);
      return new Response(
        JSON.stringify({ error: "Forbidden: Moderator access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for allocation operations
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch all preferences using service client
    const { data: preferences, error: prefError } = await serviceClient
      .from("preferences")
      .select("student_id, first_choice, second_choice, third_choice");

    if (prefError) {
      console.error("Error fetching preferences:", prefError);
      throw prefError;
    }

    // Fetch all activities using service client
    const { data: activities, error: actError } = await serviceClient
      .from("activities")
      .select("id, capacity");

    if (actError) {
      console.error("Error fetching activities:", actError);
      throw actError;
    }

    // Create capacity tracker
    const capacityTracker = new Map(activities.map(a => [a.id, { capacity: a.capacity, enrolled: 0 }]));

    const allocations = [];

    // First pass: Try to allocate first choices
    for (const pref of preferences || []) {
      const activity = capacityTracker.get(pref.first_choice);
      if (activity && activity.enrolled < activity.capacity) {
        allocations.push({
          student_id: pref.student_id,
          activity_id: pref.first_choice,
          preference_rank: 1,
          status: "allocated",
        });
        activity.enrolled++;
      }
    }

    // Second pass: Allocate remaining students to second choices
    for (const pref of preferences || []) {
      if (allocations.some(a => a.student_id === pref.student_id)) continue;
      const activity = capacityTracker.get(pref.second_choice);
      if (activity && activity.enrolled < activity.capacity) {
        allocations.push({
          student_id: pref.student_id,
          activity_id: pref.second_choice,
          preference_rank: 2,
          status: "allocated",
        });
        activity.enrolled++;
      }
    }

    // Third pass: Allocate to third choices
    for (const pref of preferences || []) {
      if (allocations.some(a => a.student_id === pref.student_id)) continue;
      const activity = capacityTracker.get(pref.third_choice);
      if (activity && activity.enrolled < activity.capacity) {
        allocations.push({
          student_id: pref.student_id,
          activity_id: pref.third_choice,
          preference_rank: 3,
          status: "allocated",
        });
        activity.enrolled++;
      }
    }

    // Insert allocations using service client
    const { error: insertError } = await serviceClient
      .from("allocations")
      .upsert(allocations);

    if (insertError) {
      console.error("Error inserting allocations:", insertError);
      throw insertError;
    }

    console.log(`Successfully allocated ${allocations.length} students`);

    return new Response(
      JSON.stringify({ success: true, allocated: allocations.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Allocation error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
