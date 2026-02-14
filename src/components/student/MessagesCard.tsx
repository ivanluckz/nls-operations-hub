import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Megaphone, ArrowRight } from "lucide-react";

interface Message {
  id: string;
  activity_id: string;
  sender_id: string;
  message_type: string;
  content: string;
  created_at: string;
  sender_name?: string;
  activity_title?: string;
}

const MessagesCard = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentMessages();

    const channel = supabase
      .channel("student-messages-card")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_messages" },
        () => fetchRecentMessages()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchRecentMessages = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get student's activity IDs
      const { data: allocations } = await supabase
        .from("allocations")
        .select("activity_id, activities(title)")
        .eq("student_id", user.id);

      if (!allocations || allocations.length === 0) {
        setLoading(false);
        return;
      }

      const activityIds = [...new Set(allocations.map((a) => a.activity_id))];
      const activityMap = new Map(
        allocations.map((a) => [a.activity_id, (a.activities as any)?.title || ""])
      );

      const { data: msgs } = await supabase
        .from("activity_messages")
        .select("*")
        .in("activity_id", activityIds)
        .order("created_at", { ascending: false })
        .limit(5);

      if (msgs) {
        const senderIds = [...new Set(msgs.map((m) => m.sender_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", senderIds);

        const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) || []);

        setMessages(
          msgs.map((m) => ({
            ...m,
            sender_name: profileMap.get(m.sender_id) || "Unknown",
            activity_title: activityMap.get(m.activity_id) || "",
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  if (loading) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Messages
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate("/student/messages")}>
            View all <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No messages yet from your activity groups.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-3 items-start">
                <div className="mt-1">
                  {msg.message_type === "announcement" ? (
                    <Megaphone className="h-4 w-4 text-primary" />
                  ) : (
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{msg.sender_name}</span>
                    <Badge variant="outline" className="text-xs">{msg.activity_title}</Badge>
                    <span className="text-xs text-muted-foreground">{formatTime(msg.created_at)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MessagesCard;
