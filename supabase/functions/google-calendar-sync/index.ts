import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://id-preview--f393e585-fc10-4a2e-a662-735d93b755e9.lovable.app",
  "https://nls-co-curricular.lovable.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

const getAllowedOrigin = (req: Request): string => {
  const origin = req.headers.get("Origin") || "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
};

const getCorsHeaders = (req: Request) => ({
  "Access-Control-Allow-Origin": getAllowedOrigin(req),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
});

const GOOGLE_CLIENT_ID = Deno.env.get("Google_client_id")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("Google_client_secret")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// ---------- HMAC helpers for OAuth state signing ----------
async function getHmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // Use service role key as HMAC secret
  const keyBytes = new TextEncoder().encode(secret);
  return crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function signState(payload: Record<string, unknown>): Promise<string> {
  const key = await getHmacKey();
  const data = JSON.stringify(payload);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return btoa(JSON.stringify({ ...payload, hmac: sigB64 }));
}

async function verifyState(stateParam: string): Promise<Record<string, unknown>> {
  const parsed = JSON.parse(atob(stateParam));
  const { hmac, ...payload } = parsed;
  if (!hmac) throw new Error("Missing HMAC in state");
  const key = await getHmacKey();
  const data = JSON.stringify(payload);
  const sigBytes = new Uint8Array(atob(hmac).split("").map(c => c.charCodeAt(0)));
  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(data));
  if (!valid) throw new Error("Invalid state signature");
  return payload;
}

