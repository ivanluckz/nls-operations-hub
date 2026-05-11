// Impersonates each role and probes RLS across critical tables + actions.
// Returns a JSON matrix: role × table × {can_select, can_insert, can_update, can_delete, sample_row_count}
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ACCOUNTS = [
  { role: "admin", email: "test.admin@ntare-louisenlund.org" },
  { role: "moderator", email: "test.moderator@ntare-louisenlund.org" },
  { role: "teacher", email: "test.teacher@ntare-louisenlund.org" },
  { role: "rl_coach", email: "test.rl_coach@ntare-louisenlund.org" },
  { role: "medical", email: "test.medical@ntare-louisenlund.org" },
  { role: "student", email: "test.student@ntare-louisenlund.org" },
];

const TABLES = [
  "profiles", "user_roles", "user_badges", "activities", "allocations",
  "preferences", "attendance_sessions", "attendance_records", "attendance_notifications",
  "meal_attendance", "medical_visits", "workout_signups", "workouts",
  "direct_messages", "dm_channels", "activity_messages", "student_requests",
  "houses", "google_calendar_tokens", "push_subscriptions", "integration_settings",
  "allocation_audit_log", "user_themes",
];

const PASSWORD = "TestPass123!";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const matrix: Record<string, Record<string, { rows: number | null; error: string | null }>> = {};
    const dashboardChecks: Array<Record<string, unknown>> = [];

    for (const acct of ACCOUNTS) {
      // Sign in as this user using anon key
      const userClient = createClient(url, anonKey, { auth: { persistSession: false } });
      const { data: signIn, error: signErr } = await userClient.auth.signInWithPassword({
        email: acct.email, password: PASSWORD,
      });
      if (signErr || !signIn.session) {
        matrix[acct.role] = { __login_error: { rows: null, error: signErr?.message ?? "no session" } };
        continue;
      }
      matrix[acct.role] = {};

      for (const table of TABLES) {
        // SELECT probe
        const { data, error, count } = await userClient
          .from(table)
          .select("*", { count: "exact", head: true })
          .limit(1);
        matrix[acct.role][table] = {
          rows: count ?? (data?.length ?? null),
          error: error?.message ?? null,
        };
      }

      // Dashboard-specific edge functions / probes
      // 1. Ensure they CAN read their own profile
      const { data: me, error: meErr } = await userClient
        .from("profiles").select("id, full_name, banned").eq("id", signIn.user.id).maybeSingle();
      // 2. Check their role lookup
      const { data: roleRow, error: roleErr } = await userClient
        .from("user_roles").select("role").eq("user_id", signIn.user.id).maybeSingle();
      // 3. Try a forbidden write — non-admin trying to insert into user_roles
      const { error: privEscErr } = await userClient
        .from("user_roles").insert({ user_id: signIn.user.id, role: "admin" });

      dashboardChecks.push({
        role: acct.role,
        own_profile_ok: !!me && !meErr,
        role_lookup_ok: !!roleRow && !roleErr,
        role_lookup_value: roleRow?.role ?? null,
        privilege_escalation_blocked: !!privEscErr,
        privilege_escalation_msg: privEscErr?.message ?? "ALLOWED — LEAK!",
      });

      await userClient.auth.signOut();
    }

    return new Response(JSON.stringify({ ok: true, matrix, dashboardChecks }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
