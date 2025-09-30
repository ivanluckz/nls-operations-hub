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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch all preferences
    const { data: preferences, error: prefError } = await supabaseClient
      .from("preferences")
      .select("student_id, first_choice, second_choice, third_choice");

    if (prefError) throw prefError;

    // Fetch all activities
    const { data: activities, error: actError } = await supabaseClient
      .from("activities")
      .select("id, capacity");

    if (actError) throw actError;

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

    // Insert allocations
    const { error: insertError } = await supabaseClient
      .from("allocations")
      .upsert(allocations);

    if (insertError) throw insertError;

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
