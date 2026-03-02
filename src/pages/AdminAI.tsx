import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import DevMessageBubble from "@/components/dev/DevMessageBubble";
import {
  Send, Loader2, RefreshCw, Trash2, Database, Zap, CheckCircle2, XCircle,
  Clock, ArrowRightLeft, Calendar, HelpCircle, MessageSquareText, ChevronRight, ChevronLeft,
} from "lucide-react";

interface ParsedAction {
  type: string;
  [key: string]: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: ParsedAction[];
}

interface StudentRequest {
  id: string;
  student_id: string;
  request_type: string;
  details: any;
  reason: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  student_name?: string;
  student_email?: string;
}

const ACTION_REGEX = /<ACTION>(.*?)<\/ACTION>/gs;

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

const SAFE_ACTION_TYPES = new Set([
  "move_student", "remove_allocation", "add_allocation",
  "excuse_attendance", "create_attendance_session", "mark_attendance",
  "update_activity", "send_activity_message", "send_dm",
  "query_table", "create_academic_excuse",
]);

const executeAction = async (action: ParsedAction): Promise<string> => {
  if (!SAFE_ACTION_TYPES.has(action.type)) {
    return `⛔ Action "${action.type}" is not allowed in Admin AI. Use Dev AI for that.`;
  }

  const s = supabase as any;
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  switch (action.type) {
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
      const { error } = await s.from("allocations").insert({
        student_id: action.student_id, activity_id: action.activity_id,
        status: "allocated", preference_rank: 0, day_of_week: day,
        slot_number: parseInt(action.slot_number || "1"),
      });
      if (error) throw error;
      return `Allocated student to activity on ${day}`;
    }
    case "excuse_attendance": {
      const { error } = await s.from("attendance_records").update({ status: "excused" }).eq("student_id", action.student_id).eq("session_id", action.session_id);
      if (error) throw error;
      return `Excused student ${action.student_id}`;
    }
    case "create_academic_excuse": {
      const { error } = await s.from("academic_excuses").insert({
        student_id: action.student_id, excuse_date: action.excuse_date || new Date().toISOString().split("T")[0],
        created_by: currentUser?.id, reason: action.reason || "",
      });
      if (error) throw error;
      return `Created excuse for ${action.student_id}`;
    }
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
    case "update_activity": {
      const updates: any = {};
      if (action.capacity !== undefined) updates.capacity = parseInt(action.capacity);
      if (action.title) updates.title = action.title;
      if (action.teacher_in_charge) updates.teacher_in_charge = action.teacher_in_charge;
      const { error } = await s.from("activities").update(updates).eq("id", action.activity_id);
      if (error) throw error;
      return `Updated activity ${action.activity_id}`;
    }
    case "send_activity_message": {
      const { error } = await s.from("activity_messages").insert({
        activity_id: action.activity_id, sender_id: currentUser?.id,
        content: action.content, message_type: action.message_type || "announcement",
      });
      if (error) throw error;
      return `Sent message to activity ${action.activity_id}`;
    }
    case "send_dm": {
      const uid = currentUser?.id;
      let channelId = action.channel_id;
      if (!channelId && action.recipient_id) {
        const { data: existing } = await s.from("dm_channels").select("id")
          .or(`and(user1_id.eq.${uid},user2_id.eq.${action.recipient_id}),and(user1_id.eq.${action.recipient_id},user2_id.eq.${uid})`)
          .maybeSingle();
        if (existing) { channelId = existing.id; }
        else {
          const { data: newCh, error: chErr } = await s.from("dm_channels").insert({ user1_id: uid, user2_id: action.recipient_id }).select("id").single();
          if (chErr) throw chErr;
          channelId = newCh.id;
        }
      }
      const { error } = await s.from("direct_messages").insert({ channel_id: channelId, sender_id: uid, content: action.content });
      if (error) throw error;
      return `Sent DM to ${action.recipient_id || channelId}`;
    }
    default:
      return `Unknown action: ${action.type}`;
  }
};

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Clock }> = {
  swap_activity: { label: "Swap", icon: ArrowRightLeft },
  excuse: { label: "Excuse", icon: Calendar },
  drop_activity: { label: "Drop", icon: Trash2 },
  other: { label: "Other", icon: HelpCircle },
};

