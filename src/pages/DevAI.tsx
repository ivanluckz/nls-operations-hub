import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, Terminal, ArrowLeft, RefreshCw, Trash2, Database, Zap } from "lucide-react";
import DevMessageBubble from "@/components/dev/DevMessageBubble";

interface ParsedAction {
  type: string;
  [key: string]: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: ParsedAction[];
}

interface DbStats {
  students: number;
  allocated: number;
  unallocated: number;
  activities: number;
  allocations: number;
  badges: number;
  staff: number;
}

const ACTION_REGEX = /<ACTION>(.*?)<\/ACTION>/gs;

const QUICK_ACTIONS = [
  { label: "db overview", cmd: "Give me a full system stats overview" },
  { label: "unallocated", cmd: "List all students with no allocation in a table" },
  { label: "full roster", cmd: "List all students and their activity assignments" },
  { label: "full spots", cmd: "Show activities at or near full capacity" },
  { label: "all badges", cmd: "List all badges in the system with recipient names" },
  { label: "staff list", cmd: "List all teachers, admins, and moderators" },
  { label: "top activities", cmd: "Top 5 most enrolled activities" },
  { label: "no prefs", cmd: "List students who haven't submitted preferences" },
  { label: "send broadcast", cmd: "Send an announcement to all activity chats saying: 'System maintenance in 1 hour'" },
  { label: "query table", cmd: "Query the attendance_records table, show the 20 most recent records with student names" },
  { label: "storage files", cmd: "List all files in the avatars storage bucket" },
  { label: "class groups", cmd: "List all class groups and their member counts" },
];

