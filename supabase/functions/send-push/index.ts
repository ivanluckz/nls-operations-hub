// Send web push notification to a recipient's subscribed devices.
// Auth: Requires either a service-role bearer token (from DB triggers / trusted servers)
// OR an authenticated admin/moderator caller. Direct unauthenticated calls are rejected.
import webpush from "https://esm.sh/web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_CONTACT = Deno.env.get("VAPID_CONTACT_EMAIL") || "mailto:admin@example.com";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC, VAPID_PRIVATE);

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // --- AUTH GUARD ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let authorized = false;
    if (token === SERVICE_ROLE_KEY) {
      authorized = true; // trusted internal caller (DB trigger / edge function)
    } else {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      });
      const { data: claims } = await userClient.auth.getClaims(token);
      const uid = claims?.claims?.sub;
      if (uid) {
        const { data: roles } = await adminClient
          .from("user_roles").select("role").eq("user_id", uid);
        const set = new Set((roles ?? []).map((r: { role: string }) => r.role));
        if (set.has("admin") || set.has("moderator")) authorized = true;
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // --- END AUTH GUARD ---

    const { recipient_id, title, body, url, tag } = await req.json();

    if (!recipient_id || typeof recipient_id !== "string" || !UUID_RE.test(recipient_id)) {
      return new Response(JSON.stringify({ error: "Valid recipient_id (UUID) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!title || typeof title !== "string") {
      return new Response(JSON.stringify({ error: "title required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs, error } = await adminClient
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", recipient_id);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "no subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeTitle = String(title).slice(0, 120);
    const safeBody = body ? String(body).slice(0, 300) : "";
    const safeUrl = typeof url === "string" && url.startsWith("/") ? url : "/";
    const safeTag = tag ? String(tag).slice(0, 64) : "nls";

    const payload = JSON.stringify({ title: safeTitle, body: safeBody, url: safeUrl, tag: safeTag });
    let sent = 0;
    const stale: string[] = [];

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          );
          sent++;
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) stale.push(s.id);
          else console.error("push error:", err.statusCode);
        }
      })
    );

    if (stale.length) {
      await adminClient.from("push_subscriptions").delete().in("id", stale);
    }

    return new Response(JSON.stringify({ sent, removed: stale.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-push fatal:", e?.message ?? e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
