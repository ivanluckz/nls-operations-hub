import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GOOGLE_CLIENT_ID = Deno.env.get("Google_client_id")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("Google_client_secret")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
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

      const { userId: stateUserId, redirectUri } = JSON.parse(atob(stateParam));

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

      const { error: upsertError } = await serviceClient
        .from("google_calendar_tokens")
        .upsert({
          user_id: stateUserId,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
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

      // Refresh token if expired
      let accessToken = tokenRow.access_token;
      if (new Date(tokenRow.token_expiry) <= new Date()) {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: tokenRow.refresh_token,
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

        await supabase
          .from("google_calendar_tokens")
          .update({ access_token: accessToken, token_expiry: newExpiry })
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
