import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, Key, Sparkles, Bot } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const SYSTEM_CONTEXT = `You are an AI assistant for the NLS Operations Hub — an internal school management platform for NLS (Ntare-Louise Nlund School) in Kigali, Rwanda.

The platform manages:
- Co-curricular activity allocation (400+ students, 20+ weekly activities)
- Digital attendance tracking with QR scanning
- 7 role-specific dashboards: Admin, Moderator, Teacher, RL Coach, Medical, Kitchen, Student
- AI-powered weekly summary reports
- Real-time messaging, push notifications
- Medical visit tracking, meal attendance
- Data export to Excel/CSV
- Google Calendar & Sheets integration

Be helpful, friendly, and concise. Answer questions about how the platform works, what each role can do, and how it saves time.`;

export default function PreAuthChatbot() {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("gemini_api_key") || "");
  const [keyInput, setKeyInput] = useState("");
  const [keySet, setKeySet] = useState(() => !!localStorage.getItem("gemini_api_key"));
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hi! I'm the NLS Operations Hub assistant. Ask me anything about the platform — what each role does, how allocation works, or how we save admin time. What would you like to know?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const saveKey = () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    localStorage.setItem("gemini_api_key", trimmed);
    setApiKey(trimmed);
    setKeySet(true);
    setKeyInput("");
  };

  const clearKey = () => {
    localStorage.removeItem("gemini_api_key");
    setApiKey("");
    setKeySet(false);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next: Message[] = [...messages, { role: "user", text }];
    setMessages(next);
    setLoading(true);
    try {
      const history = next.slice(1).map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      }));

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_CONTEXT }] },
            contents: history,
          }),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't get a response.";
      setMessages([...next, { role: "assistant", text: reply }]);
    } catch (err: any) {
      setMessages([...next, { role: "assistant", text: `Error: ${err.message}. Check your Gemini API key.` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
        aria-label="Open chatbot"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[350px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl shadow-2xl border border-border bg-card overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground">
            <Bot className="w-5 h-5" />
            <span className="font-semibold text-sm flex-1">NLS Assistant</span>
            {keySet && (
              <button onClick={clearKey} title="Change API key" className="opacity-60 hover:opacity-100 transition-opacity mr-1">
                <Key className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => setOpen(false)} className="opacity-70 hover:opacity-100 transition-opacity">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* API key gate */}
          {!keySet ? (
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Sparkles className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <p>Enter your <strong>Gemini API key</strong> to chat with the NLS assistant. Your key stays in your browser only.</p>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="AIza..."
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveKey()}
                  type="password"
                  className="text-sm h-9"
                />
                <Button size="sm" onClick={saveKey} className="h-9 px-3">
                  Save
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Get a free key at <span className="text-primary">aistudio.google.com</span>
              </p>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-72">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-muted-foreground">
                      Thinking…
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="flex gap-2 p-3 border-t">
                <Input
                  placeholder="Ask anything…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  className="text-sm h-9"
                  disabled={loading}
                />
                <Button size="sm" onClick={sendMessage} disabled={loading || !input.trim()} className="h-9 px-3">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
