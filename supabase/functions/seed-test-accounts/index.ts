// Seeds 6 test accounts (one per role) using the service role key.
// Bypasses email-domain trigger by using admin createUser + email_confirm: true.
// Idempotent: if user exists, just ensures role is correct.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLES = ["admin", "moderator", "teacher", "rl_coach", "medical", "student"] as const;
const PASSWORD = "TestPass123!";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const results: Array<Record<string, unknown>> = [];

    for (const role of ROLES) {
      const email = `test.${role}@ntare-louisenlund.org`;
      const fullName = `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`;

      // Try to find existing user
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      let user = list?.users.find((u) => u.email === email);

      if (!user) {
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          password: PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });
        if (createErr) {
          results.push({ role, email, error: createErr.message });
          continue;
        }
        user = created.user!;
      } else {
        // Reset password to known value
        await admin.auth.admin.updateUserById(user.id, { password: PASSWORD, email_confirm: true });
      }

      // Ensure profile exists (trigger normally creates it; just in case)
      await admin
        .from("profiles")
        .upsert({ id: user.id, email, full_name: fullName, banned: false }, { onConflict: "id" });

      // Set role: delete existing rows, insert the desired role
      await admin.from("user_roles").delete().eq("user_id", user.id);
      const { error: roleErr } = await admin.from("user_roles").insert({ user_id: user.id, role });

      results.push({
        role,
        email,
        password: PASSWORD,
        user_id: user.id,
        roleError: roleErr?.message ?? null,
      });
    }

    return new Response(JSON.stringify({ ok: true, accounts: results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
