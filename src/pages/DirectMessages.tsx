import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ArrowLeft, Send, MessageSquare, Menu, Trash2 } from "lucide-react";

const AVATAR_COLORS = [
  "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500",
  "bg-teal-500", "bg-blue-500", "bg-violet-500", "bg-pink-500",
];
function hashId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}
function getAvatarColor(id: string) { return AVATAR_COLORS[hashId(id) % AVATAR_COLORS.length]; }
function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}
function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function formatDateSep(dateStr: string) {
  const today = new Date();
  const d = new Date(dateStr);
  if (d.toDateString() === today.toDateString()) return "Today";
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
function isSameDay(a: string, b: string) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

interface Conversation {
  channelId: string;
  otherId: string;
  otherName: string;
  lastMessage?: string;
  lastAt?: string;
  unread: number;
}

interface DM {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  senderName?: string;
}

const DirectMessages = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const [userId, setUserId] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DM[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedConvRef = useRef<Conversation | null>(null);

  useEffect(() => { selectedConvRef.current = selectedConv; }, [selectedConv]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Load conversations
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await loadConversations(user.id);

      // Handle ?user=&name= deep link from profile card
      const targetUserId = params.get("user");
      const targetName = params.get("name") || "Unknown";
      if (targetUserId && targetUserId !== user.id) {
        await openOrCreateDM(user.id, targetUserId, targetName);
      }
      setLoadingConvs(false);
    };
    init();
  }, []);

  // Realtime for new DMs
  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel("dm-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, async (payload) => {
        const msg = payload.new as DM;
        const conv = selectedConvRef.current;
        if (conv && msg.channel_id === conv.channelId) {
          const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", msg.sender_id).single();
          setMessages(prev => [...prev, { ...msg, senderName: profile?.full_name || "Unknown" }]);
        }
        // Refresh conversation list for unread counts
        await loadConversations(userId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const loadConversations = async (uid: string) => {
    const { data: channels } = await (supabase as any)
      .from("dm_channels")
      .select("id, user1_id, user2_id, created_at")
      .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
      .limit(50);

    if (!channels || channels.length === 0) return;

    const otherIds = channels.map(c => c.user1_id === uid ? c.user2_id : c.user1_id);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", otherIds);
    const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]));

    const convs: Conversation[] = await Promise.all(channels.map(async c => {
      const otherId = c.user1_id === uid ? c.user2_id : c.user1_id;
      const { data: lastMsgs } = await (supabase as any)
        .from("direct_messages")
        .select("content, created_at, sender_id")
        .eq("channel_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const last = lastMsgs?.[0];
      return {
        channelId: c.id,
        otherId,
        otherName: profileMap.get(otherId) || "Unknown",
        lastMessage: last?.content,
        lastAt: last?.created_at,
        unread: 0,
      };
    }));

    convs.sort((a, b) => (b.lastAt || "").localeCompare(a.lastAt || ""));
    setConversations(convs);
  };

  const openOrCreateDM = async (uid: string, otherId: string, otherName: string) => {
    // Try to find existing channel
    const { data: existing } = await (supabase as any)
      .from("dm_channels")
      .select("id")
      .or(`and(user1_id.eq.${uid},user2_id.eq.${otherId}),and(user1_id.eq.${otherId},user2_id.eq.${uid})`)
      .maybeSingle();

    let channelId = existing?.id;
    if (!channelId) {
      const { data: newChannel, error } = await (supabase as any)
        .from("dm_channels")
        .insert({ user1_id: uid, user2_id: otherId })
        .select("id")
        .single();
      if (error) { toast({ variant: "destructive", title: "Failed to open DM" }); return; }
      channelId = newChannel.id;
    }

    const conv: Conversation = { channelId, otherId, otherName, unread: 0 };
    setConversations(prev => {
      if (prev.find(c => c.channelId === channelId)) return prev;
      return [conv, ...prev];
    });
    await selectConversation(conv);
  };

  const selectConversation = async (conv: Conversation) => {
    setSelectedConv(conv);
    setSheetOpen(false);
    const { data } = await (supabase as any)
      .from("direct_messages")
      .select("*")
      .eq("channel_id", conv.channelId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (!data) return;

    const senderIds = [...new Set((data as any[]).map((m: any) => m.sender_id))] as string[];
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", senderIds);
    const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]));
    setMessages((data as any[]).map((m: any) => ({ ...m, senderName: profileMap.get(m.sender_id) || "Unknown" })));

    // Mark messages as read
    await (supabase as any)
      .from("direct_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("channel_id", conv.channelId)
      .neq("sender_id", userId)
      .is("read_at", null);
  };

  const sendMessage = async () => {
    if (!content.trim() || !selectedConv || sending) return;
    setSending(true);
    const text = content.trim();
    setContent("");
    const { error } = await (supabase as any).from("direct_messages").insert({
      channel_id: selectedConv.channelId,
      sender_id: userId,
      content: text,
    });
    if (error) toast({ variant: "destructive", title: "Failed to send" });
    setSending(false);
  };

  const deleteMessage = async (msgId: string) => {
    await (supabase as any).from("direct_messages").delete().eq("id", msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  const ConvList = () => (
    <div className="flex flex-col h-full">
      <div className="px-3 py-4 border-b flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate("/student/messages")}>
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Direct Messages</p>
      </div>
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">No conversations yet.<br/>Click a profile in chat to message someone.</p>
        )}
        {conversations.map(conv => (
          <button key={conv.channelId} onClick={() => selectConversation(conv)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left
              ${selectedConv?.channelId === conv.channelId ? "bg-primary/15 text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            <Avatar className={`h-7 w-7 shrink-0 ${getAvatarColor(conv.otherId)}`}>
              <AvatarFallback className={`text-white text-xs font-bold ${getAvatarColor(conv.otherId)}`}>
                {getInitials(conv.otherName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate text-xs">{conv.otherName}</p>
              {conv.lastMessage && (
                <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r bg-card/50">
        <ConvList />
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b bg-card/80 backdrop-blur">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-60 p-0">
              <ConvList />
            </SheetContent>
          </Sheet>

          {selectedConv ? (
            <>
              <Avatar className={`h-8 w-8 ${getAvatarColor(selectedConv.otherId)}`}>
                <AvatarFallback className={`text-white text-xs font-bold ${getAvatarColor(selectedConv.otherId)}`}>
                  {getInitials(selectedConv.otherName)}
                </AvatarFallback>
              </Avatar>
              <span className="font-semibold text-sm">{selectedConv.otherName}</span>
            </>
          ) : (
            <>
              <MessageSquare className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Direct Messages</span>
            </>
          )}

          <Button variant="ghost" size="icon" className="ml-auto h-8 w-8" onClick={() => navigate("/student/messages")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!selectedConv ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <MessageSquare className="h-12 w-12 opacity-20" />
              <p className="text-sm">Select a conversation or open a profile card to start a DM</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <p className="text-sm">No messages yet — say hi! 👋</p>
            </div>
          ) : (
            <div className="pb-2 space-y-0.5">
              {messages.map((msg, idx) => {
                const prev = idx > 0 ? messages[idx - 1] : undefined;
                const showDate = !prev || !isSameDay(msg.created_at, prev.created_at);
                const isOwn = msg.sender_id === userId;
                const startGroup = !prev || prev.sender_id !== msg.sender_id || showDate ||
                  new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000;

                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground">{formatDateSep(msg.created_at)}</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    )}
                    <div className={`group flex gap-3 px-2 py-0.5 rounded-md hover:bg-muted/40 ${startGroup ? "mt-4" : "mt-0.5"}`}>
                      <div className="w-9 flex-shrink-0 flex justify-center">
                        {startGroup ? (
                          <Avatar className={`h-8 w-8 mt-0.5 ${getAvatarColor(msg.sender_id)}`}>
                            <AvatarFallback className={`text-white text-xs font-bold ${getAvatarColor(msg.sender_id)}`}>
                              {getInitials(msg.senderName || "?")}
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
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-sm font-semibold ${isOwn ? "text-primary" : ""}`}>
                              {isOwn ? "You" : msg.senderName}
                            </span>
                            <span className="text-xs text-muted-foreground">{formatTime(msg.created_at)}</span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                      </div>
                      {isOwn && (
                        <div className="opacity-0 group-hover:opacity-100 flex-shrink-0 self-start pt-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteMessage(msg.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        {selectedConv && (
          <div className="flex-shrink-0 px-4 py-3 border-t bg-background">
            <div className="flex items-end gap-2 bg-muted/50 rounded-xl px-3 py-2 border border-border focus-within:border-primary/40 transition-colors">
              <Textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={`Message ${selectedConv.otherName}...`}
                className="flex-1 bg-transparent border-0 shadow-none resize-none p-0 min-h-[36px] max-h-32 focus-visible:ring-0 text-sm"
                rows={1}
              />
              <Button size="icon" className="h-8 w-8 rounded-lg flex-shrink-0" onClick={sendMessage} disabled={!content.trim() || sending}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 text-right">Enter to send · Shift+Enter for new line</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DirectMessages;
