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
  switch (action.type) {
    case "move_student": {
      let q = s.from("allocations").update({ activity_id: action.activity_id }).eq("student_id", action.student_id);
      if (action.day_of_week) q = q.eq("day_of_week", action.day_of_week);
      if (action.from_activity_id) q = q.eq("activity_id", action.from_activity_id);
      const { error } = await q;
      if (error) throw error;
      return `Moved student ${action.student_id} to activity ${action.activity_id}${action.day_of_week ? ` on ${action.day_of_week}` : ""}`;
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
        student_id: action.student_id,
        activity_id: action.activity_id,
        status: "allocated",
        preference_rank: 0,
        day_of_week: day,
        slot_number: parseInt(action.slot_number || "1"),
      });
      if (error) throw error;
      return `Allocated student to ${actData?.title || action.activity_id} on ${day}`;
    }
    case "update_activity": {
      const updates: any = {};
      if (action.capacity !== undefined) updates.capacity = parseInt(action.capacity);
      if (action.title) updates.title = action.title;
      if (action.teacher_in_charge) updates.teacher_in_charge = action.teacher_in_charge;
      if (action.description) updates.description = action.description;
      if (action.is_active !== undefined) updates.is_active = action.is_active === "true";
      const { error } = await s.from("activities").update(updates).eq("id", action.activity_id);
      if (error) throw error;
      return `Updated activity ${action.activity_id}: ${JSON.stringify(updates)}`;
    }
    case "grant_badge": {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await s.from("user_badges").insert({ user_id: action.user_id, badge_name: action.badge_name, awarded_by: user?.id });
      if (error) throw error;
      return `Granted "${action.badge_name}" to ${action.user_id}`;
    }
    case "remove_badge": {
      const { error } = await s.from("user_badges").delete().eq("user_id", action.user_id).eq("badge_name", action.badge_name);
      if (error) throw error;
      return `Removed "${action.badge_name}" from ${action.user_id}`;
    }
    case "change_user_role": {
      const { error } = await s.from("user_roles").update({ role: action.role }).eq("user_id", action.user_id);
      if (error) throw error;
      return `Changed role for ${action.user_id} → ${action.role}`;
    }
    case "delete_preferences": {
      const { error } = await s.from("preferences").delete().eq("student_id", action.student_id);
      if (error) throw error;
      return `Cleared preferences for student ${action.student_id}`;
    }
    case "excuse_attendance": {
      const { error } = await s.from("attendance_records").update({ status: "excused" }).eq("student_id", action.student_id).eq("session_id", action.session_id);
      if (error) throw error;
      return `Excused student ${action.student_id} for session ${action.session_id}`;
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
    default:
      return `Unknown action: ${action.type}`;
  }
};

const buildSystemPrompt = async (): Promise<{ prompt: string; stats: DbStats }> => {
  const s = supabase as any;

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

  const actList = (activities || []).map((a: any) =>
    `- [${a.id}] **${a.title}** (${a.category}) — ${a.current_enrollment}/${a.capacity} enrolled | Days: ${(a.days_of_week || []).join(", ")} | Teacher: ${a.teacher_in_charge} | Active: ${a.is_active}`
  ).join("\n") || "None";

  const allocatedList = Array.from(studentAllocMap.entries()).map(([sid, acts]) => {
    const p = profileMap.get(sid);
    return `- [${sid}] ${p?.full_name || "Unknown"} (${p?.email || "?"}) → ${acts.join(" | ")}`;
  }).join("\n") || "None";

  const unallocatedList = unallocatedIds.slice(0, 300).map((id: string) => {
    const p = profileMap.get(id);
    return `- [${id}] ${p?.full_name || "Unknown"} (${p?.email || "?"})`;
  }).join("\n") || "All students allocated";

  const staffList = (staffRoles || []).map((r: any) => {
    const p = profileMap.get(r.user_id);
    return `- [${r.user_id}] ${p?.full_name || "Unknown"} (${p?.email || "?"}) — ${r.role}`;
  }).join("\n") || "None";

  const badgeList = (badges || []).map((b: any) => {
    const p = profileMap.get(b.user_id);
    return `- [${b.user_id}] ${p?.full_name || "Unknown"}: ${b.badge_name}`;
  }).join("\n") || "No badges";

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

## CAPABILITIES
- **Read**: Full access to everything in the snapshot below — query, analyze, list, summarize
- **Write**: Execute DB mutations via ACTION blocks (allocate students, update activities, manage badges, change roles)
- **Chat**: Help debug code, answer questions, explain architecture, brainstorm — anything the dev needs

## DATABASE RULES
1. NEVER say "I don't have access" — THE DATA IS BELOW. USE IT.
2. When asked to list something, LIST IT with actual names and IDs. Use markdown tables.
3. Reference actual names, emails, UUIDs from the data.
4. If data is truncated, say so explicitly.
5. Emit ACTION blocks at the END of your message for write ops.

## WRITE OPERATIONS
Emit one per action at the end of your message:
\`<ACTION>{"type":"move_student","student_id":"uuid","activity_id":"uuid"}</ACTION>\`

| Type | Required | Optional |
|------|----------|---------|
| move_student | student_id, activity_id | day_of_week, from_activity_id |
| add_allocation | student_id, activity_id, day_of_week | slot_number |
| remove_allocation | student_id | activity_id, day_of_week |
| update_activity | activity_id | capacity, title, teacher_in_charge, description, is_active |
| grant_badge | user_id, badge_name | — |
| remove_badge | user_id, badge_name | — |
| change_user_role | user_id, role | — |
| delete_preferences | student_id | — |
| excuse_attendance | student_id, session_id | — |
| ban_user | user_id | — |
| unban_user | user_id | — |

Valid roles: student, teacher, moderator, admin

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
${staffList}

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
              <p className="text-zinc-400 text-sm">Full read/write access. Query anything. Execute anything.</p>
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
