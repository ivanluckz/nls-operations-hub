import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Bot, User, Loader2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CHATBOT_LIMITS } from "@/lib/constants";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "assistant"; content: string; timestamp: Date };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const CHAT_URL = `${SUPABASE_URL}/functions/v1/activity-chatbot`;

async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: { role: string; content: string }[];
  onDelta: (deltaText: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
  
  if (refreshError || !session?.access_token) {
    const { data: { session: existingSession } } = await supabase.auth.getSession();
    if (!existingSession?.access_token) {
      throw new Error("Please log in to use the chatbot");
    }
  }
  
  const accessToken = session?.access_token || (await supabase.auth.getSession()).data.session?.access_token;
  
  if (!accessToken) {
    throw new Error("Please log in to use the chatbot");
  }

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ messages: messages.map(m => ({ role: m.role, content: m.content })) }),
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to get response");
  }

  if (!resp.body) throw new Error("No response body");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  onDone();
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const TypingIndicator = () => (
  <div className="flex gap-3 justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
      <Bot className="h-4 w-4 text-primary" />
    </div>
    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
      <div className="flex gap-1.5 items-center">
        <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  </div>
);

const ROLE_SUGGESTIONS: Record<string, string[]> = {
  student: [
    "What activities am I allocated to?",
    "How do I submit my preferences?",
    "What's my attendance record?",
  ],
  teacher: [
    "Which activities am I running?",
    "How do I take attendance?",
    "How do I message my students?",
  ],
  moderator: [
    "Show me the system overview",
    "How do I manage allocations?",
    "How do I excuse a student?",
  ],
  admin: [
    "How do I import students?",
    "How do I run the allocation engine?",
    "Show me the system overview",
  ],
};

const ActivityChatbot = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userRole, setUserRole] = useState<string>("student");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        if (data) setUserRole(data.role);
      }
    };
    fetchRole();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [messages]);

  const sendMessage = async (overrideInput?: string) => {
    const text = (overrideInput || input).trim();
    if (!text || isLoading) return;

    if (text.length > CHATBOT_LIMITS.MAX_MESSAGE_LENGTH) {
      toast({
        title: "Message too long",
        description: `Please limit messages to ${CHATBOT_LIMITS.MAX_MESSAGE_LENGTH} characters`,
        variant: "destructive"
      });
      return;
    }

    const userMsg: Message = { role: "user", content: text, timestamp: new Date() };
    
    setMessages(prev => {
      const updated = [...prev, userMsg];
      if (updated.length > CHATBOT_LIMITS.MAX_CONVERSATION_LENGTH * 2) {
        return updated.slice(-CHATBOT_LIMITS.MAX_CONVERSATION_LENGTH * 2);
      }
      return updated;
    });
    
    setInput("");
    setIsLoading(true);

    let assistantContent = "";

    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
        }
        return [...prev, { role: "assistant", content: assistantContent, timestamp: new Date() }];
      });
    };

    try {
      const recentMessages = [...messages, userMsg].slice(-CHATBOT_LIMITS.MAX_CONVERSATION_LENGTH);
      
      await streamChat({
        messages: recentMessages,
        onDelta: updateAssistant,
        onDone: () => setIsLoading(false),
        onError: (error) => {
          toast({ title: "Error", description: error, variant: "destructive" });
          setIsLoading(false);
        },
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestions = ROLE_SUGGESTIONS[userRole] || ROLE_SUGGESTIONS.student;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card className="h-[calc(100vh-140px)] flex flex-col shadow-lg border-border/50">
          <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-primary/10">
            <CardTitle className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span>NLS Activity Assistant</span>
                <p className="text-xs font-normal text-muted-foreground mt-0.5">
                  AI-powered • Knows your {userRole} data
                </p>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Bot className="h-8 w-8 text-primary opacity-70" />
                  </div>
                  <p className="text-lg font-semibold text-foreground">Hey there! 👋</p>
                  <p className="text-sm mt-2 max-w-md mx-auto">
                    I'm your AI assistant for co-curricular activities. I know about your {userRole === 'student' ? 'schedule, allocations, and attendance' : userRole === 'teacher' ? 'activities and student rosters' : 'system data and management tools'}.
                  </p>
                  <div className="mt-6 space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider">Quick questions</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {suggestions.map((suggestion) => (
                        <Button
                          key={suggestion}
                          variant="outline"
                          size="sm"
                          className="text-xs rounded-full hover:bg-primary/10 hover:border-primary/30 transition-colors"
                          onClick={() => sendMessage(suggestion)}
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div className="flex flex-col gap-1 max-w-[80%]">
                        <div
                          className={`rounded-2xl px-4 py-2.5 ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground rounded-tr-sm"
                              : "bg-muted rounded-tl-sm"
                          }`}
                        >
                          {msg.role === "assistant" ? (
                            <div className="text-sm prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                        <span className={`text-[10px] text-muted-foreground px-1 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                      {msg.role === "user" && (
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
                          <User className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  {isLoading && messages[messages.length - 1]?.role === "user" && (
                    <TypingIndicator />
                  )}
                </div>
              )}
            </ScrollArea>

            <div className="p-4 border-t bg-background/80 backdrop-blur-sm">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about activities, schedule, attendance..."
                  disabled={isLoading}
                  className="flex-1 rounded-full px-4"
                />
                <Button 
                  onClick={() => sendMessage()} 
                  disabled={isLoading || !input.trim()}
                  size="icon"
                  className="rounded-full shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ActivityChatbot;
