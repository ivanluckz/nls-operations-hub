import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { Zap, Send, Loader2, Terminal, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: ParsedAction[];
}

interface ParsedAction {
  type: string;
  [key: string]: string;
}

const ACTION_REGEX = /<ACTION>(.*?)<\/ACTION>/gs;

const QUICK_ACTIONS = [
  "List all students + their activities",
  "Show students with no allocation",
  "Show attendance summary for today",
  "List all badges granted this week",
  "Show top 5 most popular activities",
];

const parseActions = (content: string): { cleanContent: string; actions: ParsedAction[] } => {
  const actions: ParsedAction[] = [];
  let cleanContent = content;
  let match;
  while ((match = ACTION_REGEX.exec(content)) !== null) {
    try {
      actions.push(JSON.parse(match[1]));
    } catch { /* skip malformed */ }
    cleanContent = cleanContent.replace(match[0], "");
  }
  ACTION_REGEX.lastIndex = 0;
  return { cleanContent: cleanContent.trim(), actions };
};

const executeAction = async (action: ParsedAction): Promise<string> => {
  const s = supabase as any;
  switch (action.type) {
    case "move_student": {
      const { error } = await s.from("allocations").update({ activity_id: action.activity_id }).eq("student_id", action.student_id);
      if (error) throw error;
      return `Moved student ${action.student_id} to activity ${action.activity_id}`;
    }
    case "remove_allocation": {
      const q = s.from("allocations").delete().eq("student_id", action.student_id);
      if (action.activity_id) q.eq("activity_id", action.activity_id);
      const { error } = await q;
      if (error) throw error;
      return `Removed allocation for student ${action.student_id}`;
    }
    case "add_allocation": {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await s.from("allocations").insert({
        student_id: action.student_id,
        activity_id: action.activity_id,
        status: "allocated",
        preference_rank: 0,
        day_of_week: action.day_of_week || "Monday",
        slot_number: 1,
      });
      if (error) throw error;
      return `Allocated student ${action.student_id} to activity ${action.activity_id}`;
    }
    case "grant_badge": {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await s.from("user_badges").insert({
        user_id: action.user_id,
        badge_name: action.badge_name,
        awarded_by: user?.id,
      });
      if (error) throw error;
      return `Granted badge "${action.badge_name}" to user ${action.user_id}`;
    }
    case "remove_badge": {
      const { error } = await s.from("user_badges").delete().eq("user_id", action.user_id).eq("badge_name", action.badge_name);
      if (error) throw error;
      return `Removed badge "${action.badge_name}" from user ${action.user_id}`;
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
      return `Unknown action type: ${action.type}`;
  }
};

const DevAI = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [executingIdx, setExecutingIdx] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data } = await (supabase as any).from("user_badges").select("id").eq("user_id", user.id).eq("badge_name", "Dev").maybeSingle();
      if (!data) { navigate("/student"); return; }
      setLoading(false);
    };
    checkAccess();
  }, [navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const buildSystemPrompt = async () => {
    const s = supabase as any;
    const [{ count: studentCount }, { data: activities }, { count: allocCount }] = await Promise.all([
      s.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "student"),
      s.from("activities").select("id, title").eq("is_active", true).limit(100),
      s.from("allocations").select("*", { count: "exact", head: true }),
    ]);

    const actList = activities?.map((a: any) => `- ${a.title} (${a.id})`).join("\n") || "None";

    return `You are DevBot, an internal AI assistant for authorized developers of the NLS Co-curricular & Academic system. You have full read/write access to the database.

## Current System State
- Total students: ${studentCount || 0}
- Active activities:\n${actList}
- Total allocations: ${allocCount || 0}

When the user asks you to make a change (move a student, grant a badge, etc.), respond with your explanation AND a JSON action block at the end of your message in this exact format:

<ACTION>{"type":"move_student","student_id":"uuid","activity_id":"uuid"}</ACTION>

Supported types: move_student, remove_allocation, add_allocation, grant_badge, remove_badge, excuse_attendance, ban_user, unban_user.

The frontend will parse and execute this. Always confirm what you are about to do before suggesting irreversible actions. Be concise and technical.`;
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isTyping) return;
    const userMsg: ChatMessage = { role: "user", content: content.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    try {
      const systemPrompt = await buildSystemPrompt();
      const { data: { session } } = await supabase.auth.getSession();

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://nbjoqsaeulvwxlnbevog.supabase.co";

      const response = await fetch(`${supabaseUrl}/functions/v1/activity-chatbot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            ...newMessages.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}`);
      }

      // Stream SSE
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullContent += delta;
                  const { cleanContent, actions } = parseActions(fullContent);
                  setMessages([...newMessages, { role: "assistant", content: fullContent, actions }]);
                }
              } catch { /* skip */ }
            }
          }
        }
      }

      const { cleanContent, actions } = parseActions(fullContent);
      setMessages([...newMessages, { role: "assistant", content: fullContent, actions }]);
    } catch (error) {
      console.error("DevAI error:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to get response from DevBot" });
    } finally {
      setIsTyping(false);
    }
  };

  const handleExecute = async (msgIdx: number, actionIdx: number, action: ParsedAction) => {
    const key = `${msgIdx}-${actionIdx}`;
    setExecutingIdx(key);
    try {
      const result = await executeAction(action);
      toast({ title: "⚡ Action Executed", description: result });
    } catch (error: any) {
      console.error("Action execution error:", error);
      toast({ variant: "destructive", title: "Action Failed", description: error.message || "Unknown error" });
    } finally {
      setExecutingIdx(null);
    }
  };

  const getDisplayContent = (msg: ChatMessage) => {
    let c = msg.content;
    let match;
    while ((match = ACTION_REGEX.exec(c)) !== null) {
      c = c.replace(match[0], "");
    }
    ACTION_REGEX.lastIndex = 0;
    return c.trim();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <p className="text-zinc-500 text-sm font-mono">Verifying Dev access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800/80 px-4 py-3 flex items-center justify-between bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Terminal className="w-5 h-5 text-cyan-400" />
          <h1 className="text-lg font-bold font-mono dev-name-glow">⚡ Dev Console — AI</h1>
        </div>
        <span className="text-xs text-zinc-600 font-mono">DevBot v1.0</span>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6">
            <div className="text-center space-y-2">
              <div className="text-4xl">⚡</div>
              <h2 className="text-xl font-bold font-mono text-cyan-400">DevBot Ready</h2>
              <p className="text-zinc-500 text-sm max-w-md">
                Full read/write access to the NLS database. Ask me to query data, move students, manage badges, or run system operations.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 max-w-lg justify-center">
              {QUICK_ACTIONS.map((qa) => (
                <button
                  key={qa}
                  onClick={() => sendMessage(qa)}
                  className="text-xs font-mono px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-cyan-300 hover:bg-zinc-800 hover:border-cyan-700/50 transition-all"
                >
                  {qa}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] md:max-w-[70%] ${
              msg.role === "user"
                ? "bg-indigo-600/80 text-white rounded-2xl rounded-br-md px-4 py-2.5"
                : "bg-zinc-900 border-l-2 border-cyan-500/60 rounded-2xl rounded-bl-md px-4 py-3"
            }`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none font-mono text-sm leading-relaxed [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_pre]:bg-zinc-800 [&_code]:text-cyan-300">
                  <ReactMarkdown>{getDisplayContent(msg)}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm">{msg.content}</p>
              )}

              {/* Action blocks */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {msg.actions.map((action, ai) => (
                    <div key={ai} className="border border-amber-500/50 bg-amber-500/5 rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-amber-400 font-mono uppercase">Action Ready</span>
                      </div>
                      <pre className="text-xs text-zinc-400 font-mono bg-zinc-800/50 rounded-lg p-2 overflow-x-auto">
                        {JSON.stringify(action, null, 2)}
                      </pre>
                      <Button
                        size="sm"
                        onClick={() => handleExecute(i, ai, action)}
                        disabled={executingIdx === `${i}-${ai}`}
                        className="bg-amber-500 hover:bg-amber-600 text-black font-mono text-xs h-7"
                      >
                        {executingIdx === `${i}-${ai}` ? (
                          <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Executing...</>
                        ) : (
                          <>⚡ Execute Action</>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-zinc-900 border-l-2 border-cyan-500/60 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions bar (when chat has messages) */}
      {messages.length > 0 && (
        <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-none border-t border-zinc-800/50">
          {QUICK_ACTIONS.map((qa) => (
            <button
              key={qa}
              onClick={() => sendMessage(qa)}
              disabled={isTyping}
              className="text-[10px] font-mono px-2.5 py-1 rounded-md border border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:text-cyan-300 hover:border-cyan-700/50 transition-all whitespace-nowrap flex-shrink-0 disabled:opacity-40"
            >
              {qa}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/90 backdrop-blur-sm">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
          className="flex gap-2 max-w-4xl mx-auto"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask DevBot anything..."
            disabled={isTyping}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 disabled:opacity-50 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl px-4 py-2.5 transition-colors flex items-center gap-1.5 font-mono text-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default DevAI;
