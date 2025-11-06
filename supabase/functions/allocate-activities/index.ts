import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
const DayOfWeekEnum = z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
const UUIDSchema = z.string().uuid();

// Validate allocation data
const AllocationSchema = z.object({
  student_id: UUIDSchema,
  activity_id: UUIDSchema,
  day_of_week: DayOfWeekEnum,
  slot_number: z.number().int().min(1).max(2),
  preference_rank: z.number().int().min(1).max(5),
  status: z.literal("allocated")
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    if (profileError || !['moderator', 'admin'].includes(profile?.role)) {
      console.error("Authorization error:", profileError);
      return new Response(
        JSON.stringify({ error: "Forbidden: Moderator or Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Clear existing allocations
    await serviceClient.from("allocations").delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const { data: preferences, error: prefError } = await serviceClient
      .from("preferences")
      .select("*");

    if (prefError) {
      console.error("Error fetching preferences:", prefError);
      throw prefError;
    }

    const { data: activities, error: actError } = await serviceClient
      .from("activities")
      .select("id, capacity, days_of_week");

    if (actError) {
      console.error("Error fetching activities:", actError);
      throw actError;
    }

    const allocations: z.infer<typeof AllocationSchema>[] = [];
    const validationErrors: string[] = [];

    // Process each day separately (Wednesday has 2 slots, others have 1)
    for (const day of DAYS) {
      const dayLower = day.toLowerCase();
      const slots = day === 'Wednesday' ? [1, 2] : [1];
      
      for (const slot of slots) {
        const slotSuffix = day === 'Wednesday' ? `_slot${slot}` : '';
        const dayActivities = activities.filter(a => a.days_of_week && a.days_of_week.includes(day));
        const capacityTracker = new Map(dayActivities.map(a => [a.id, { capacity: a.capacity, enrolled: 0 }]));

        // Process all 5 preference ranks
        for (let rank = 1; rank <= 5; rank++) {
          const choiceLabel = ['first', 'second', 'third', 'fourth', 'fifth'][rank - 1];
          
          for (const pref of preferences || []) {
            // Skip if student already allocated for this day-slot combination
            if (allocations.some(a => a.student_id === pref.student_id && a.day_of_week === day && a.slot_number === slot)) continue;
            
            const choiceId = pref[`${dayLower}${slotSuffix}_${choiceLabel}_choice`];
            if (!choiceId) continue;
            
            const activity = capacityTracker.get(choiceId);
            if (activity && activity.enrolled < activity.capacity) {
              const allocationData = {
                student_id: pref.student_id,
                activity_id: choiceId,
                day_of_week: day,
                slot_number: slot,
                preference_rank: rank,
                status: "allocated" as const,
              };

              // Validate allocation data
              const validation = AllocationSchema.safeParse(allocationData);
              if (validation.success) {
                allocations.push(validation.data);
                activity.enrolled++;
              } else {
                validationErrors.push(
                  `Invalid allocation for student ${pref.student_id}: ${validation.error.message}`
                );
                console.error("Validation error:", validation.error.format());
              }
            }
          }
        }
      }
    }

    if (validationErrors.length > 0) {
      console.warn(`Found ${validationErrors.length} validation errors during allocation`);
    }

    const { error: insertError } = await serviceClient
      .from("allocations")
      .insert(allocations);

    if (insertError) {
      console.error("Error inserting allocations:", insertError);
      throw insertError;
    }

    console.log(`Successfully allocated ${allocations.length} student-day combinations`);
    if (validationErrors.length > 0) {
      console.log(`Skipped ${validationErrors.length} invalid allocations`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        allocated: allocations.length,
        validation_errors: validationErrors.length,
        warnings: validationErrors.length > 0 ? validationErrors : undefined
      }),
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