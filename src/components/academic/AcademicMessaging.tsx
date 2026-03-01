import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Hash, Megaphone, MessageCircle, Send, Trash2, ShieldCheck } from "lucide-react";

interface ClassGroup {
  id: string;
  name: string;
}

interface Message {
  id: string;
  class_group_id: string;
  sender_id: string;
  message_type: string;
  content: string;
  created_at: string;
  sender_name?: string;
  is_teacher?: boolean;
}

interface AcademicMessagingProps {
  classGroups: ClassGroup[];
  userId: string;
  isTeacher?: boolean;
  onGroupViewed?: (groupId: string) => void;
}

const AVATAR_COLORS = [
  "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500",
  "bg-teal-500", "bg-blue-500", "bg-violet-500", "bg-pink-500",
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}

function isNewGroup(msg: Message, prev: Message | undefined): boolean {
  if (!prev) return true;
  if (msg.sender_id !== prev.sender_id) return true;
  if (msg.message_type === "announcement" || prev.message_type === "announcement") return true;
  return new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000;
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function formatDateSeparator(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(dateStr, today.toISOString())) return "Today";
  if (isSameDay(dateStr, yesterday.toISOString())) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const AcademicMessaging = ({ classGroups, userId, isTeacher = false, onGroupViewed }: AcademicMessagingProps) => {
  const { toast } = useToast();
  const [selectedGroup, setSelectedGroup] = useState<string>(classGroups[0]?.id || "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [messageType, setMessageType] = useState<"announcement" | "discussion">("discussion");
  const [sending, setSending] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedGroup) return;
    fetchMessages();
    onGroupViewed?.(selectedGroup);

    const channel = supabase
      .channel(`academic-msg-${selectedGroup}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "academic_messages", filter: `class_group_id=eq.${selectedGroup}` },
        async (payload) => {
          const msg = payload.new as Message;
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", msg.sender_id)
            .single();
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, { ...msg, sender_name: profile?.full_name || "Unknown", is_teacher: false }];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "academic_messages", filter: `class_group_id=eq.${selectedGroup}` },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== (payload.old as Message).id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedGroup, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    const { data } = await (supabase as any)
      .from("academic_messages")
      .select("*")
      .eq("class_group_id", selectedGroup)
      .order("created_at", { ascending: true })
      .limit(200);

    if (data) {
      const senderIds = [...new Set(data.map((m: any) => m.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", senderIds as string[]);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
      setMessages(
        data.map((m: any) => ({
          ...m,
          sender_name: profileMap.get(m.sender_id) || "Unknown",
        }))
      );
    }
  };

  const handleSend = async () => {
    if (!content.trim() || !selectedGroup) return;
    setSending(true);
    try {
      const { error } = await (supabase as any).from("academic_messages").insert({
        class_group_id: selectedGroup,
        sender_id: userId,
        message_type: isTeacher ? messageType : "discussion",
        content: content.trim(),
      });
      if (error) throw error;
      setContent("");
    } catch {
      toast({ variant: "destructive", title: "Failed to send message" });
    } finally {
      setSending(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    const { error } = await (supabase as any).from("academic_messages").delete().eq("id", deleteTargetId);
    if (error) toast({ variant: "destructive", title: "Failed to delete message" });
    setDeleteTargetId(null);
  };

  if (classGroups.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <MessageCircle className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm font-medium">No class groups found</p>
          <p className="text-xs mt-1">Messages will appear once you're part of a class group.</p>
        </CardContent>
      </Card>
    );
  }

  const selectedName = classGroups.find(g => g.id === selectedGroup)?.name;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Hash className="h-5 w-5 text-primary" />
              Class Messages
            </CardTitle>
            {classGroups.length > 1 && (
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classGroups.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {classGroups.length === 1 && (
              <Badge variant="secondary">{selectedName}</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-0 px-4 pb-4">
          {/* Messages */}
          <div className="border rounded-xl bg-muted/20 h-[350px] overflow-y-auto px-3 py-2">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Hash className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm font-semibold">No messages yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Start the conversation.</p>
                </div>
              </div>
            ) : (
              <div className="pb-1">
                {messages.map((msg, idx) => {
                  const prev = idx > 0 ? messages[idx - 1] : undefined;
                  const showDateSep = !prev || !isSameDay(msg.created_at, prev.created_at);
                  const startGroup = isNewGroup(msg, prev);
                  const isOwn = msg.sender_id === userId;

                  return (
                    <div key={msg.id}>
                      {showDateSep && (
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-xs text-muted-foreground font-medium whitespace-nowrap px-2">
                            {formatDateSeparator(msg.created_at)}
                          </span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      )}

                      {msg.message_type === "announcement" ? (
                        <div className="my-2 rounded-lg border-l-4 border-primary bg-primary/5 p-3 flex gap-3 group">
                          <Megaphone className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-xs font-bold uppercase tracking-wider text-primary">Announcement</span>
                              <span className={`text-sm font-semibold ${isOwn ? "text-primary" : ""}`}>
                                {isOwn ? "You" : msg.sender_name}
                              </span>
                              {isOwn && isTeacher && (
                                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 h-4 px-1.5 py-0">
                                  <ShieldCheck className="h-2.5 w-2.5 mr-1" />Teacher
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">{formatTime(msg.created_at)}</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          </div>
                          {isOwn && (
                            <Button variant="ghost" size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 flex-shrink-0 self-start"
                              onClick={() => setDeleteTargetId(msg.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className={`group flex gap-3 px-2 py-0.5 rounded-md hover:bg-muted/50 ${startGroup ? "mt-4" : "mt-0.5"}`}>
                          <div className="w-9 flex-shrink-0 flex justify-center">
                            {startGroup ? (
                              <Avatar className="h-8 w-8 mt-0.5">
                                <AvatarFallback className={`text-white text-xs font-bold ${getAvatarColor(msg.sender_id)}`}>
                                  {getInitials(msg.sender_name || "?")}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <span className="text-[10px] text-transparent group-hover:text-muted-foreground/60 pt-1 select-none leading-none mt-1">
                                {formatTime(msg.created_at)}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            {startGroup && (
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <span className={`text-sm font-semibold ${isOwn ? "text-primary" : ""}`}>
                                  {isOwn ? "You" : msg.sender_name}
                                </span>
                                <span className="text-xs text-muted-foreground">{formatTime(msg.created_at)}</span>
                              </div>
                            )}
                            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                          </div>
                          {isOwn && (
                            <div className="opacity-0 group-hover:opacity-100 flex-shrink-0 self-start pt-0.5">
                              <Button variant="ghost" size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleteTargetId(msg.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Compose */}
          {isTeacher && (
            <div className="flex items-center gap-2 mb-2">
              <Select value={messageType} onValueChange={(v) => setMessageType(v as "announcement" | "discussion")}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="announcement">
                    <span className="flex items-center gap-1.5"><Megaphone className="h-3.5 w-3.5" />Announcement</span>
                  </SelectItem>
                  <SelectItem value="discussion">
                    <span className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" />Discussion</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-end gap-2 bg-muted/50 rounded-xl px-3 py-2 border border-border focus-within:border-primary/40 transition-colors">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Message #${selectedName || "..."}`}
              className="flex-1 min-h-[24px] max-h-[100px] resize-none bg-transparent border-0 shadow-none focus-visible:ring-0 p-0 text-sm"
              maxLength={1000}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button onClick={handleSend} disabled={sending || !content.trim()} size="icon" className="h-8 w-8 rounded-lg flex-shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTargetId} onOpenChange={(o) => { if (!o) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the message for everyone. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AcademicMessaging;