const AdminAI = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [executingIdx, setExecutingIdx] = useState<string | null>(null);
  const [requests, setRequests] = useState<StudentRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [denyingId, setDenyingId] = useState<string | null>(null);
  const [denyNotes, setDenyNotes] = useState("");
  const [newRequestIds, setNewRequestIds] = useState<Set<string>>(new Set());
  const prevRequestIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const systemPromptRef = useRef<string>("");

  useEffect(() => {
    fetchRequests();
    refreshSystemPrompt();
    const channel = supabase
      .channel("admin-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "student_requests" }, () => fetchRequests())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const fetchRequests = async () => {
    const { data: reqData } = await (supabase as any)
      .from("student_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!reqData) { setRequests([]); return; }

    // Detect newly arrived requests
    const currentIds = new Set<string>(reqData.map((r: any) => r.id));
    if (!initialLoadRef.current) {
      const freshIds = new Set<string>();
      currentIds.forEach(id => {
        if (!prevRequestIdsRef.current.has(id)) freshIds.add(id);
      });
      if (freshIds.size > 0) {
        setNewRequestIds(freshIds);
        setTimeout(() => setNewRequestIds(new Set()), 2000);
      }
    }
    initialLoadRef.current = false;
    prevRequestIdsRef.current = currentIds;

    // Fetch student profiles
    const studentIds = reqData.map((r: any) => String(r.student_id));
    const uniqueIds = studentIds.filter((id: string, i: number) => studentIds.indexOf(id) === i);
    const { data: profiles } = await (supabase as any).from("profiles").select("id, full_name, email").in("id", uniqueIds);
    const profileMap = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]));

    setRequests(reqData.map((r: any) => ({
      ...r,
      student_name: profileMap.get(r.student_id)?.full_name || "Unknown",
      student_email: profileMap.get(r.student_id)?.email || "",
    })));
  };

  const refreshSystemPrompt = async () => {
    const s = supabase as any;
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    const [{ data: activities }, { data: allocations }, { data: studentRoles }, { data: staffRoles }] = await Promise.all([
      s.from("activities").select("id, title, category, capacity, current_enrollment, days_of_week, is_active").limit(150),
      s.from("allocations").select("student_id, activity_id, day_of_week, slot_number").limit(1000),
      s.from("user_roles").select("user_id").eq("role", "student").limit(1000),
      s.from("user_roles").select("user_id, role").in("role", ["teacher", "admin", "moderator"]).limit(200),
    ]);

    const allStudentIds: string[] = (studentRoles || []).map((r: any) => r.user_id);
    const staffIds: string[] = (staffRoles || []).map((r: any) => r.user_id);
    const [{ data: studentProfiles }, { data: staffProfiles }] = await Promise.all([
      allStudentIds.length > 0 ? s.from("profiles").select("id, full_name, email").in("id", allStudentIds.slice(0, 500)) : Promise.resolve({ data: [] as any[] }),
      staffIds.length > 0 ? s.from("profiles").select("id, full_name, email").in("id", staffIds.slice(0, 200)) : Promise.resolve({ data: [] as any[] }),
    ]);

    const profileMap = new Map<string, any>([...(studentProfiles || []).map((p: any) => [p.id, p] as [string, any]), ...(staffProfiles || []).map((p: any) => [p.id, p] as [string, any])]);
    const activityMap = new Map<string, any>((activities || []).map((a: any) => [a.id, a]));

    const studentAllocMap = new Map<string, string[]>();
    for (const al of (allocations || [])) {
      const activity = activityMap.get(al.activity_id);
      if (activity) {
        if (!studentAllocMap.has(al.student_id)) studentAllocMap.set(al.student_id, []);
        studentAllocMap.get(al.student_id)!.push(`${activity.title} (${al.day_of_week})`);
      }
    }

    // Pending requests context
    const pendingReqs = requests.filter(r => r.status === "pending");
    const pendingContext = pendingReqs.length > 0
      ? pendingReqs.map((r, i) => `${i + 1}. [${r.id}] ${r.student_name} (${r.student_email}) — ${r.request_type}: ${r.reason}${r.details ? ` | Details: ${JSON.stringify(r.details)}` : ""}`).join("\n")
      : "No pending requests.";

    const actList = (activities || []).map((a: any) => `[${a.id}] ${a.title} | ${a.category} | ${a.current_enrollment}/${a.capacity} | Days: ${(a.days_of_week || []).join(",")}`).join("\n") || "None";

    const allocatedList = Array.from(studentAllocMap.entries()).map(([sid, acts]) => {
      const p = profileMap.get(sid);
      return `[${sid}] ${p?.full_name || "Unknown"} (${p?.email || "?"}) → ${acts.join("; ")}`;
    }).join("\n") || "None";

    systemPromptRef.current = `You are AdminBot — the admin AI assistant for NLS co-curricular management. You help admins review and process student requests.

## CURRENT USER
- **UUID**: \`${currentUser?.id}\`
- **Email**: ${currentUser?.email}
- **Today's Date**: ${new Date().toLocaleDateString("en-CA")}

## YOUR ROLE
You help admins:
1. Review student requests (swaps, excuses, drops)
2. Suggest the right ACTION to fulfill each request
3. Execute approved changes
4. Answer questions about activities, allocations, and students

## PENDING STUDENT REQUESTS
${pendingContext}

## CAPABILITIES (SAFE ACTIONS ONLY)
You can: move_student, add_allocation, remove_allocation, excuse_attendance, create_academic_excuse, update_activity, send_activity_message, send_dm, query_table.
You CANNOT: clear_all_allocations, clear_all_preferences, delete_activity, ban/unban users, change roles, manage badges, manage storage. Those require Dev AI.

## AUTO-RESOLVE
When a name/email is mentioned, resolve from the snapshot below. Confirm match before executing.

## ACTION FORMAT
\`<ACTION>{"type":"move_student","student_id":"uuid","activity_id":"uuid"}</ACTION>\`

### Safe Action Types
| Type | Required | Optional |
|------|----------|---------|
| move_student | student_id, activity_id | day_of_week, from_activity_id |
| add_allocation | student_id, activity_id, day_of_week | slot_number |
| remove_allocation | student_id | activity_id, day_of_week |
| excuse_attendance | student_id, session_id | — |
| create_academic_excuse | student_id | excuse_date, reason |
| update_activity | activity_id | capacity, title, teacher_in_charge |
| send_activity_message | activity_id, content | message_type |
| send_dm | content, recipient_id | channel_id |
| query_table | table | select, eq_column, eq_value, order_by, limit |

## PROCESSING REQUESTS
When an admin says "approve request #1" or references a pending request:
1. Look up the request details from the pending list above
2. Suggest the appropriate ACTION block
3. Explain what will happen
4. Let the admin confirm by executing

## DATA SNAPSHOT
### Activities
${actList}

### Student Allocations
${allocatedList}`;
  };

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchRequests();
      await refreshSystemPrompt();
      toast({ title: "Refreshed", description: "Data snapshot updated" });
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
      await refreshSystemPrompt();
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
      console.error("AdminAI error:", error);
      toast({ variant: "destructive", title: "Error", description: String(error) });
    } finally {
      setIsTyping(false);
    }
  };

  const handleExecute = async (msgIdx: number, actionIdx: number, action: ParsedAction) => {
    const key = `${msgIdx}-${actionIdx}`;
    setExecutingIdx(key);
    try {
      const result = await executeAction(action);
      toast({ title: "✅ Executed", description: result });
      await refreshAll();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Action Failed", description: error.message });
    } finally {
      setExecutingIdx(null);
    }
  };

  const handleApproveRequest = (req: StudentRequest) => {
    const details = req.details || {};
    let suggestion = "";
    if (req.request_type === "swap_activity") {
      suggestion = `Approve request from ${req.student_name}: swap from "${details.current_activity_name}" to "${details.desired_activity_name}". Please execute the swap.`;
    } else if (req.request_type === "excuse") {
      suggestion = `Approve excuse request from ${req.student_name} for "${details.activity_name}"${details.excuse_date ? ` on ${details.excuse_date}` : ""}. Reason: ${req.reason}`;
    } else if (req.request_type === "drop_activity") {
      suggestion = `Approve drop request from ${req.student_name}: remove them from "${details.activity_name}". Reason: ${req.reason}`;
    } else {
      suggestion = `Approve request from ${req.student_name}: ${req.reason}`;
    }
    sendMessage(suggestion);
  };

  const handleDenyRequest = async (reqId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("student_requests").update({
        status: "denied",
        admin_notes: denyNotes.trim() || "Request denied",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", reqId);
      if (error) throw error;
      toast({ title: "Request denied", description: "Student will be notified" });
      setDenyingId(null);
      setDenyNotes("");
      await fetchRequests();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const pendingRequests = requests.filter(r => r.status === "pending");
  const processedRequests = requests.filter(r => r.status !== "pending");

  return (
    <AdminLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden gap-0">
        {/* Request Queue Panel */}
        <div className={`border-r border-border bg-card transition-all duration-300 overflow-hidden flex flex-col ${panelOpen ? "w-[380px] min-w-[380px]" : "w-0 min-w-0"}`}>
          <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquareText className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">Request Queue</h2>
              {pendingRequests.length > 0 && (
                <Badge variant="destructive" className="text-xs">{pendingRequests.length}</Badge>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPanelOpen(false)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {pendingRequests.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No pending requests 🎉</p>
            )}
            {pendingRequests.map((req) => {
              const typeCfg = TYPE_CONFIG[req.request_type] || TYPE_CONFIG.other;
              const TypeIcon = typeCfg.icon;
              return (
                <Card key={req.id} className={`border-primary/20 transition-all duration-500 ${newRequestIds.has(req.id) ? "animate-fade-in ring-2 ring-primary/40 shadow-lg shadow-primary/10" : ""}`}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">{typeCfg.label}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs font-medium">{req.student_name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{req.reason}</p>
                    {req.details && Object.keys(req.details).length > 0 && (
                      <div className="text-[10px] text-muted-foreground bg-muted/50 rounded p-1.5 space-y-0.5">
                        {req.details.current_activity_name && <p>From: {req.details.current_activity_name}</p>}
                        {req.details.desired_activity_name && <p>To: {req.details.desired_activity_name}</p>}
                        {req.details.activity_name && <p>Activity: {req.details.activity_name}</p>}
                        {req.details.excuse_date && <p>Date: {req.details.excuse_date}</p>}
                      </div>
                    )}

                    {denyingId === req.id ? (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Reason for denial..."
                          value={denyNotes}
                          onChange={(e) => setDenyNotes(e.target.value)}
                          className="text-xs min-h-[60px]"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="destructive" className="text-xs flex-1" onClick={() => handleDenyRequest(req.id)}>
                            Confirm Deny
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => { setDenyingId(null); setDenyNotes(""); }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button size="sm" className="text-xs flex-1 gap-1" onClick={() => handleApproveRequest(req)}>
                          <CheckCircle2 className="w-3 h-3" /> Approve via AI
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setDenyingId(req.id)}>
                          <XCircle className="w-3 h-3" /> Deny
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {processedRequests.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground font-medium pt-2">Processed</p>
                {processedRequests.slice(0, 20).map((req) => (
                  <Card key={req.id} className="opacity-60">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{req.student_name}</span>
                        <Badge variant={req.status === "approved" ? "default" : "destructive"} className="text-[10px]">
                          {req.status}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{req.reason}</p>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Chat Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0 bg-card">
            <div className="flex items-center gap-3">
              {!panelOpen && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPanelOpen(true)}>
                  <ChevronRight className="w-4 h-4" />
                  {pendingRequests.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center">
                      {pendingRequests.length}
                    </span>
                  )}
                </Button>
              )}
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-primary">Admin AI</span>
              <span className="text-muted-foreground text-[10px] hidden sm:block">request-driven · safe actions only</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refreshAll} disabled={refreshing}>
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMessages([])}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 select-none">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                    <Zap className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-bold text-lg">Admin AI</h3>
                  <p className="text-muted-foreground text-sm max-w-md">
                    Review student requests, approve changes, and manage allocations.
                    {pendingRequests.length > 0 && (
                      <span className="block mt-1 text-primary font-medium">
                        {pendingRequests.length} pending request{pendingRequests.length !== 1 ? "s" : ""} to review.
                      </span>
                    )}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 max-w-md w-full">
                  {[
                    { label: "Review pending requests", cmd: "Show me all pending student requests and what actions are needed" },
                    { label: "Activity capacity", cmd: "Show activities that are near or at full capacity" },
                    { label: "Unallocated students", cmd: "List students with no allocation" },
                    { label: "Recent changes", cmd: "What were the most recent allocation changes?" },
                  ].map((qa) => (
                    <button key={qa.label} onClick={() => sendMessage(qa.cmd)}
                      className="text-xs px-3 py-2.5 rounded-lg border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground transition-all text-left">
                      {qa.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <DevMessageBubble key={i} msg={msg} msgIdx={i} executingIdx={executingIdx} onExecute={handleExecute} />
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-muted border rounded-lg px-4 py-3 text-sm text-primary flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 animate-pulse" />
                  <span className="animate-pulse">processing</span>
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

          {/* Input */}
          <div className="p-4 border-t border-border bg-card shrink-0">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
              className="flex gap-2 items-center bg-muted/30 border rounded-lg px-3 py-2 focus-within:border-primary/50 transition-colors">
              <Zap className="w-3.5 h-3.5 text-primary/50 shrink-0" />
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about requests, allocations, or execute changes..."
                disabled={isTyping}
                autoFocus
                className="flex-1 bg-transparent border-none text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
              />
              <Button type="submit" size="sm" disabled={!input.trim() || isTyping}>
                {isTyping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAI;
