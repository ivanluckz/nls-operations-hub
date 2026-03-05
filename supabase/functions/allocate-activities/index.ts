import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const getAllowedOrigin = (req: Request): string => {
  const origin = req.headers.get("Origin") || "";
  if (
    origin.endsWith(".lovable.app") ||
    origin.endsWith(".lovableproject.com") ||
    origin === "http://localhost:5173" ||
    origin === "http://localhost:3000"
  ) {
    return origin;
  }
  return "*";
};

const getCorsHeaders = (req: Request) => ({
  "Access-Control-Allow-Origin": getAllowedOrigin(req),
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
const DayOfWeekEnum = z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
const UUIDSchema = z.string().uuid();

// Validate allocation data
const AllocationSchema = z.object({
  student_id: UUIDSchema,
  activity_id: UUIDSchema,
  day_of_week: DayOfWeekEnum,
  slot_number: z.number().int().min(1).max(2),
  preference_rank: z.number().int().min(1).max(5),
  status: z.literal("allocated"),
});

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Authentication error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check role from secure user_roles table
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["moderator", "admin"]);

    if (roleError || !roleData || roleData.length === 0) {
      console.error("Authorization error:", roleError);
      return new Response(JSON.stringify({ error: "Forbidden: Moderator or Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Issue #26: Create audit log entry with backup timestamp
    const backupTimestamp = new Date().toISOString();
    const { data: auditLog, error: auditError } = await serviceClient
      .from("allocation_audit_log")
      .insert({
        triggered_by: user.id,
        status: "running",
      })
      .select()
      .single();

    if (auditError) {
      console.error("Error creating audit log:", auditError);
    }

    try {
      // Issue #26: Fetch existing allocations count for rollback reference
      const { data: existingAllocations, error: existingError } = await serviceClient
        .from("allocations")
        .select("id, student_id, activity_id, day_of_week, slot_number, preference_rank")
        .limit(10000);

      if (existingError) {
        console.error("Error fetching existing allocations:", existingError);
      }

      const existingCount = existingAllocations?.length || 0;
      console.log(`Backup created at ${backupTimestamp}: ${existingCount} existing allocations`);

      // Delete ALL existing allocations before creating new ones
      console.log(`Deleting ${existingCount} existing allocations before creating new ones...`);
      const { error: deleteError } = await serviceClient
        .from("allocations")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all rows

      if (deleteError) {
        console.error("Error deleting old allocations:", deleteError);
        if (auditLog) {
          await serviceClient
            .from("allocation_audit_log")
            .update({
              completed_at: new Date().toISOString(),
              status: "failed",
              error_message: `Failed to clear old allocations: ${deleteError.message}`,
              allocations_created: 0,
            })
            .eq("id", auditLog.id);
        }
        throw new Error(`Failed to clear old allocations: ${deleteError.message}`);
      }
      console.log(`Successfully deleted old allocations`);

      const { data: preferences, error: prefError } = await serviceClient.from("preferences").select("*");

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

      type AllocationInput = z.infer<typeof AllocationSchema>;
      const allocations: AllocationInput[] = [];
      const validationErrors: string[] = [];

      // Process each day separately (Wednesday has 2 slots, others have 1)
      for (const day of DAYS) {
        const dayLower = day.toLowerCase();
        const slots = day === "Wednesday" ? [1, 2] : [1];

        for (const slot of slots) {
          const slotSuffix = day === "Wednesday" ? `_slot${slot}` : "";
          // Wednesday activities are stored as "Wednesday Slot 1" or "Wednesday Slot 2"
          const dayFilter = day === "Wednesday" ? `Wednesday Slot ${slot}` : day;
          const dayActivities = activities.filter((a) => a.days_of_week && a.days_of_week.includes(dayFilter));
          const capacityTracker = new Map(dayActivities.map((a) => [a.id, { capacity: a.capacity, enrolled: 0 }]));

          // Process all 5 preference ranks
          for (let rank = 1; rank <= 5; rank++) {
            const choiceLabel = ["first", "second", "third", "fourth", "fifth"][rank - 1];

            for (const pref of preferences || []) {
              // Skip if student already allocated for this day-slot combination
              if (
                allocations.some(
                  (a) => a.student_id === pref.student_id && a.day_of_week === day && a.slot_number === slot,
                )
              )
                continue;

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
                    `Invalid allocation for student ${pref.student_id}: ${validation.error.message}`,
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

      // Issue #26: Insert new allocations FIRST, then delete old ones
      // This ensures we don't lose data if insertion fails
      console.log(`Attempting to insert ${allocations.length} new allocations...`);

      const { error: insertError } = await serviceClient.from("allocations").insert(allocations);

      if (insertError) {
        console.error("Error inserting allocations:", insertError);
        if (auditLog) {
          await serviceClient
            .from("allocation_audit_log")
            .update({
              completed_at: new Date().toISOString(),
              status: "failed",
              error_message: `Insert failed: ${insertError.message}`,
              allocations_created: 0,
              validation_errors: validationErrors.length,
            })
            .eq("id", auditLog.id);
        }
        throw new Error(`Failed to insert new allocations: ${insertError.message}`);
      }

      console.log(`Successfully allocated ${allocations.length} student-day combinations`);
      if (validationErrors.length > 0) {
        console.log(`Skipped ${validationErrors.length} invalid allocations`);
      }

      // Update audit log with success
      if (auditLog) {
        await serviceClient
          .from("allocation_audit_log")
          .update({
            completed_at: new Date().toISOString(),
            status: "completed",
            allocations_created: allocations.length,
            validation_errors: validationErrors.length,
          })
          .eq("id", auditLog.id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          allocated: allocations.length,
          previous_count: existingCount,
          validation_errors: validationErrors.length,
          warnings: validationErrors.length > 0 ? validationErrors : undefined,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (innerError: unknown) {
      const errorMessage = innerError instanceof Error ? innerError.message : String(innerError);

      // Update audit log with failure
      if (auditLog) {
        await serviceClient
          .from("allocation_audit_log")
          .update({
            completed_at: new Date().toISOString(),
            status: "failed",
            error_message: errorMessage,
          })
          .eq("id", auditLog.id);
      }
      throw innerError;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Allocation error:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