// ---------- Token encryption helpers (AES-GCM via Web Crypto) ----------
async function getEncryptKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("TOKEN_ENCRYPT_KEY");
  if (!raw) throw new Error("TOKEN_ENCRYPT_KEY env var not set");
  const keyBytes = new TextEncoder().encode(raw.padEnd(32, "0").slice(0, 32));
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptToken(plaintext: string): Promise<string> {
  const key = await getEncryptKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

async function decryptToken(encrypted: string): Promise<string> {
  const key = await getEncryptKey();
  const combined = new Uint8Array(atob(encrypted).split("").map(c => c.charCodeAt(0)));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}
// -----------------------------------------------------------------------;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // Handle OAuth callback BEFORE auth check (Google redirect has no Authorization header)
    if (action === "callback") {
      const code = url.searchParams.get("code");
      const stateParam = url.searchParams.get("state");

      if (!code || !stateParam) {
        return new Response("Missing code or state", { status: 400, headers: corsHeaders });
      }

      let stateData: Record<string, unknown>;
      try {
        stateData = await verifyState(stateParam);
      } catch (e) {
        console.error("State verification failed:", e);
        return new Response("Invalid or tampered state parameter", { status: 403, headers: corsHeaders });
      }
      const { userId: stateUserId, redirectUri } = stateData as { userId: string; redirectUri: string };

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: `${SUPABASE_URL}/functions/v1/google-calendar-sync?action=callback`,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        console.error("Token exchange failed:", tokenData);
        return Response.redirect(`${redirectUri}?calendar=error`, 302);
      }

      const serviceClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const expiry = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

      const [encAccessToken, encRefreshToken] = await Promise.all([
        encryptToken(tokenData.access_token),
        encryptToken(tokenData.refresh_token),
      ]);

      const { error: upsertError } = await serviceClient
        .from("google_calendar_tokens")
        .upsert({
          user_id: stateUserId,
          access_token: encAccessToken,
          refresh_token: encRefreshToken,
          token_expiry: expiry,
        }, { onConflict: "user_id" });

      if (upsertError) {
        console.error("Token storage failed:", upsertError);
        return Response.redirect(`${redirectUri}?calendar=error`, 302);
      }

      return Response.redirect(`${redirectUri}?calendar=connected`, 302);
    }

    // All other actions require Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;

    // Step 1: Generate OAuth URL for calendar consent
    if (action === "auth-url") {
      const redirectUri = url.searchParams.get("redirect_uri") || "";
      const state = btoa(JSON.stringify({ userId, redirectUri }));

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", `${SUPABASE_URL}/functions/v1/google-calendar-sync?action=callback`);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.events");
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("login_hint", claimsData.user.email || "");

      return new Response(JSON.stringify({ url: authUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Sync allocations to Google Calendar
    if (action === "sync") {
      // Get stored tokens
      const { data: tokenRow, error: tokenError } = await supabase
        .from("google_calendar_tokens")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (tokenError || !tokenRow) {
        return new Response(JSON.stringify({ error: "not_connected", message: "Google Calendar not connected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Decrypt stored tokens
      let accessToken: string;
      let refreshToken: string;
      try {
        [accessToken, refreshToken] = await Promise.all([
          decryptToken(tokenRow.access_token),
          decryptToken(tokenRow.refresh_token),
        ]);
      } catch {
        // Tokens were stored before encryption was introduced — force reconnect
        await supabase.from("google_calendar_tokens").delete().eq("user_id", userId);
        return new Response(JSON.stringify({ error: "not_connected", message: "Please reconnect Google Calendar" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Refresh token if expired
      if (new Date(tokenRow.token_expiry) <= new Date()) {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
          }),
        });

        const refreshData = await refreshRes.json();
        if (!refreshRes.ok) {
          console.error("Token refresh failed:", refreshData);
          return new Response(JSON.stringify({ error: "token_expired", message: "Please reconnect Google Calendar" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        accessToken = refreshData.access_token;
        const newExpiry = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();
        const encNewAccess = await encryptToken(accessToken);

        await supabase
          .from("google_calendar_tokens")
          .update({ access_token: encNewAccess, token_expiry: newExpiry })
          .eq("user_id", userId);
      }

      // Fetch student allocations with activity details
      const { data: allocations, error: allocError } = await supabase
        .from("allocations")
        .select("*, activities(title, description, schedule, teacher_in_charge)")
        .eq("student_id", userId);

      if (allocError) {
        console.error("Fetch allocations failed:", allocError);
        return new Response(JSON.stringify({ error: "Failed to fetch allocations" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!allocations || allocations.length === 0) {
        return new Response(JSON.stringify({ message: "No allocations to sync", synced: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Map day names to next occurrence dates
      const dayMap: Record<string, number> = {
        Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
        Thursday: 4, Friday: 5, Saturday: 6,
      };

      const getNextDay = (dayName: string): Date => {
        const today = new Date();
        const targetDay = dayMap[dayName] ?? 1;
        const diff = (targetDay - today.getDay() + 7) % 7 || 7;
        const next = new Date(today);
        next.setDate(today.getDate() + diff);
        return next;
      };

      let synced = 0;
      const errors: string[] = [];

      for (const alloc of allocations) {
        const activity = alloc.activities as any;
        if (!activity) continue;

        const eventDate = getNextDay(alloc.day_of_week);
        const startTime = new Date(eventDate);
        startTime.setHours(14, 0, 0, 0); // Default 2 PM
        const endTime = new Date(startTime);
        endTime.setHours(15, 0, 0, 0); // Default 1 hour

        const event = {
          summary: `🎯 ${activity.title}`,
          description: `Co-Curricular Activity\nTeacher: ${activity.teacher_in_charge}\nSchedule: ${activity.schedule}\n\n${activity.description || ""}`,
          start: {
            dateTime: startTime.toISOString(),
            timeZone: "Europe/Berlin",
          },
          end: {
            dateTime: endTime.toISOString(),
            timeZone: "Europe/Berlin",
          },
          recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${alloc.day_of_week.substring(0, 2).toUpperCase()}`],
          colorId: "9", // Blueberry
        };

        const calRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        });

        if (calRes.ok) {
          synced++;
        } else {
          const errData = await calRes.json();
          console.error(`Failed to create event for ${activity.title}:`, errData);
          errors.push(activity.title);
        }
      }

      return new Response(JSON.stringify({
        message: `Synced ${synced} of ${allocations.length} activities`,
        synced,
        total: allocations.length,
        errors,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Academic timetable sync
    if (action === "academic-sync") {
      const serviceClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // Get stored tokens
      const { data: tokenRow, error: tokenError } = await supabase
        .from("google_calendar_tokens")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (tokenError || !tokenRow) {
        return new Response(JSON.stringify({ error: "not_connected", message: "Google Calendar not connected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let accessToken: string;
      let refreshToken: string;
      try {
        [accessToken, refreshToken] = await Promise.all([
          decryptToken(tokenRow.access_token),
          decryptToken(tokenRow.refresh_token),
        ]);
      } catch {
        await supabase.from("google_calendar_tokens").delete().eq("user_id", userId);
        return new Response(JSON.stringify({ error: "not_connected", message: "Please reconnect Google Calendar" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Refresh token if expired
      if (new Date(tokenRow.token_expiry) <= new Date()) {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
          }),
        });
        const refreshData = await refreshRes.json();
        if (!refreshRes.ok) {
          return new Response(JSON.stringify({ error: "token_expired", message: "Please reconnect Google Calendar" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        accessToken = refreshData.access_token;
        const newExpiry = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();
        const encNewAccess = await encryptToken(accessToken);
        await supabase.from("google_calendar_tokens").update({ access_token: encNewAccess, token_expiry: newExpiry }).eq("user_id", userId);
      }

      // Get student's class group memberships
      const { data: memberships } = await serviceClient.from("class_group_members").select("class_group_id").eq("student_id", userId);
      const groupIds = memberships?.map((m: any) => m.class_group_id) || [];

      let allSlots: any[] = [];
      if (groupIds.length) {
        const { data: classSlots } = await serviceClient.from("timetable_slots").select("*, academic_subjects(name, code, color)").in("class_group_id", groupIds).eq("is_elective", false);
        allSlots = classSlots || [];
      }
      const { data: enrollments } = await serviceClient.from("timetable_enrollments").select("slot_id").eq("student_id", userId);
      if (enrollments?.length) {
        const { data: electiveSlots } = await serviceClient.from("timetable_slots").select("*, academic_subjects(name, code, color)").in("id", enrollments.map((e: any) => e.slot_id));
        allSlots = [...allSlots, ...(electiveSlots || [])];
      }

      if (!allSlots.length) {
        return new Response(JSON.stringify({ message: "No timetable slots to sync", synced: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get periods for time mapping
      const { data: periods } = await serviceClient.from("academic_periods").select("*").order("sort_order");
      const periodMap = new Map((periods || []).map((p: any) => [p.sort_order, p]));

      // Get teacher names
      const teacherIds = [...new Set(allSlots.map(s => s.teacher_id).filter(Boolean))];
      let teacherMap = new Map<string, string>();
      if (teacherIds.length) {
        const { data: teachers } = await serviceClient.from("profiles").select("id, full_name").in("id", teacherIds);
        teacherMap = new Map((teachers || []).map((t: any) => [t.id, t.full_name]));
      }

      const dayNames = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayAbbrev: Record<number, string> = { 1: "MO", 2: "TU", 3: "WE", 4: "TH", 5: "FR" };

      const getNextDay = (dayNum: number): Date => {
        const today = new Date();
        const diff = (dayNum - today.getDay() + 7) % 7 || 7;
        const next = new Date(today);
        next.setDate(today.getDate() + diff);
        return next;
      };

      let synced = 0;
      const errors: string[] = [];

      for (const slot of allSlots) {
        const subject = slot.academic_subjects as any;
        if (!subject) continue;
        const period = periodMap.get(slot.period_number);
        if (!period || period.is_break) continue;

        const eventDate = getNextDay(slot.day_of_week);
        const [startH, startM] = (period.start_time as string).split(":").map(Number);
        const [endH, endM] = (period.end_time as string).split(":").map(Number);

        const startTime = new Date(eventDate);
        startTime.setHours(startH, startM, 0, 0);
        const endTime = new Date(eventDate);
        endTime.setHours(endH, endM, 0, 0);

        const teacherName = slot.teacher_id ? teacherMap.get(slot.teacher_id) || "TBA" : "TBA";

        const event = {
          summary: `📚 ${subject.name}`,
          description: `Academic Class\nTeacher: ${teacherName}${slot.room ? `\nRoom: ${slot.room}` : ""}\nPeriod: ${period.label}\nDay: ${dayNames[slot.day_of_week] || ""}`,
          start: { dateTime: startTime.toISOString(), timeZone: "Europe/Berlin" },
          end: { dateTime: endTime.toISOString(), timeZone: "Europe/Berlin" },
          recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${dayAbbrev[slot.day_of_week] || "MO"}`],
          colorId: "1",
        };

        const calRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(event),
        });

        if (calRes.ok) {
          synced++;
        } else {
          const errData = await calRes.json();
          console.error(`Failed to create event for ${subject.name}:`, errData);
          errors.push(subject.name);
        }
      }

      return new Response(JSON.stringify({
        message: `Synced ${synced} of ${allSlots.length} classes`,
        synced,
        total: allSlots.length,
        errors,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 4: Check connection status
    if (action === "status") {
      const { data, error } = await supabase
        .from("google_calendar_tokens")
        .select("id, token_expiry")
        .eq("user_id", userId)
        .maybeSingle();

      return new Response(JSON.stringify({
        connected: !!data && !error,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 5: Disconnect
    if (action === "disconnect") {
      await supabase
        .from("google_calendar_tokens")
        .delete()
        .eq("user_id", userId);

      return new Response(JSON.stringify({ disconnected: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Calendar sync error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
