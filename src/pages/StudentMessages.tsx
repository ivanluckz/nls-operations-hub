import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MessageCircle, Megaphone, Send } from "lucide-react";

interface Message {
  id: string;
  activity_id: string;
  sender_id: string;
  message_type: "announcement" | "discussion";
  content: string;
  created_at: string;
  sender_name?: string;
}

interface ActivityInfo {
  id: string;
  title: string;
}

const StudentMessages = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activities, setActivities] = useState<ActivityInfo[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: allocations } = await supabase
        .from("allocations")
        .select("activity_id, activities(id, title)")
        .eq("student_id", user.id);

      if (allocations) {
        const uniqueActivities = new Map<string, ActivityInfo>();
        allocations.forEach((a) => {
          const act = a.activities as any;
          if (act && !uniqueActivities.has(act.id)) {
            uniqueActivities.set(act.id, { id: act.id, title: act.title });
          }
        });
        const acts = Array.from(uniqueActivities.values());
        setActivities(acts);
        if (acts.length > 0) setSelectedActivity(acts[0].id);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!selectedActivity) return;
    fetchMessages();

    const channel = supabase
      .channel(`student-msgs-${selectedActivity}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_messages",
          filter: `activity_id=eq.${selectedActivity}`,
        },
        async (payload) => {
          const msg = payload.new as Message;
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", msg.sender_id)
            .single();
          msg.sender_name = profile?.full_name || "Unknown";
          setMessages((prev) => [...prev, msg]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedActivity]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("activity_messages")
      .select("*")
      .eq("activity_id", selectedActivity)
      .order("created_at", { ascending: true })
      .limit(200);

    if (data) {
      const senderIds = [...new Set(data.map((m) => m.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", senderIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) || []);
      setMessages(
        data.map((m) => ({
          ...m,
          message_type: m.message_type as "announcement" | "discussion",
          sender_name: profileMap.get(m.sender_id) || "Unknown",
        }))
      );
    }
  };

  const handleSend = async () => {
    if (!content.trim() || !selectedActivity) return;
    setSending(true);
    try {
      const { error } = await supabase.from("activity_messages").insert({
        activity_id: selectedActivity,
        sender_id: userId,
        message_type: "discussion" as const,
        content: content.trim(),
      });
      if (error) throw error;
      setContent("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast({ variant: "destructive", title: "Failed to send message" });
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/student")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Messages</h1>
            <p className="text-sm text-muted-foreground">Activity group conversations</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {activities.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              You have no activity allocations yet. Messages will appear once you're allocated.
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <Tabs value={selectedActivity} onValueChange={setSelectedActivity}>
                <TabsList className="w-full flex-wrap h-auto gap-1">
                  {activities.map((a) => (
                    <TabsTrigger key={a.id} value={a.id} className="text-xs">
                      {a.title}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Messages */}
              <div className="border rounded-lg h-[400px] overflow-y-auto p-3 space-y-3 bg-muted/30">
                {messages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-16">No messages yet.</p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-lg p-3 ${
                        msg.sender_id === userId
                          ? "bg-primary/10 ml-8"
                          : msg.message_type === "announcement"
                          ? "bg-primary/5 border border-primary/20"
                          : "bg-card border"
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {msg.sender_id === userId ? "You" : msg.sender_name}
                        </span>
                        {msg.message_type === "announcement" && (
                          <Badge variant="default" className="text-xs">
                            <Megaphone className="h-3 w-3 mr-1" />Announcement
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{formatTime(msg.created_at)}</span>
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Compose */}
              <div className="flex gap-2">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Type a message..."
                  className="min-h-[50px] resize-none"
                  maxLength={1000}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button
                  onClick={handleSend}
                  disabled={sending || !content.trim()}
                  size="icon"
                  className="h-auto"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default StudentMessages;
