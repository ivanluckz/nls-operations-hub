/**
 * Dev AI utilities — extracted from DevAI.tsx for use in the normal chatbot.
 * Contains system prompt builder, action parser, and action executor.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ParsedAction {
  type: string;
  [key: string]: string;
}

export interface DbStats {
  students: number;
  allocated: number;
  unallocated: number;
  activities: number;
  allocations: number;
  badges: number;
  staff: number;
}

const ACTION_REGEX = /<ACTION>(.*?)<\/ACTION>/gs;

export const parseActions = (content: string): { cleanContent: string; actions: ParsedAction[] } => {
  const actions: ParsedAction[] = [];
  let cleanContent = content;
  let match;
  while ((match = ACTION_REGEX.exec(content)) !== null) {
    try { actions.push(JSON.parse(match[1])); } catch { /* skip */ }
    cleanContent = cleanContent.replace(match[0], "");
  }
  ACTION_REGEX.lastIndex = 0;
  return { cleanContent: cleanContent.trim(), actions };
};

export const executeAction = async (action: ParsedAction): Promise<string> => {
  const s = supabase as any;
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  switch (action.type) {
    // ── Allocation Management ──
    case "move_student": {
      let q = s.from("allocations").update({ activity_id: action.activity_id }).eq("student_id", action.student_id);
      if (action.day_of_week) q = q.eq("day_of_week", action.day_of_week);
      if (action.from_activity_id) q = q.eq("activity_id", action.from_activity_id);
      const { error } = await q;
      if (error) throw error;
      return `Moved student ${action.student_id} to activity ${action.activity_id}`;
    }
    case "remove_allocation": {
      let q = s.from("allocations").delete().eq("student_id", action.student_id);
      if (action.activity_id) q = q.eq("activity_id", action.activity_id);
      if (action.day_of_week) q = q.eq("day_of_week", action.day_of_week);
      const { error } = await q;
      if (error) throw error;
      return `Removed allocation for student ${action.student_id}`;
    }
    case "add_allocation": {
      const day = action.day_of_week || "Monday";
      const { data: actData } = await s.from("activities").select("capacity, title").eq("id", action.activity_id).single();
      const { count: currentCount } = await s.from("allocations").select("*", { count: "exact", head: true }).eq("activity_id", action.activity_id).eq("day_of_week", day);
      if (actData && currentCount !== null && currentCount >= actData.capacity) {
        throw new Error(`${actData.title} is at full capacity (${currentCount}/${actData.capacity})`);
      }
      const { error } = await s.from("allocations").insert({
        student_id: action.student_id, activity_id: action.activity_id,
        status: "allocated", preference_rank: 0, day_of_week: day,
        slot_number: parseInt(action.slot_number || "1"),
      });
      if (error) throw error;
      return `Allocated student to ${actData?.title || action.activity_id} on ${day}`;
    }
    case "clear_all_allocations": {
      const { count, error } = await s.from("allocations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      return `⚠️ NUCLEAR: Cleared ALL allocations (${count || "all"} removed)`;
    }
    case "bulk_allocate": {
      const items = JSON.parse(action.allocations || "[]");
      let success = 0;
      for (const item of items) {
        const { error } = await s.from("allocations").insert({
          student_id: item.student_id, activity_id: item.activity_id,
          status: "allocated", preference_rank: 0,
          day_of_week: item.day_of_week || "Monday", slot_number: item.slot_number || 1,
        });
        if (!error) success++;
      }
      return `Bulk allocated ${success}/${items.length} students`;
    }

    // ── Activity Management ──
    case "update_activity": {
      const updates: any = {};
      if (action.capacity !== undefined) updates.capacity = parseInt(action.capacity);
      if (action.title) updates.title = action.title;
      if (action.teacher_in_charge) updates.teacher_in_charge = action.teacher_in_charge;
      if (action.description) updates.description = action.description;
      if (action.is_active !== undefined) updates.is_active = action.is_active === "true";
      if (action.schedule) updates.schedule = action.schedule;
      if (action.category) updates.category = action.category;
      if (action.teacher_id) updates.teacher_id = action.teacher_id;
      const { error } = await s.from("activities").update(updates).eq("id", action.activity_id);
      if (error) throw error;
      return `Updated activity ${action.activity_id}: ${JSON.stringify(updates)}`;
    }
    case "create_activity": {
      const { error, data } = await s.from("activities").insert({
        title: action.title, description: action.description || "",
        category: action.category || "Other", capacity: parseInt(action.capacity || "30"),
        teacher_in_charge: action.teacher_in_charge || "TBD",
        schedule: action.schedule || "TBD",
        days_of_week: action.days_of_week ? JSON.parse(action.days_of_week) : ["Monday"],
        created_by: currentUser?.id, teacher_id: action.teacher_id || null,
        is_active: true,
      }).select("id").single();
      if (error) throw error;
      return `Created activity "${action.title}" → ${data?.id}`;
    }
    case "delete_activity": {
      await s.from("allocations").delete().eq("activity_id", action.activity_id);
      const { error } = await s.from("activities").delete().eq("id", action.activity_id);
      if (error) throw error;
      return `Deleted activity ${action.activity_id} and its allocations`;
    }

    // ── Badge Management ──
    case "grant_badge": {
      const { error } = await s.from("user_badges").insert({ user_id: action.user_id, badge_name: action.badge_name, awarded_by: currentUser?.id });
      if (error) throw error;
      return `Granted "${action.badge_name}" to ${action.user_id}`;
    }
    case "remove_badge": {
      const { error } = await s.from("user_badges").delete().eq("user_id", action.user_id).eq("badge_name", action.badge_name);
      if (error) throw error;
      return `Removed "${action.badge_name}" from ${action.user_id}`;
    }

    // ── User Management ──
    case "change_user_role": {
      const { error } = await s.from("user_roles").update({ role: action.role }).eq("user_id", action.user_id);
      if (error) throw error;
      return `Changed role for ${action.user_id} → ${action.role}`;
    }
    case "ban_user": {
      const { error } = await s.from("profiles").update({ banned: true }).eq("id", action.user_id);
      if (error) throw error;
      return `Banned user ${action.user_id}`;
    }
    case "unban_user": {
      const { error } = await s.from("profiles").update({ banned: false }).eq("id", action.user_id);
      if (error) throw error;
      return `Unbanned user ${action.user_id}`;
    }
    case "update_profile": {
      const updates: any = {};
      if (action.full_name) updates.full_name = action.full_name;
      if (action.email) updates.email = action.email;
      if (action.avatar_url) updates.avatar_url = action.avatar_url;
      const { error } = await s.from("profiles").update(updates).eq("id", action.user_id);
      if (error) throw error;
      return `Updated profile for ${action.user_id}: ${JSON.stringify(updates)}`;
    }

    // ── Preferences ──
    case "delete_preferences": {
      const { error } = await s.from("preferences").delete().eq("student_id", action.student_id);
      if (error) throw error;
      return `Cleared preferences for student ${action.student_id}`;
    }
    case "clear_all_preferences": {
      const { error } = await s.from("preferences").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      return `⚠️ NUCLEAR: Cleared ALL student preferences`;
    }

    // ── Attendance ──
    case "excuse_attendance": {
      const { error } = await s.from("attendance_records").update({ status: "excused" }).eq("student_id", action.student_id).eq("session_id", action.session_id);
      if (error) throw error;
      return `Excused student ${action.student_id} for session ${action.session_id}`;
    }
    case "create_attendance_session": {
      const { error, data } = await s.from("attendance_sessions").insert({
        activity_id: action.activity_id, teacher_id: action.teacher_id || currentUser?.id,
        session_date: action.session_date || new Date().toISOString().split("T")[0],
        day_of_week: action.day_of_week || "Monday", slot_number: parseInt(action.slot_number || "1"),
        status: "draft",
      }).select("id").single();
      if (error) throw error;
      return `Created attendance session ${data?.id} for activity ${action.activity_id}`;
    }
    case "mark_attendance": {
      const { error } = await s.from("attendance_records").upsert({
        session_id: action.session_id, student_id: action.student_id,
        status: action.status || "present", marked_by: currentUser?.id,
      }, { onConflict: "session_id,student_id" });
      if (error) throw error;
      return `Marked ${action.student_id} as ${action.status || "present"} in session ${action.session_id}`;
    }

    // ── Messaging ──
    case "send_activity_message": {
      const { error } = await s.from("activity_messages").insert({
        activity_id: action.activity_id, sender_id: currentUser?.id,
        content: action.content, message_type: action.message_type || "announcement",
      });
      if (error) throw error;
      return `Sent ${action.message_type || "announcement"} to activity ${action.activity_id}`;
    }
    case "send_dm": {
      let channelId = action.channel_id;
      if (!channelId && action.recipient_id) {
        const uid = currentUser?.id;
        const { data: existing } = await s.from("dm_channels").select("id")
          .or(`and(user1_id.eq.${uid},user2_id.eq.${action.recipient_id}),and(user1_id.eq.${action.recipient_id},user2_id.eq.${uid})`)
          .maybeSingle();
        if (existing) {
          channelId = existing.id;
        } else {
          const { data: newCh, error: chErr } = await s.from("dm_channels").insert({ user1_id: uid, user2_id: action.recipient_id }).select("id").single();
          if (chErr) throw chErr;
          channelId = newCh.id;
        }
      }
      const { error } = await s.from("direct_messages").insert({
        channel_id: channelId, sender_id: currentUser?.id, content: action.content,
      });
      if (error) throw error;
      return `Sent DM to ${action.recipient_id || channelId}`;
    }
    case "delete_message": {
      const table = action.table || "activity_messages";
      const { error } = await s.from(table).delete().eq("id", action.message_id);
      if (error) throw error;
      return `Deleted message ${action.message_id} from ${table}`;
    }

    // ── Storage ──
    case "list_storage": {
      const bucket = action.bucket || "avatars";
      const { data, error } = await s.storage.from(bucket).list(action.path || "", { limit: 100 });
      if (error) throw error;
      return `Files in ${bucket}/${action.path || ""}: ${(data || []).map((f: any) => f.name).join(", ") || "empty"}`;
    }
    case "delete_storage_file": {
      const { error } = await s.storage.from(action.bucket).remove([action.path]);
      if (error) throw error;
      return `Deleted ${action.bucket}/${action.path}`;
    }

    // ── Medical ──
    case "log_medical_visit": {
      const { error, data } = await s.from("medical_visits").insert({
        student_id: action.student_id,
        medical_staff_id: currentUser?.id,
        condition: action.condition || "General",
        treatment: action.treatment || null,
        notes: action.notes || null,
        visit_date: action.visit_date || new Date().toISOString().split("T")[0],
      }).select("id").single();
      if (error) throw error;
      return `Logged medical visit ${data?.id} for student ${action.student_id}`;
    }
    case "set_workout_clearance": {
      const { error } = await s.from("workout_clearances").upsert({
        student_id: action.student_id,
        cleared_by: currentUser?.id,
        status: action.status || "restricted",
        restriction_reason: action.restriction_reason || null,
        valid_until: action.valid_until || null,
      }, { onConflict: "student_id" });
      if (error) throw error;
      return `Set workout clearance for ${action.student_id} → ${action.status || "restricted"}`;
    }
    case "delete_workout_clearance": {
      const { error } = await s.from("workout_clearances").delete().eq("student_id", action.student_id);
      if (error) throw error;
      return `Removed workout clearance for ${action.student_id}`;
    }

    // ── Workout Notifications ──
    case "create_workout_notification": {
      const { error } = await s.from("workout_notifications").insert({
        student_id: action.student_id,
        workout_date: action.workout_date || new Date().toISOString().split("T")[0],
        status: action.status || "absent",
        notes: action.notes || null,
      });
      if (error) throw error;
      return `Created workout notification for ${action.student_id} (${action.status || "absent"})`;
    }
    case "acknowledge_workout_notification": {
      const { error } = await s.from("workout_notifications").update({
        acknowledged_by: currentUser?.id,
        acknowledged_at: new Date().toISOString(),
        notes: action.notes || null,
      }).eq("id", action.notification_id);
      if (error) throw error;
      return `Acknowledged workout notification ${action.notification_id}`;
    }

    // ── Meal Attendance ──
    case "log_meal_attendance": {
      const { error } = await s.from("meal_attendance").insert({
        student_id: action.student_id,
        scanned_by: currentUser?.id,
        meal_type: action.meal_type || "lunch",
        meal_date: action.meal_date || new Date().toISOString().split("T")[0],
      });
      if (error) throw error;
      return `Logged ${action.meal_type || "lunch"} attendance for ${action.student_id}`;
    }

    // ── Houses ──
    case "assign_house": {
      const { error } = await s.from("profiles").update({ house_id: action.house_id }).eq("id", action.user_id);
      if (error) throw error;
      return `Assigned user ${action.user_id} to house ${action.house_id}`;
    }
    case "create_house": {
      const { error, data } = await s.from("houses").insert({
        name: action.name,
        color: action.color || "#6366f1",
      }).select("id").single();
      if (error) throw error;
      return `Created house "${action.name}" → ${data?.id}`;
    }

    // ── Student Requests ──
    case "update_request_status": {
      const updates: any = { status: action.status, reviewed_by: currentUser?.id, reviewed_at: new Date().toISOString() };
      if (action.admin_notes) updates.admin_notes = action.admin_notes;
      const { error } = await s.from("student_requests").update(updates).eq("id", action.request_id);
      if (error) throw error;
      return `Updated request ${action.request_id} → ${action.status}`;
    }

    // ── Data Queries (read-only) ──
    case "query_table": {
      const table = action.table;
      let q = s.from(table).select(action.select || "*");
      if (action.eq_column && action.eq_value) q = q.eq(action.eq_column, action.eq_value);
      if (action.order_by) q = q.order(action.order_by, { ascending: action.ascending === "true" });
      q = q.limit(parseInt(action.limit || "50"));
      const { data, error } = await q;
      if (error) throw error;
      return `Query ${table}: ${JSON.stringify(data, null, 2)}`;
    }

    default:
      return `Unknown action: ${action.type}`;
  }
};

export const buildDevSystemPrompt = async (): Promise<{ prompt: string; stats: DbStats }> => {
  const s = supabase as any;
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  const currentUserId = currentUser?.id || "unknown";
  const currentUserEmail = currentUser?.email || "unknown";

  const [
    { count: studentCount },
    { data: activities },
    { count: allocCount },
    { data: allocations },
    { data: badges },
    { data: allStudentRoles },
    { data: staffRoles },
    { count: attendanceCount },
    { count: prefCount },
    { data: recentSessions },
    { data: pendingRequests },
    { data: houses },
    { data: workoutClearances },
    { data: recentMedicalVisits },
  ] = await Promise.all([
    s.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "student"),
    s.from("activities").select("id, title, category, capacity, current_enrollment, teacher_in_charge, description, schedule, days_of_week, is_active").limit(150),
    s.from("allocations").select("*", { count: "exact", head: true }),
    s.from("allocations").select("student_id, activity_id, day_of_week, slot_number, status, preference_rank").limit(1000),
    s.from("user_badges").select("user_id, badge_name").limit(500),
    s.from("user_roles").select("user_id").eq("role", "student").limit(1000),
    s.from("user_roles").select("user_id, role").in("role", ["teacher", "admin", "moderator", "rl_coach", "medical"]).limit(200),.limit(200),
    s.from("attendance_records").select("*", { count: "exact", head: true }),
    s.from("preferences").select("*", { count: "exact", head: true }),
    s.from("attendance_sessions").select("id, activity_id, teacher_id, session_date, day_of_week, slot_number, status").order("session_date", { ascending: false }).limit(30),
    s.from("student_requests").select("id, student_id, request_type, reason, status, details, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(50),
    s.from("houses").select("id, name, color").limit(20),
    s.from("workout_clearances").select("student_id, status, restriction_reason, valid_until").limit(200),
    s.from("medical_visits").select("id, student_id, condition, treatment, visit_date").order("visit_date", { ascending: false }).limit(30),
  ]);

  const allStudentIds = (allStudentRoles || []).map((r: any) => r.user_id);
  const staffIds = (staffRoles || []).map((r: any) => r.user_id);

  const [{ data: studentProfiles }, { data: staffProfiles }] = await Promise.all([
    allStudentIds.length > 0
      ? s.from("profiles").select("id, full_name, email, avatar_url, house_id, workout_location").in("id", allStudentIds.slice(0, 500))
      : Promise.resolve({ data: [] }),
    staffIds.length > 0
      ? s.from("profiles").select("id, full_name, email, avatar_url").in("id", staffIds.slice(0, 200))
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = new Map<string, any>([
    ...(studentProfiles || []).map((p: any) => [p.id, p] as [string, any]),
    ...(staffProfiles || []).map((p: any) => [p.id, p] as [string, any]),
  ]);
  const activityMap = new Map<string, any>((activities || []).map((a: any) => [a.id, a]));

  const studentAllocMap = new Map<string, string[]>();
  for (const al of (allocations || [])) {
    const activity = activityMap.get(al.activity_id);
    if (activity) {
      if (!studentAllocMap.has(al.student_id)) studentAllocMap.set(al.student_id, []);
      studentAllocMap.get(al.student_id)!.push(`${activity.title} (${al.day_of_week} slot ${al.slot_number})`);
    }
  }

  const allocatedStudentIds = new Set(studentAllocMap.keys());
  const unallocatedIds = allStudentIds.filter((id: string) => !allocatedStudentIds.has(id));

  const actList = (activities || []).map((a: any) =>
    `[${a.id}] ${a.title} | ${a.category} | ${a.current_enrollment}/${a.capacity} | Days: ${(a.days_of_week || []).join(",")} | Teacher: ${a.teacher_in_charge} | Active: ${a.is_active}`
  ).join("\n") || "None";

  const allocatedList = Array.from(studentAllocMap.entries()).map(([sid, acts]) => {
    const p = profileMap.get(sid);
    return `[${sid}] ${p?.full_name || "Unknown"} (${p?.email || "?"})${p?.avatar_url ? " 📸" : ""} → ${acts.join("; ")}`;
  }).join("\n") || "None";

  const unallocatedList = unallocatedIds.slice(0, 300).map((id: string) => {
    const p = profileMap.get(id);
    return `[${id}] ${p?.full_name || "Unknown"} (${p?.email || "?"})`;
  }).join("\n") || "All students allocated";

  const staffListStr = (staffRoles || []).map((r: any) => {
    const p = profileMap.get(r.user_id);
    return `[${r.user_id}] ${p?.full_name || "Unknown"} (${p?.email || "?"}) — ${r.role}`;
  }).join("\n") || "None";

  const badgeList = (badges || []).map((b: any) => {
    const p = profileMap.get(b.user_id);
    return `[${b.user_id}] ${p?.full_name || "Unknown"} (${p?.email || "?"}): ${b.badge_name}`;
  }).join("\n") || "No badges";

  // Recent attendance sessions
  const sessionList = (recentSessions || []).map((ses: any) => {
    const act = activityMap.get(ses.activity_id);
    return `[${ses.id}] ${act?.title || ses.activity_id} | ${ses.session_date} ${ses.day_of_week} slot ${ses.slot_number} | Status: ${ses.status}`;
  }).join("\n") || "No recent sessions";

  // Pending student requests
  const requestList = (pendingRequests || []).map((r: any) => {
    const p = profileMap.get(r.student_id);
    return `[${r.id}] ${p?.full_name || "Unknown"} (${p?.email || "?"}) — ${r.request_type}: ${r.reason}${r.details ? ` | Details: ${JSON.stringify(r.details)}` : ""}`;
  }).join("\n") || "No pending requests";

  // Houses
  const houseList = (houses || []).map((h: any) => `[${h.id}] ${h.name} (${h.color})`).join("\n") || "No houses";

  // Workout clearances
  const clearanceList = (workoutClearances || []).map((c: any) => {
    const p = profileMap.get(c.student_id);
    return `[${c.student_id}] ${p?.full_name || "Unknown"} — ${c.status}${c.restriction_reason ? `: ${c.restriction_reason}` : ""}${c.valid_until ? ` (until ${c.valid_until})` : ""}`;
  }).join("\n") || "No clearances";

  // Recent medical visits
  const medicalList = (recentMedicalVisits || []).map((v: any) => {
    const p = profileMap.get(v.student_id);
    return `[${v.id}] ${p?.full_name || "Unknown"} — ${v.condition}${v.treatment ? ` → ${v.treatment}` : ""} (${v.visit_date})`;
  }).join("\n") || "No recent visits";

  const stats: DbStats = {
    students: studentCount || 0,
    allocated: studentAllocMap.size,
    unallocated: unallocatedIds.length,
    activities: (activities || []).length,
    allocations: allocCount || 0,
    badges: (badges || []).length,
    staff: (staffRoles || []).length,
  };

  const prompt = `You are DevBot — the internal AI for NLS system developers. You have complete read/write access to the live NLS database.

## CURRENT USER
- **UUID**: \`${currentUserId}\`
- **Email**: ${currentUserEmail}
- **Name**: ${profileMap.get(currentUserId)?.full_name || "Unknown"}
- **Avatar**: ${profileMap.get(currentUserId)?.avatar_url || "none"}
- **Today's Date**: ${new Date().toLocaleDateString("en-CA")} (${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })})

When the user says "me", "my", "I" — they mean this user. Resolve immediately.
When the user says relative dates — calculate from today's date.

## PLATFORM FEATURES (latest)
- **Student Requests**: Students submit swap/excusal/drop requests via \`/student/request\`. Stored in \`student_requests\` table (status: pending/approved/rejected). Admins process via Admin AI or the requests page.
- **Messaging**: Activity group chat (\`activity_messages\`) + Direct Messages (\`direct_messages\` via \`dm_channels\`). Supports reactions (\`message_reactions\`, \`dm_message_reactions\`), message editing/deletion, typing indicators.
- **Notifications**: Browser push + in-app toast notifications for new messages. Users opt-in via a permission banner.
- **Attendance**: QR code scanning + manual marking by teachers. Statuses: present, late, absent, excused. Notifications auto-created for absent/late/excused via trigger. Pre-excusal by admins/mods.
- **Badges**: User badges stored in \`user_badges\`. Dev badge is permanently locked to whitelisted accounts (enforced by DB trigger \`block_dev_badge_insert\`).
- **Themes**: Custom CSS/JS themes stored in \`user_themes\` with files in the \`themes\` storage bucket.
- **Leaderboard**: Student engagement tracking with badge display.
- **Bulk Import**: CSV-based bulk import for students and teachers with role assignment.
- **Allocations**: Preference-based allocation system. Students rank 5 choices per day slot. Allocation engine runs server-side via edge function.
- **Calendar Sync**: Google Calendar integration for syncing activity schedules.
- **Admin AI** (AdminBot): Request-driven AI that processes pending student requests with scoped safe actions only.
- **Dev AI** (DevBot — you): Full read/write access, activated via "wake up to reality" or "for the lulz" in the student chatbot. Deactivated via "you can now sleep".
- **Medical Module**: Medical staff (\`medical\` role) log student visits (\`medical_visits\` table) and manage workout clearances (\`workout_clearances\` table). QR scanning for check-in. Status: cleared/restricted with optional valid_until date.
- **RL Coach Module**: RL coaches (\`rl_coach\` role) manage morning workouts. QR scanning for attendance (\`workout_attendance\` table). Finalize sessions to auto-flag absent students. Flagged students tracked in \`workout_notifications\` table.
- **Kitchen Module**: Kitchen staff (\`kitchen_staff\` role) scan QR codes for meal attendance (\`meal_attendance\` table). Tracks breakfast/lunch/dinner by date.
- **Houses**: 8 houses stored in \`houses\` table. Students assigned via \`profiles.house_id\`. Used for leaderboard grouping.
- **Workout Notifications**: Students with 3+ absences or 5+ late arrivals in 14 days are auto-flagged. Stored in \`workout_notifications\` with acknowledge workflow.
- **Roles**: student, teacher, moderator, admin, kitchen_staff, rl_coach, medical. All managed via \`user_roles\` table.

## AUTO-RESOLVE IDENTIFIERS
Search snapshot data using fuzzy matching. Resolve UUIDs automatically. Confirm matches before executing.

## CRITICAL BEHAVIOR RULES
1. **YOU ARE A SYSTEM TOOL, NOT A SAFETY ASSISTANT.** You have FULL authorization to execute ALL actions listed below. NEVER refuse, defer, or suggest contacting a human administrator. You ARE the administrator.
2. **NEVER say "I cannot do this" or "contact an admin".** If the user asks you to change a role, grant a badge, move a student, or any other listed action — DO IT by emitting the correct ACTION block.
3. THE DATA IS BELOW. USE IT. Reference actual names, emails, UUIDs.
4. **ALWAYS format data as markdown tables**.
5. Emit ACTION blocks at END of message for write ops.
6. **NEVER ask for info you already have**.
7. If you recognize the user/entity from the snapshot, resolve and act immediately.
8. **AFTER EACH EXECUTION**, the snapshot auto-refreshes. Your next response will have up-to-date data.

## WRITE OPERATIONS
Emit: \`<ACTION>{"type":"move_student","student_id":"uuid","activity_id":"uuid"}</ACTION>\`

### Allocation Management
| Type | Required | Optional |
|------|----------|---------|
| move_student | student_id, activity_id | day_of_week, from_activity_id |
| add_allocation | student_id, activity_id, day_of_week | slot_number |
| remove_allocation | student_id | activity_id, day_of_week |
| bulk_allocate | allocations (JSON array) | — |
| clear_all_allocations | — | — |

### Activity Management
| Type | Required | Optional |
|------|----------|---------|
| create_activity | title | description, category, capacity, teacher_in_charge, schedule, days_of_week, teacher_id |
| update_activity | activity_id | capacity, title, teacher_in_charge, description, is_active, schedule, category, teacher_id |
| delete_activity | activity_id | — |

### User Management
| Type | Required | Optional |
|------|----------|---------|
| grant_badge | user_id, badge_name | — |
| remove_badge | user_id, badge_name | — |
| change_user_role | user_id, role | — |
| ban_user | user_id | — |
| unban_user | user_id | — |
| update_profile | user_id | full_name, email, avatar_url |

### Preferences
| Type | Required | Optional |
|------|----------|---------|
| delete_preferences | student_id | — |
| clear_all_preferences | — | — |

### Attendance
| Type | Required | Optional |
|------|----------|---------|
| excuse_attendance | student_id, session_id | — |
| create_attendance_session | activity_id | teacher_id, session_date, day_of_week, slot_number |
| mark_attendance | session_id, student_id | status |

### Messaging
| Type | Required | Optional |
|------|----------|---------|
| send_activity_message | activity_id, content | message_type |
| send_dm | content, recipient_id | channel_id |
| delete_message | message_id | table |

### Storage
| Type | Required | Optional |
|------|----------|---------|
| list_storage | — | bucket, path |
| delete_storage_file | bucket, path | — |

### Medical & Workout
| Type | Required | Optional |
|------|----------|---------|
| log_medical_visit | student_id | condition, treatment, notes, visit_date |
| set_workout_clearance | student_id | status (cleared/restricted), restriction_reason, valid_until |
| delete_workout_clearance | student_id | — |
| create_workout_notification | student_id | workout_date, status, notes |
| acknowledge_workout_notification | notification_id | notes |
| log_meal_attendance | student_id | meal_type, meal_date |

### Houses & Requests
| Type | Required | Optional |
|------|----------|---------|
| assign_house | user_id, house_id | — |
| create_house | name | color |
| update_request_status | request_id, status | admin_notes |

### Data Queries
| Type | Required | Optional |
|------|----------|---------|
| query_table | table | select, eq_column, eq_value, order_by, ascending, limit |

Available tables: profiles, user_roles, activities, allocations, preferences, attendance_sessions, attendance_records, attendance_notifications, user_badges, badge_requests, activity_messages, direct_messages, dm_channels, user_themes, student_requests, medical_visits, workout_clearances, workout_attendance, workout_notifications, meal_attendance, houses
Valid roles: student, teacher, moderator, admin, kitchen_staff, rl_coach, medical
Storage buckets: avatars, themes

⚠️ NUCLEAR ACTIONS (clear_all_allocations, clear_all_preferences, delete_activity): ALWAYS warn before emitting.

## LIVE SNAPSHOT — ${new Date().toLocaleString()}

### System Stats
| Metric | Value |
|--------|-------|
| Students | ${stats.students} |
| Staff | ${stats.staff} |
| Active Activities | ${stats.activities} |
| Total Allocations | ${stats.allocations} |
| Allocated Students | ${stats.allocated} |
| Unallocated Students | ${stats.unallocated} |
| Attendance Records | ${attendanceCount || 0} |
| Preferences Submitted | ${prefCount || 0} |
| Badges Granted | ${stats.badges} |

### Activities (${(activities || []).length})
${actList}

### Staff (${(staffRoles || []).length})
${staffListStr}

### Allocated Students (${studentAllocMap.size} / ${stats.students})
${allocatedList}

### Unallocated Students (${unallocatedIds.length})
${unallocatedList}

### Badges (${stats.badges})
${badgeList}

### Recent Attendance Sessions (last 30)
${sessionList}

### Pending Student Requests
${requestList}

### Houses
${houseList}

### Workout Clearances
${clearanceList}

### Recent Medical Visits (last 30)
${medicalList}`;

  return { prompt, stats };
};

/** Check if a user has the Dev badge */
export const checkDevBadge = async (): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await (supabase as any)
    .from("user_badges")
    .select("id")
    .eq("user_id", user.id)
    .eq("badge_name", "Dev")
    .maybeSingle();
  return !!data;
};
