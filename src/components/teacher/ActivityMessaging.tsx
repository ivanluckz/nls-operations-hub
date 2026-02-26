import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, MessageCircle, Send, Trash2 } from "lucide-react";

interface Activity {
  id: string;
  title: string;
}

interface Message {
  id: string;
  activity_id: string;
  sender_id: string;
  message_type: "announcement" | "discussion";
  content: string;
  created_at: string;
  sender_name?: string;
}

const ActivityMessaging = () => {
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [messageType, setMessageType] = useState<"announcement" | "discussion">("announcement");
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data } = await supabase
        .from("activities")
        .select("id, title")
        .eq("teacher_id", user.id)
        .order("title");

      setActivities(data || []);
      if (data && data.length > 0) {
        setSelectedActivity(data[0].id);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!selectedActivity) return;
    fetchMessages();

    const channel = supabase
      .channel(`messages-${selectedActivity}`)
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
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "activity_messages",
          filter: `activity_id=eq.${selectedActivity}`,
        },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as Message).id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      .limit(100);

    if (data) {
      const senderIds = [...new Set(data.map((m) => m.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", senderIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) || []);
      const enriched = data.map((m) => ({
        ...m,
        message_type: m.message_type as "announcement" | "discussion",
        sender_name: profileMap.get(m.sender_id) || "Unknown",
      }));
      setMessages(enriched);
    }
  };

  const handleSend = async () => {
    if (!content.trim() || !selectedActivity) return;
    setSending(true);
    try {
      const { error } = await supabase.from("activity_messages").insert({
        activity_id: selectedActivity,
        sender_id: userId,
        message_type: messageType,
        content: content.trim(),
      });

      if (error) throw error;
      setContent("");
      toast({ title: "Message sent!" });
    } catch (error) {
      console.error("Error sending message:", error);
      toast({ variant: "destructive", title: "Failed to send message" });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    const { error } = await supabase
      .from("activity_messages")
      .delete()
      .eq("id", messageId);

    if (error) {
      toast({ variant: "destructive", title: "Failed to delete message" });
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  if (activities.length === 0) {
    return (
      <Card className="shadow-card">
        <CardContent className="py-8 text-center text-muted-foreground">
          No activities assigned. Messages will appear once you have activities.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Activity Messages
          </CardTitle>
          <Select value={selectedActivity} onValueChange={setSelectedActivity}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select activity" />
            </SelectTrigger>
            <SelectContent>
              {activities.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Messages list */}
        <div className="border rounded-lg h-[350px] overflow-y-auto p-3 space-y-3 bg-muted/30">
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              No messages yet. Send the first one!
            </p>
          ) : (
            messages.map((msg) => {
              const isTeacher = msg.sender_id === userId;
              return (
              <div
                key={msg.id}
                className={`rounded-lg p-3 transition-all ${
                  isTeacher
                    ? "bg-gradient-to-br from-primary/15 to-primary/5 border-2 border-primary/30 shadow-md shadow-primary/10 ring-1 ring-primary/10"
                    : msg.message_type === "announcement"
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-card border"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium text-sm ${isTeacher ? "text-primary font-semibold" : ""}`}>{msg.sender_name}</span>
                    <Badge
                      variant={msg.message_type === "announcement" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {msg.message_type === "announcement" ? (
                        <><Megaphone className="h-3 w-3 mr-1" />Announcement</>
                      ) : (
                        "Discussion"
                      )}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatTime(msg.created_at)}</span>
                  </div>
                  {msg.sender_id === userId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(msg.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-sm mt-1 whitespace-pre-wrap">{msg.content}</p>
              </div>
              );
            })

          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Compose */}
        <div className="flex items-center gap-2">
          <Select
            value={messageType}
            onValueChange={(v) => setMessageType(v as "announcement" | "discussion")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="announcement">
                <span className="flex items-center gap-1"><Megaphone className="h-3 w-3" /> Announcement</span>
              </SelectItem>
              <SelectItem value="discussion">
                <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> Discussion</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={messageType === "announcement" ? "Write an announcement..." : "Start a discussion..."}
            className="min-h-[60px] resize-none"
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
  );
};

export default ActivityMessaging;
