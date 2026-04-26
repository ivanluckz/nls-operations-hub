import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Parse end time from a schedule string like "3:00 PM - 4:00 PM".
 * Returns a Date for today at that time, or null if unparseable.
 */
const parseEndTime = (schedule: string): Date | null => {
  const matches = [...schedule.matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi)];
  // Last match is the end time
  const m = matches[matches.length - 1];
  if (!m) return null;

  let hours = parseInt(m[1]);
  const minutes = parseInt(m[2]);
  const ampm = m[3].toUpperCase();
  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;

  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require shared cron secret to prevent unauthenticated bulk attendance manipulation
  const cronSecret = req.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("CRON_SECRET");
  if (!expectedSecret || !cronSecret || cronSecret !== expectedSecret) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split("T")[0];
    const now = new Date();

    console.log(`auto-mark-absent: running for ${today} at ${now.toISOString()}`);

    // Get all DRAFT sessions for today with activity schedule
    const { data: sessions, error: sessionsError } = await supabase
      .from("attendance_sessions")
      .select("id, activity_id, day_of_week, slot_number, activities(id, schedule, title)")
      .eq("session_date", today)
      .eq("status", "draft");

    if (sessionsError) throw sessionsError;

    let processedSessions = 0;
    let absentCreated = 0;

    for (const session of (sessions || [])) {
      const activity = session.activities as any;
      if (!activity?.schedule) continue;

      // Only process if session's activity end time has passed
      const endTime = parseEndTime(activity.schedule);
      if (!endTime || now < endTime) continue;

      console.log(`Processing session ${session.id} for "${activity.title}" (ended ${endTime.toLocaleTimeString()})`);

      // Get all students allocated to this activity+day+slot
      const { data: allocations } = await supabase
        .from("allocations")
        .select("student_id")
        .eq("activity_id", session.activity_id)
        .eq("day_of_week", session.day_of_week)
        .eq("slot_number", session.slot_number);

      if (!allocations || allocations.length === 0) continue;

      const allocatedIds = allocations.map((a: any) => a.student_id);

      // Get students who already have a record for this session
      const { data: existingRecords } = await supabase
        .from("attendance_records")
        .select("student_id")
        .eq("session_id", session.id);

      const recordedIds = new Set((existingRecords || []).map((r: any) => r.student_id));

      // Students with no record → mark absent
      const unmarkedIds = allocatedIds.filter((id: string) => !recordedIds.has(id));
      if (unmarkedIds.length === 0) continue;

      // Insert absent records
      const absentRecords = unmarkedIds.map((student_id: string) => ({
        session_id: session.id,
        student_id,
        status: "absent",
        // marked_by is null = auto-marked by system
      }));

      const { error: insertError } = await supabase
        .from("attendance_records")
        .insert(absentRecords);

      if (insertError) {
        console.error(`Failed to insert absent records for session ${session.id}:`, insertError);
        continue;
      }

      // Create attendance notifications for absent students
      const notifications = unmarkedIds.map((student_id: string) => ({
        session_id: session.id,
        student_id,
        activity_id: session.activity_id,
        status: "absent",
        notes: "Auto-marked absent — session ended, student not recorded",
      }));

      await supabase
        .from("attendance_notifications")
        .upsert(notifications, { onConflict: "session_id,student_id,activity_id" });

      console.log(`  → ${unmarkedIds.length} students auto-marked absent`);
      absentCreated += unmarkedIds.length;
      processedSessions++;
    }

    console.log(`Done: ${processedSessions} sessions processed, ${absentCreated} absent records created`);

    return new Response(
      JSON.stringify({ success: true, processedSessions, absentCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("auto-mark-absent error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
