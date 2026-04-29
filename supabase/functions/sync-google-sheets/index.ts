// Sync workouts or co-curricular activity allocations to Google Sheets.
// Creates one sheet per workout/activity + summary sheets for absent/not-attending
//
// Body: { kind: "workouts" | "activities", spreadsheetId?: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const API_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");

async function gsRequest(method: string, endpoint: string, body?: any) {
  const url = `https://sheets.googleapis.com/v4/${endpoint}`;
  const opts: any = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const r = await fetch(url, opts);
  const data = await r.json();
  if (!r.ok) {
    console.error("[gsheets] Request failed:", { status: r.status, data });
    throw new Error(`Google Sheets API error: ${data.error?.message || "Unknown error"}`);
  }
  return data;
}

async function createOrClearSheet(spreadsheetId: string, title: string): Promise<number> {
  // Get all sheets
  const sheet = await gsRequest("GET", `spreadsheets/${spreadsheetId}`);
  const existing = sheet.sheets?.find((s: any) => s.properties.title === title);

  if (existing) {
    // Clear the sheet
    const sheetId = existing.properties.sheetId;
    await gsRequest("POST", `spreadsheets/${spreadsheetId}:batchUpdate`, {
      requests: [
        {
          deleteRange: {
            range: { sheetId, dimension: "ROWS", startIndex: 0 },
          },
        },
      ],
    });
    return sheetId;
  }

  // Create new sheet
  const resp = await gsRequest("POST", `spreadsheets/${spreadsheetId}:batchUpdate`, {
    requests: [
      {
        addSheet: { properties: { title } },
      },
    ],
  });
  return resp.replies[0].addSheet.properties.sheetId;
}

async function writeToSheet(
  spreadsheetId: string,
  sheetId: number,
  values: any[][]
) {
  const range = { sheetId, dimension: "ROWS", startIndex: 0 };
  await gsRequest("POST", `spreadsheets/${spreadsheetId}:batchUpdate`, {
    requests: [
      {
        updateCells: {
          range,
          rows: values.map((row) => ({
            values: row.map((v) => ({
              userEnteredValue: { stringValue: String(v ?? "") },
            })),
          })),
          fields: "userEnteredValue",
        },
      },
    ],
  });
}

