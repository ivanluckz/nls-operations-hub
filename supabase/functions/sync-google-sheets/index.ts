// Sync workouts or co-curricular activity allocations to Google Sheets.
// Triggered manually by admins or via realtime DB-change webhook from the client.
//
// Body: { kind: "workouts" | "activities", spreadsheetId?: string }
// If spreadsheetId is omitted, the function reads it from public.integration_settings.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

function gatewayHeaders() {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GS_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  if (!GS_KEY) throw new Error("GOOGLE_SHEETS_API_KEY is not configured");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GS_KEY,
    "Content-Type": "application/json",
  };
}

async function gsClear(spreadsheetId: string, range: string) {
  const r = await fetch(
    `${GATEWAY}/spreadsheets/${spreadsheetId}/values/${range}:clear`,
    { method: "POST", headers: gatewayHeaders() }
  );
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Sheets clear failed [${r.status}]: ${t}`);
  }
}

async function gsWrite(spreadsheetId: string, range: string, values: any[][]) {
  const r = await fetch(
    `${GATEWAY}/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: gatewayHeaders(),
      body: JSON.stringify({ values }),
    }
  );
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Sheets write failed [${r.status}]: ${t}`);
  }
}

async function buildWorkoutRows(svc: any): Promise<any[][]> {
  const [{ data: workouts }, { data: signups }, { data: wt }, { data: profiles }] =
    await Promise.all([
      svc.from("workouts").select("id,name,days_of_week,capacity,is_active").limit(1000),
      svc.from("workout_signups").select("workout_id,student_id,created_at").limit(5000),
      svc.from("workout_teachers").select("workout_id,teacher_id").limit(2000),
      svc.from("profiles").select("id,full_name,email").limit(5000),
    ]);

  const pMap = new Map((profiles || []).map((p: any) => [p.id, p]));
  const wMap = new Map((workouts || []).map((w: any) => [w.id, w]));
  const tByW = new Map<string, string[]>();
  (wt || []).forEach((row: any) => {
    const t = pMap.get(row.teacher_id);
    if (!t) return;
    const arr = tByW.get(row.workout_id) || [];
    arr.push(t.full_name);
    tByW.set(row.workout_id, arr);
  });

  const header = [
    "Student Name", "Email", "Workout", "Days", "Teachers", "Capacity", "Status", "Enrolled On",
  ];
  const rows: any[][] = [header];
  (signups || [])
    .map((s: any) => {
      const w: any = wMap.get(s.workout_id);
      const stu: any = pMap.get(s.student_id);
      return { s, w, stu };
    })
    .sort((a: any, b: any) =>
      (a.stu?.full_name || "").localeCompare(b.stu?.full_name || "")
    )
    .forEach(({ s, w, stu }: any) => {
      rows.push([
        stu?.full_name || "Unknown",
        stu?.email || "—",
        w?.name || "—",
        (w?.days_of_week || []).join(", "),
        (tByW.get(s.workout_id) || []).join("; ") || "—",
        w?.capacity ?? "",
        w?.is_active ? "Active" : "Inactive",
        s.created_at ? new Date(s.created_at).toISOString().split("T")[0] : "",
      ]);
    });

  rows.push([]);
  rows.push([`Last synced: ${new Date().toISOString()}`]);
  return rows;
}

async function buildActivityRows(svc: any): Promise<any[][]> {
  const [{ data: activities }, { data: allocs }, { data: profiles }] =
    await Promise.all([
      svc.from("activities").select("id,title,category,capacity,teacher_in_charge,days_of_week").limit(1000),
      svc.from("allocations").select("activity_id,student_id,day_of_week,slot_number,created_at").limit(5000),
      svc.from("profiles").select("id,full_name,email").limit(5000),
    ]);

  const pMap = new Map((profiles || []).map((p: any) => [p.id, p]));
  const aMap = new Map((activities || []).map((a: any) => [a.id, a]));

  const header = [
    "Student Name", "Email", "Activity", "Category", "Day", "Slot",
    "Teacher in Charge", "Capacity", "Allocated On",
  ];
  const rows: any[][] = [header];
  (allocs || [])
    .map((al: any) => ({ al, a: aMap.get(al.activity_id), stu: pMap.get(al.student_id) }))
    .sort((x: any, y: any) =>
      (x.stu?.full_name || "").localeCompare(y.stu?.full_name || "")
    )
    .forEach(({ al, a, stu }: any) => {
      rows.push([
        stu?.full_name || "Unknown",
        stu?.email || "—",
        a?.title || "—",
        a?.category || "—",
        al.day_of_week || "—",
        al.slot_number ?? "",
        a?.teacher_in_charge || "—",
        a?.capacity ?? "",
        al.created_at ? new Date(al.created_at).toISOString().split("T")[0] : "",
      ]);
    });

  rows.push([]);
  rows.push([`Last synced: ${new Date().toISOString()}`]);
  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: require an admin/moderator user
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await svc
      .from("user_roles").select("role").eq("user_id", userRes.user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin" || r.role === "moderator");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const kind = body?.kind as "workouts" | "activities";
    if (kind !== "workouts" && kind !== "activities") {
      return new Response(JSON.stringify({ error: "kind must be 'workouts' or 'activities'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let spreadsheetId = (body?.spreadsheetId as string) || "";
    if (!spreadsheetId) {
      const settingKey = kind === "workouts" ? "gsheet_workouts_id" : "gsheet_activities_id";
      const { data: setting } = await svc
        .from("integration_settings").select("value").eq("key", settingKey).maybeSingle();
      spreadsheetId = setting?.value || "";
    }
    if (!spreadsheetId) {
      return new Response(JSON.stringify({ error: `No spreadsheet configured for ${kind}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = kind === "workouts"
      ? await buildWorkoutRows(svc)
      : await buildActivityRows(svc);

    const range = "Sheet1!A1:Z10000";
    await gsClear(spreadsheetId, range);
    await gsWrite(spreadsheetId, "Sheet1!A1", rows);

    return new Response(
      JSON.stringify({ success: true, kind, rows: rows.length, spreadsheetId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-google-sheets error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