const parseActions = (content: string): { cleanContent: string; actions: ParsedAction[] } => {
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

const executeAction = async (action: ParsedAction): Promise<string> => {
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
      // Remove allocations first, then activity
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
    case "send_academic_message": {
      const { error } = await s.from("academic_messages").insert({
        class_group_id: action.class_group_id, sender_id: currentUser?.id,
        content: action.content, message_type: action.message_type || "announcement",
      });
      if (error) throw error;
      return `Sent message to class group ${action.class_group_id}`;
    }
    case "send_dm": {
      // Find or create channel
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

    // ── Academic ──
    case "create_academic_excuse": {
      const { error } = await s.from("academic_excuses").insert({
        student_id: action.student_id, excuse_date: action.excuse_date || new Date().toISOString().split("T")[0],
        created_by: currentUser?.id, reason: action.reason || "", slot_id: action.slot_id || null,
      });
      if (error) throw error;
      return `Excused ${action.student_id} for ${action.excuse_date || "today"}`;
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

    // ── Timetable ──
    case "add_class_group_member": {
      const { error } = await s.from("class_group_members").insert({
        class_group_id: action.class_group_id, student_id: action.student_id,
      });
      if (error) throw error;
      return `Added ${action.student_id} to class group ${action.class_group_id}`;
    }
    case "remove_class_group_member": {
      const { error } = await s.from("class_group_members").delete()
        .eq("class_group_id", action.class_group_id).eq("student_id", action.student_id);
      if (error) throw error;
      return `Removed ${action.student_id} from class group ${action.class_group_id}`;
    }

    default:
      return `Unknown action: ${action.type}`;
  }
};

const buildSystemPrompt = async (): Promise<{ prompt: string; stats: DbStats }> => {
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
  ] = await Promise.all([
    s.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "student"),
    s.from("activities").select("id, title, category, capacity, current_enrollment, teacher_in_charge, description, schedule, days_of_week, is_active").limit(150),
    s.from("allocations").select("*", { count: "exact", head: true }),
    s.from("allocations").select("student_id, activity_id, day_of_week, slot_number, status, preference_rank").limit(1000),
    s.from("user_badges").select("user_id, badge_name").limit(500),
    s.from("user_roles").select("user_id").eq("role", "student").limit(1000),
    s.from("user_roles").select("user_id, role").in("role", ["teacher", "admin", "moderator"]).limit(200),
    s.from("attendance_records").select("*", { count: "exact", head: true }),
    s.from("preferences").select("*", { count: "exact", head: true }),
  ]);

  const allStudentIds = (allStudentRoles || []).map((r: any) => r.user_id);
  const staffIds = (staffRoles || []).map((r: any) => r.user_id);

  const [{ data: studentProfiles }, { data: staffProfiles }] = await Promise.all([
    allStudentIds.length > 0
      ? s.from("profiles").select("id, full_name, email").in("id", allStudentIds.slice(0, 500))
      : Promise.resolve({ data: [] }),
    staffIds.length > 0
      ? s.from("profiles").select("id, full_name, email").in("id", staffIds.slice(0, 200))
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

  const actHeader = "| Title | Category | Enrolled | Capacity | Days | Teacher | Active | UUID |\n|-------|----------|----------|----------|------|---------|--------|------|\n";
  const actList = (activities || []).length > 0
    ? actHeader + (activities || []).map((a: any) =>
        `| ${a.title} | ${a.category} | ${a.current_enrollment} | ${a.capacity} | ${(a.days_of_week || []).join(", ")} | ${a.teacher_in_charge} | ${a.is_active ? "✅" : "❌"} | ${a.id} |`
      ).join("\n")
    : "None";

  const allocHeader = "| Name | Email | UUID | Allocations |\n|------|-------|------|-------------|\n";
  const allocatedList = studentAllocMap.size > 0
    ? allocHeader + Array.from(studentAllocMap.entries()).map(([sid, acts]) => {
        const p = profileMap.get(sid);
        return `| ${p?.full_name || "Unknown"} | ${p?.email || "?"} | ${sid} | ${acts.join(", ")} |`;
      }).join("\n")
    : "None";

  const unallocHeader = "| Name | Email | UUID |\n|------|-------|------|\n";
  const unallocatedList = unallocatedIds.length > 0
    ? unallocHeader + unallocatedIds.slice(0, 300).map((id: string) => {
        const p = profileMap.get(id);
        return `| ${p?.full_name || "Unknown"} | ${p?.email || "?"} | ${id} |`;
      }).join("\n")
    : "All students allocated";

  const staffHeader = "| Name | Email | Role | UUID |\n|------|-------|------|------|\n";
  const staffListStr = (staffRoles || []).length > 0
    ? staffHeader + (staffRoles || []).map((r: any) => {
        const p = profileMap.get(r.user_id);
        return `| ${p?.full_name || "Unknown"} | ${p?.email || "?"} | ${r.role} | ${r.user_id} |`;
      }).join("\n")
    : "None";

  const badgeHeader = "| Name | Email | Badge | UUID |\n|------|-------|-------|------|\n";
  const badgeList = (badges || []).length > 0
    ? badgeHeader + (badges || []).map((b: any) => {
        const p = profileMap.get(b.user_id);
        return `| ${p?.full_name || "Unknown"} | ${p?.email || "?"} | ${b.badge_name} | ${b.user_id} |`;
      }).join("\n")
    : "No badges";

  const stats: DbStats = {
    students: studentCount || 0,
    allocated: studentAllocMap.size,
    unallocated: unallocatedIds.length,
    activities: (activities || []).length,
    allocations: allocCount || 0,
    badges: (badges || []).length,
    staff: (staffRoles || []).length,
  };

  const prompt = `You are DevBot — the internal AI for NLS system developers. You have complete read/write access to the live NLS database. You can query data, execute write operations, and also just chat normally about anything.

## CURRENT USER (the person chatting with you right now)
- **UUID**: \`${currentUserId}\`
- **Email**: ${currentUserEmail}
- **Name**: ${profileMap.get(currentUserId)?.full_name || "Unknown"}
- **Today's Date**: ${new Date().toLocaleDateString("en-CA")} (${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })})

When the user says "me", "my", "I", "myself" — they mean **this user** above. Resolve immediately, never ask.
When the user says "next Tuesday" or "this Friday" — calculate the actual date from today's date above. Never ask for clarification on dates you can calculate.

## CAPABILITIES
- **Read**: Full access to everything in the snapshot below — query, analyze, list, summarize
- **Write**: Execute DB mutations via ACTION blocks (allocate students, update activities, manage badges, change roles)
- **Chat**: Help debug code, answer questions, explain architecture, brainstorm — anything the dev needs

## AUTO-RESOLVE IDENTIFIERS
When a user provides an **email**, **full name**, **first name**, **last name**, or **partial name** instead of a UUID:
1. Search the snapshot data below using case-insensitive, fuzzy matching (e.g. "ivan" matches "Ivan Kundwa", "blaise" matches "Blaise Imanzi").
2. Match against first name, last name, full name, or email prefix — any substring match counts.
3. Resolve their UUID automatically — do NOT ask the user to provide a UUID.
4. Confirm the match: "Found **John Doe** (john@example.com) → \`uuid-here\`" before executing actions.
5. If multiple matches exist (e.g. two "John"s), list ALL matches in a table and ask which one.
6. If no match is found, say so explicitly — the user may not be in the current snapshot (suggest refreshing).

## DATABASE RULES
1. NEVER say "I don't have access" — THE DATA IS BELOW. USE IT.
2. **ALWAYS format data as markdown tables** — never dump raw lists or plain text when presenting structured data. Use columns like | Name | Email | UUID | Role | etc.
3. When listing students, activities, badges, staff, etc. — ALWAYS use a table with clear column headers.
4. Reference actual names, emails, UUIDs from the data.
5. If data is truncated, say so explicitly.
6. Emit ACTION blocks at the END of your message for write ops.
7. When the user says "grant badge to user@email.com" or "ban John Doe", resolve the identifier to a UUID FIRST, then emit the ACTION.
8. For counts or stats, use a clean summary table. For detailed lists, use full tables with all relevant columns.
9. Sort tables logically — alphabetically by name, or by the most relevant metric.
10. **NEVER ask for information you already have** — if the user says "excuse me from X", you know who they are, you know what date they mean, and you can look up activity IDs from the snapshot. Just do it.

## WRITE OPERATIONS
Emit one per action at the end of your message:
\`<ACTION>{"type":"move_student","student_id":"uuid","activity_id":"uuid"}</ACTION>\`

### Allocation Management
| Type | Required | Optional |
|------|----------|---------|
| move_student | student_id, activity_id | day_of_week, from_activity_id |
| add_allocation | student_id, activity_id, day_of_week | slot_number |
| remove_allocation | student_id | activity_id, day_of_week |
| bulk_allocate | allocations (JSON array of {student_id, activity_id, day_of_week, slot_number}) | — |
| clear_all_allocations | — | — |

### Activity Management
| Type | Required | Optional |
|------|----------|---------|
| create_activity | title | description, category, capacity, teacher_in_charge, schedule, days_of_week (JSON array), teacher_id |
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
| mark_attendance | session_id, student_id | status (present/absent/late/excused) |

### Messaging
| Type | Required | Optional |
|------|----------|---------|
| send_activity_message | activity_id, content | message_type (announcement/discussion) |
| send_academic_message | class_group_id, content | message_type |
| send_dm | content, recipient_id | channel_id |
| delete_message | message_id | table (activity_messages/academic_messages/direct_messages) |

### Academic
| Type | Required | Optional |
|------|----------|---------|
| create_academic_excuse | student_id | excuse_date, reason, slot_id |
| add_class_group_member | class_group_id, student_id | — |
| remove_class_group_member | class_group_id, student_id | — |

### Storage
| Type | Required | Optional |
|------|----------|---------|
| list_storage | — | bucket (default: avatars), path |
| delete_storage_file | bucket, path | — |

### Data Queries (read-only, returns data as JSON)
| Type | Required | Optional |
|------|----------|---------|
| query_table | table | select, eq_column, eq_value, order_by, ascending, limit |

Available tables: profiles, user_roles, activities, allocations, preferences, attendance_sessions, attendance_records, attendance_notifications, user_badges, badge_requests, activity_messages, academic_messages, direct_messages, dm_channels, class_groups, class_group_members, timetable_slots, timetable_enrollments, academic_subjects, academic_sessions, academic_attendance, academic_excuses, academic_periods, user_themes

Valid roles: student, teacher, moderator, admin
Storage buckets: avatars, themes

⚠️ **NUCLEAR ACTIONS** (clear_all_allocations, clear_all_preferences, delete_activity): ALWAYS warn the dev explicitly before emitting these. These are destructive and irreversible.

## LIVE SNAPSHOT — ${new Date().toLocaleString()}

### System Stats
| Metric | Value |
|--------|-------|
| Students | ${stats.students} |
| Staff (teachers/admins/mods) | ${stats.staff} |
| Active Activities | ${stats.activities} |
| Total Allocations | ${stats.allocations} |
| Allocated Students | ${stats.allocated} |
| Unallocated Students | ${stats.unallocated} |
| Attendance Records | ${attendanceCount || 0} |
| Preferences Submitted | ${prefCount || 0} |
| Badges Granted | ${stats.badges} |

### Activities (${(activities || []).length})
${actList}

### Staff — Teachers / Admins / Mods (${(staffRoles || []).length})
${staffListStr}

### Allocated Students (${studentAllocMap.size} / ${stats.students})
${allocatedList}

### Unallocated Students (${unallocatedIds.length})
${unallocatedList}

### Badges (${stats.badges})
${badgeList}`;

  return { prompt, stats };
};

const DevAI = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [executingIdx, setExecutingIdx] = useState<string | null>(null);
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const systemPromptRef = useRef<string>("");

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data } = await (supabase as any).from("user_badges").select("id").eq("user_id", user.id).eq("badge_name", "Dev").maybeSingle();
      if (!data) { navigate("/student"); return; }
      setLoading(false);
      // Pre-fetch stats on load
      const { prompt, stats } = await buildSystemPrompt();
      systemPromptRef.current = prompt;
      setDbStats(stats);
      setLastRefresh(new Date().toLocaleTimeString());
    };
    checkAccess();
  }, [navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "l") { e.preventDefault(); setMessages([]); }
      if (e.ctrlKey && e.key === "k") { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const refreshDb = useCallback(async (silent = false) => {
    setRefreshing(true);
    try {
      const { prompt, stats } = await buildSystemPrompt();
      systemPromptRef.current = prompt;
      setDbStats(stats);
      setLastRefresh(new Date().toLocaleTimeString());
      if (!silent) toast({ title: "DB refreshed", description: `Snapshot updated at ${new Date().toLocaleTimeString()}` });
    } finally {
      setRefreshing(false);
    }
  }, [toast]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isTyping) return;
    const userMsg: ChatMessage = { role: "user", content: content.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    try {
      // Refresh DB snapshot before each message for fresh data
      const { prompt, stats } = await buildSystemPrompt();
      systemPromptRef.current = prompt;
      setDbStats(stats);
      setLastRefresh(new Date().toLocaleTimeString());

      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://nbjoqsaeulvwxlnbevog.supabase.co";

      const response = await fetch(`${supabaseUrl}/functions/v1/activity-chatbot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPromptRef.current },
            ...newMessages.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const delta = JSON.parse(data).choices?.[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
                const { actions } = parseActions(fullContent);
                setMessages([...newMessages, { role: "assistant", content: fullContent, actions }]);
              }
            } catch { /* skip */ }
          }
        }
      }

      const { actions } = parseActions(fullContent);
      setMessages([...newMessages, { role: "assistant", content: fullContent, actions }]);
    } catch (error) {
      console.error("DevAI error:", error);
      toast({ variant: "destructive", title: "DevBot error", description: String(error) });
    } finally {
      setIsTyping(false);
    }
  };

  const handleExecute = async (msgIdx: number, actionIdx: number, action: ParsedAction) => {
    const key = `${msgIdx}-${actionIdx}`;
    setExecutingIdx(key);
    try {
      const result = await executeAction(action);
      toast({ title: "⚡ Executed", description: result });
      await refreshDb(true);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Action Failed", description: error.message || "Unknown error" });
    } finally {
      setExecutingIdx(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <p className="text-zinc-500 text-sm font-mono">verifying dev access<span className="animate-pulse">_</span></p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-mono">
      {/* Scanline */}
      <div className="pointer-events-none fixed inset-0 z-50 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.03)_2px,rgba(0,0,0,0.03)_4px)]" />

      {/* Header */}
      <header className="border-b border-zinc-800/80 px-4 py-2.5 flex items-center justify-between bg-zinc-950/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-zinc-600 hover:text-zinc-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold dev-name-glow text-emerald-400">DevBot</span>
          <span className="text-zinc-700 text-[10px] hidden sm:block">NLS internal · full access</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Live stat pills */}
          {dbStats && (
            <div className="hidden md:flex items-center gap-4 text-[10px]">
              <span className="text-zinc-600"><span className="text-emerald-400 font-bold">{dbStats.students}</span> students</span>
              <span className="text-zinc-600"><span className="text-amber-400 font-bold">{dbStats.unallocated}</span> unallocated</span>
              <span className="text-zinc-600"><span className="text-cyan-400 font-bold">{dbStats.activities}</span> activities</span>
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => refreshDb()}
              disabled={refreshing}
              className="text-zinc-600 hover:text-emerald-400 transition-colors disabled:opacity-40"
              title="Refresh DB snapshot"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setMessages([])}
              className="text-zinc-600 hover:text-red-400 transition-colors"
              title="Clear chat (Ctrl+L)"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </header>

      {/* Stats bar */}
      {dbStats && (
        <div className="flex gap-5 px-4 py-1.5 bg-zinc-900/30 border-b border-zinc-800/40 text-[10px] text-zinc-600 overflow-x-auto scrollbar-none shrink-0">
          <span>snapshot <span className="text-zinc-400">{lastRefresh}</span></span>
          <span>msgs <span className="text-zinc-400">{messages.length}</span></span>
          <span>allocated <span className="text-emerald-600">{dbStats.allocated}</span>/<span className="text-zinc-500">{dbStats.students}</span></span>
          <span>allocs <span className="text-zinc-400">{dbStats.allocations}</span></span>
          <span>staff <span className="text-zinc-400">{dbStats.staff}</span></span>
          <span>badges <span className="text-zinc-400">{dbStats.badges}</span></span>
          <span className="ml-auto text-zinc-700 hidden sm:block">ctrl+l clear · ctrl+k focus</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-5xl w-full mx-auto">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-8 select-none">
            <div className="text-center space-y-4">
              <pre className="text-emerald-400/80 text-xs leading-tight">
{`  ____             ____        _
 |  _ \\  _____   _| __ )  ___ | |_
 | | | |/ _ \\ \\ / /  _ \\ / _ \\| __|
 | |_| |  __/\\ V /| |_) | (_) | |_
 |____/ \\___| \\_/ |____/ \\___/ \\__|`}
              </pre>
              <p className="text-zinc-400 text-sm">God mode. Query, mutate, message, manage storage — everything.</p>
              {dbStats ? (
                <div className="flex flex-wrap justify-center gap-4 text-xs text-zinc-600">
                  <span><span className="text-emerald-400">{dbStats.students}</span> students</span>
                  <span><span className="text-amber-400">{dbStats.unallocated}</span> unallocated</span>
                  <span><span className="text-cyan-400">{dbStats.activities}</span> activities</span>
                  <span><span className="text-purple-400">{dbStats.badges}</span> badges</span>
                </div>
              ) : (
                <p className="text-zinc-600 text-xs flex items-center gap-1 justify-center">
                  <Database className="w-3 h-3 animate-pulse" /> loading snapshot...
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl w-full px-4">
              {QUICK_ACTIONS.map((qa) => (
                <button
                  key={qa.label}
                  onClick={() => sendMessage(qa.cmd)}
                  className="text-xs px-3 py-2 rounded border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800/80 hover:border-emerald-700/40 hover:text-emerald-300 transition-all text-left"
                >
                  <span className="text-emerald-700 mr-1.5">$</span>{qa.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <DevMessageBubble
            key={i}
            msg={msg}
            msgIdx={i}
            executingIdx={executingIdx}
            onExecute={handleExecute}
          />
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-4 py-3 text-sm text-emerald-400/80 flex items-center gap-2">
              <Database className="w-3.5 h-3.5 animate-pulse" />
              <span className="animate-pulse">querying</span>
              <span className="inline-flex gap-0.5">
                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions bar (after first message) */}
      {messages.length > 0 && (
        <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-none border-t border-zinc-800/40 shrink-0">
          {QUICK_ACTIONS.map((qa) => (
            <button
              key={qa.label}
              onClick={() => sendMessage(qa.cmd)}
              disabled={isTyping}
              className="text-[10px] px-2.5 py-1 rounded border border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:text-emerald-300 hover:border-emerald-700/50 transition-all whitespace-nowrap flex-shrink-0 disabled:opacity-40"
            >
              {qa.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur-sm shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
          className="flex gap-2 max-w-5xl mx-auto items-center bg-zinc-900/60 border border-zinc-700/40 rounded-lg px-3 py-2 focus-within:border-emerald-700/50 transition-colors"
        >
          <Zap className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="query, execute, or just chat..."
            disabled={isTyping}
            autoFocus
            className="flex-1 bg-transparent border-none text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none disabled:opacity-50 caret-emerald-400"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded px-3 py-1.5 transition-colors flex items-center gap-1.5 text-xs shrink-0"
          >
            {isTyping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </form>
        <p className="text-center text-[10px] text-zinc-800 mt-2">ctrl+l clear · ctrl+k focus · dev badge required</p>
      </div>
    </div>
  );
};

export default DevAI;