async function syncWorkoutSheets(svc: any, spreadsheetId: string) {
  const [{ data: workouts }, { data: signups }, { data: wt }, { data: absences }, { data: profiles }] =
    await Promise.all([
      svc.from("workouts").select("id,name,days_of_week,capacity,is_active").limit(1000),
      svc.from("workout_signups").select("workout_id,student_id,created_at").limit(5000),
      svc.from("workout_teachers").select("workout_id,teacher_id").limit(2000),
      svc.from("workout_attendance").select("student_id,status").eq("status", "absent").gte("workout_date", new Date().toISOString().split("T")[0]),
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

  const absentIds = new Set((absences || []).map((a: any) => a.student_id));

  // Summary sheet
  const summaryRows = [
    ["MORNING WORKOUTS — SYNC SUMMARY"],
    ["Last synced", new Date().toLocaleString()],
    [],
    ["Total Workouts", workouts?.length || 0],
    ["Total Enrolled", signups?.length || 0],
    ["Absent Today", absentIds.size],
  ];
  const summarySheetId = await createOrClearSheet(spreadsheetId, "Summary");
  await writeToSheet(spreadsheetId, summarySheetId, summaryRows);

  // One sheet per workout
  for (const w of workouts || []) {
    const workoutSignups = (signups || []).filter((s: any) => s.workout_id === w.id);
    const rows: any[][] = [
      [`${w.name} (${workoutSignups.length}/${w.capacity})`],
      ["Days", (w.days_of_week || []).join(", ")],
      ["Teachers", (tByW.get(w.id) || []).join("; ") || "—"],
      ["Status", w.is_active ? "Active" : "Inactive"],
      [],
      ["Student Name", "Email", "Enrolled On"],
    ];

    workoutSignups
      .map((s: any) => ({
        s,
        stu: pMap.get(s.student_id),
      }))
      .sort((a: any, b: any) => (a.stu?.full_name || "").localeCompare(b.stu?.full_name || ""))
      .forEach(({ s, stu }: any) => {
        rows.push([
          stu?.full_name || "Unknown",
          stu?.email || "—",
          s.created_at ? new Date(s.created_at).toISOString().split("T")[0] : "",
        ]);
      });

    const sheetId = await createOrClearSheet(spreadsheetId, w.name);
    await writeToSheet(spreadsheetId, sheetId, rows);
  }

  // Absent sheet
  if (absentIds.size > 0) {
    const absentRows: any[][] = [
      ["ABSENT TODAY"],
      [],
      ["Student Name", "Email"],
    ];
    const absentProfiles = Array.from(absentIds)
      .map((id) => pMap.get(id))
      .filter(Boolean)
      .sort((a: any, b: any) => (a?.full_name || "").localeCompare(b?.full_name || ""));

    absentProfiles.forEach((p: any) => {
      absentRows.push([p?.full_name || "Unknown", p?.email || "—"]);
    });

    const absentSheetId = await createOrClearSheet(spreadsheetId, "Absent Today");
    await writeToSheet(spreadsheetId, absentSheetId, absentRows);
  }

  return {
    summarySheet: "Summary",
    workoutSheets: (workouts || []).map((w: any) => w.name),
    absentSheet: absentIds.size > 0 ? "Absent Today" : null,
    totalRows: (signups || []).length,
  };
}

async function syncActivitySheets(svc: any, spreadsheetId: string) {
  const [{ data: activities }, { data: allocs }, { data: absences }, { data: profiles }] =
    await Promise.all([
      svc.from("activities").select("id,title,category,capacity,teacher_in_charge,days_of_week").limit(1000),
      svc.from("allocations").select("activity_id,student_id,day_of_week,slot_number,created_at").limit(5000),
      svc.from("activity_attendance").select("student_id,status").eq("status", "absent").gte("activity_date", new Date().toISOString().split("T")[0]),
      svc.from("profiles").select("id,full_name,email").limit(5000),
    ]);

  const pMap = new Map((profiles || []).map((p: any) => [p.id, p]));
  const aMap = new Map((activities || []).map((a: any) => [a.id, a]));
  const absentIds = new Set((absences || []).map((a: any) => a.student_id));

  // Summary sheet
  const summaryRows = [
    ["CO-CURRICULAR ACTIVITIES — SYNC SUMMARY"],
    ["Last synced", new Date().toLocaleString()],
    [],
    ["Total Activities", activities?.length || 0],
    ["Total Allocated", allocs?.length || 0],
    ["Not Attending", absentIds.size],
  ];
  const summarySheetId = await createOrClearSheet(spreadsheetId, "Summary");
  await writeToSheet(spreadsheetId, summarySheetId, summaryRows);

  // One sheet per activity
  for (const a of activities || []) {
    const activityAllocs = (allocs || []).filter((al: any) => al.activity_id === a.id);
    const rows: any[][] = [
      [`${a.title} (${activityAllocs.length}/${a.capacity})`],
      ["Category", a.category || "—"],
      ["Days", (a.days_of_week || []).join(", ")],
      ["Teacher in Charge", a.teacher_in_charge || "—"],
      [],
      ["Student Name", "Email", "Day", "Slot", "Allocated On"],
    ];

    activityAllocs
      .map((al: any) => ({
        al,
        stu: pMap.get(al.student_id),
      }))
      .sort((a: any, b: any) => (a.stu?.full_name || "").localeCompare(b.stu?.full_name || ""))
      .forEach(({ al, stu }: any) => {
        rows.push([
          stu?.full_name || "Unknown",
          stu?.email || "—",
          al.day_of_week || "—",
          al.slot_number ?? "",
          al.created_at ? new Date(al.created_at).toISOString().split("T")[0] : "",
        ]);
      });

    const sheetId = await createOrClearSheet(spreadsheetId, a.title);
    await writeToSheet(spreadsheetId, sheetId, rows);
  }

  // Not attending sheet
  if (absentIds.size > 0) {
    const notAttendingRows: any[][] = [
      ["NOT ATTENDING"],
      [],
      ["Student Name", "Email"],
    ];
    const notAttendingProfiles = Array.from(absentIds)
      .map((id) => pMap.get(id))
      .filter(Boolean)
      .sort((a: any, b: any) => (a?.full_name || "").localeCompare(b?.full_name || ""));

    notAttendingProfiles.forEach((p: any) => {
      notAttendingRows.push([p?.full_name || "Unknown", p?.email || "—"]);
    });

    const notAttendingSheetId = await createOrClearSheet(spreadsheetId, "Not Attending");
    await writeToSheet(spreadsheetId, notAttendingSheetId, notAttendingRows);
  }

  return {
    summarySheet: "Summary",
    activitySheets: (activities || []).map((a: any) => a.title),
    notAttendingSheet: absentIds.size > 0 ? "Not Attending" : null,
    totalRows: (allocs || []).length,
  };
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

    const result = kind === "workouts"
      ? await syncWorkoutSheets(svc, spreadsheetId)
      : await syncActivitySheets(svc, spreadsheetId);

    return new Response(
      JSON.stringify({ success: true, kind, ...result, spreadsheetId }),
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
