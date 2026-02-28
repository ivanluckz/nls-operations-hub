import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RoleAvatar } from "@/components/ui/RoleAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Send, MessageSquare, Menu, Trash2, Plus, Search, Pencil, Check, X } from "lucide-react";

const REACT_EMOJIS = ['👍', '❤️', '😂', '🔥', '👀', '✅'];

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
  edited_at?: string | null;
  senderName?: string;
}

interface Reaction { emoji: string; count: number; mine: boolean; }

interface UserResult {
  id: string;
  full_name: string;
  email: string;
}

interface ConvListProps {
  conversations: Conversation[];
  selectedChannelId: string | null;
  onSelect: (conv: Conversation) => void;
  onBack: () => void;
  onNewDm: () => void;
  roles: Record<string, string>;
}

const ConvList = ({ conversations, selectedChannelId, onSelect, onBack, onNewDm, roles }: ConvListProps) => (
  <div className="flex flex-col h-full">
    <div className="px-3 py-4 border-b flex items-center gap-2">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
        <ArrowLeft className="h-3.5 w-3.5" />
      </Button>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1">Direct Messages</p>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNewDm} title="New DM">
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
    <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
      {conversations.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-8">
          No conversations yet.<br />
          Click <strong>+</strong> to start a new DM.
        </p>
      )}
      {conversations.map(conv => (
        <button key={conv.channelId} onClick={() => onSelect(conv)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left
            ${selectedChannelId === conv.channelId
              ? "bg-primary/15 text-foreground font-medium"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
          <RoleAvatar
            userId={conv.otherId}
            name={conv.otherName}
            isAdmin={roles[conv.otherId] === "admin"}
            isMod={roles[conv.otherId] === "teacher" || roles[conv.otherId] === "moderator"}
            avatarSize="h-7 w-7"
            textSize="text-[10px]"
          />
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

const DirectMessages = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { toast } = useToast();

  const [userId, setUserId] = useState("");
  const [myName, setMyName] = useState("");
  const myNameRef = useRef("");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DM[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);

  // New DM dialog
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  // Role map: userId → "admin" | "teacher" | "moderator" | "student"
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});

  // Reactions
  const [dmReactions, setDmReactions] = useState<Record<string, Reaction[]>>({});

  // Editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  // Typing indicator
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedConvRef = useRef<Conversation | null>(null);

  const isAdmin = location.pathname.startsWith("/admin");
  const backPath = isAdmin ? "/admin/messages" : "/student/messages";

  useEffect(() => { selectedConvRef.current = selectedConv; }, [selectedConv]);
  useEffect(() => { myNameRef.current = myName; }, [myName]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Init
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles").select("full_name").eq("id", user.id).single();
      const name = profile?.full_name || "";
      setMyName(name);
      myNameRef.current = name;

      await loadConversations(user.id);

      const targetUserId = params.get("user");
      const targetName = params.get("name") || "Unknown";
      if (targetUserId && targetUserId !== user.id) {
        await openOrCreateDM(user.id, targetUserId, targetName);
      }
      setLoadingConvs(false);
    };
    init();
  }, []);

  // Realtime: new messages
  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel("dm-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, async (payload) => {
        const msg = payload.new as DM;
        const conv = selectedConvRef.current;
        if (conv && msg.channel_id === conv.channelId) {
          const { data: p } = await supabase.from("profiles").select("full_name").eq("id", msg.sender_id).single();
          setMessages(prev => [...prev, { ...msg, senderName: p?.full_name || "Unknown" }]);
        }
        await loadConversations(userId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Typing channel — set up per conversation
  useEffect(() => {
    if (typingChannelRef.current) {
      supabase.removeChannel(typingChannelRef.current);
      typingChannelRef.current = null;
    }
    setTypingUser(null);
    if (!selectedConv || !userId) return;

    const ch = supabase
      .channel(`typing-${selectedConv.channelId}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId === userId) return;
        setTypingUser(payload.typing ? payload.name : null);
        clearTimeout(typingTimeoutRef.current);
        if (payload.typing) {
          typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
        }
      })
      .subscribe();

    typingChannelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      typingChannelRef.current = null;
    };
  }, [selectedConv?.channelId, userId]);

  // Broadcast typing as content changes
  useEffect(() => {
    if (!selectedConv || !userId) return;
    const broadcast = (isTyping: boolean) => {
      typingChannelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { userId, name: myNameRef.current || "Someone", typing: isTyping },
      });
    };
    if (content.trim()) {
      broadcast(true);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => broadcast(false), 2000);
    } else {
      broadcast(false);
      clearTimeout(typingTimeoutRef.current);
    }
  }, [content, selectedConv?.channelId]);

  const loadConversations = async (uid: string) => {
    const { data: channels } = await (supabase as any)
      .from("dm_channels")
      .select("id, user1_id, user2_id, created_at")
      .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
      .limit(50);

    if (!channels || channels.length === 0) { setConversations([]); return; }

    const otherIds = channels.map((c: any) => c.user1_id === uid ? c.user2_id : c.user1_id);
    const [{ data: profiles }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("id, full_name").in("id", otherIds),
      supabase.from("user_roles").select("user_id, role").in("user_id", otherIds),
    ]);

    // Build role map — admin takes precedence over teacher/moderator
    const roleMap: Record<string, string> = {};
    (roleRows || []).forEach((r: any) => {
      if (!roleMap[r.user_id] || r.role === "admin") roleMap[r.user_id] = r.role;
    });
    setUserRoles(prev => ({ ...prev, ...roleMap }));
    const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]));

    const convs: Conversation[] = await Promise.all(channels.map(async (c: any) => {
      const otherId = c.user1_id === uid ? c.user2_id : c.user1_id;
      const { data: lastMsgs } = await (supabase as any)
        .from("direct_messages")
        .select("content, created_at")
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
    const { data: ch1 } = await (supabase as any)
      .from("dm_channels").select("id").eq("user1_id", uid).eq("user2_id", otherId).maybeSingle();
    const { data: ch2 } = ch1 ? { data: null } : await (supabase as any)
      .from("dm_channels").select("id").eq("user1_id", otherId).eq("user2_id", uid).maybeSingle();
    const existing = ch1 || ch2;

    let channelId = existing?.id;
    if (!channelId) {
      const { data: newChannel, error } = await (supabase as any)
        .from("dm_channels")
        .insert({ user1_id: uid, user2_id: otherId })
        .select("id").single();
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
    setEditingId(null);
    setEditContent("");

    const { data } = await (supabase as any)
      .from("direct_messages")
      .select("*")
      .eq("channel_id", conv.channelId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (!data) return;

    const senderIds = [...new Set((data as any[]).map((m: any) => m.sender_id))] as string[];
    const [{ data: profiles }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("id, full_name").in("id", senderIds),
      supabase.from("user_roles").select("user_id, role").in("user_id", senderIds),
    ]);
    const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]));

    const roleMap: Record<string, string> = {};
    (roleRows || []).forEach((r: any) => {
      if (!roleMap[r.user_id] || r.role === "admin") roleMap[r.user_id] = r.role;
    });
    setUserRoles(prev => ({ ...prev, ...roleMap }));

    const msgs: DM[] = (data as any[]).map((m: any) => ({ ...m, senderName: profileMap.get(m.sender_id) || "Unknown" }));
    setMessages(msgs);

    // Load reactions for these messages
    const msgIds = msgs.map(m => m.id);
    if (msgIds.length > 0) {
      const { data: reactData } = await (supabase as any)
        .from("dm_message_reactions")
        .select("message_id, user_id, emoji")
        .in("message_id", msgIds);

      const uid = (await supabase.auth.getUser()).data.user?.id;
      const reactionMap: Record<string, Reaction[]> = {};
      (reactData || []).forEach((r: any) => {
        if (!reactionMap[r.message_id]) reactionMap[r.message_id] = [];
        const g = reactionMap[r.message_id].find(x => x.emoji === r.emoji);
        if (g) { g.count++; if (r.user_id === uid) g.mine = true; }
        else reactionMap[r.message_id].push({ emoji: r.emoji, count: 1, mine: r.user_id === uid });
      });
      setDmReactions(reactionMap);
    } else {
      setDmReactions({});
    }

    // Mark received messages as read
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
    setDmReactions(prev => { const n = { ...prev }; delete n[msgId]; return n; });
  };

  const saveEdit = async () => {
    if (!editingId || !editContent.trim()) return;
    const text = editContent.trim();
    const now = new Date().toISOString();
    const { error } = await (supabase as any)
      .from("direct_messages")
      .update({ content: text, edited_at: now })
      .eq("id", editingId)
      .eq("sender_id", userId);
    if (error) { toast({ variant: "destructive", title: "Failed to edit" }); return; }
    setMessages(prev => prev.map(m => m.id === editingId ? { ...m, content: text, edited_at: now } : m));
    setEditingId(null);
    setEditContent("");
  };

  const toggleDmReaction = async (messageId: string, emoji: string) => {
    const mine = dmReactions[messageId]?.find(r => r.emoji === emoji)?.mine;
    if (mine) {
      await (supabase as any).from("dm_message_reactions")
        .delete().eq("message_id", messageId).eq("user_id", userId).eq("emoji", emoji);
      setDmReactions(prev => ({
        ...prev,
        [messageId]: (prev[messageId] || [])
          .map(r => r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r)
          .filter(r => r.count > 0),
      }));
    } else {
      await (supabase as any).from("dm_message_reactions")
        .insert({ message_id: messageId, user_id: userId, emoji });
      setDmReactions(prev => {
        const existing = (prev[messageId] || []).find(r => r.emoji === emoji);
        return {
          ...prev,
          [messageId]: existing
            ? prev[messageId].map(r => r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r)
            : [...(prev[messageId] || []), { emoji, count: 1, mine: true }],
        };
      });
    }
  };

  const searchUsers = async (query: string) => {
    if (query.length < 2) { setUserResults([]); return; }
    setSearchingUsers(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);
      setUserResults((data || []).filter((u: UserResult) => u.id !== userId));
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingUsers(false);
    }
  };

  const startDM = async (user: UserResult) => {
    setNewDmOpen(false);
    setUserSearch("");
    setUserResults([]);
    await openOrCreateDM(userId, user.id, user.full_name);
  };

  const handleBack = useCallback(() => navigate(backPath), [navigate, backPath]);
  const handleNewDm = useCallback(() => { setNewDmOpen(true); setUserSearch(""); setUserResults([]); }, []);

  if (loadingConvs) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r bg-card/50">
        <ConvList
          conversations={conversations}
          selectedChannelId={selectedConv?.channelId ?? null}
          onSelect={selectConversation}
          onBack={handleBack}
          onNewDm={handleNewDm}
          roles={userRoles}
        />
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
              <ConvList
                conversations={conversations}
                selectedChannelId={selectedConv?.channelId ?? null}
                onSelect={selectConversation}
                onBack={handleBack}
                onNewDm={handleNewDm}
              />
            </SheetContent>
          </Sheet>

          {selectedConv ? (
            <>
              <RoleAvatar
                userId={selectedConv.otherId}
                name={selectedConv.otherName}
                isAdmin={userRoles[selectedConv.otherId] === "admin"}
                isMod={userRoles[selectedConv.otherId] === "teacher" || userRoles[selectedConv.otherId] === "moderator"}
                avatarSize="h-8 w-8"
              />
              <span className="font-semibold text-sm">{selectedConv.otherName}</span>
            </>
          ) : (
            <>
              <MessageSquare className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Direct Messages</span>
            </>
          )}

          <Button variant="ghost" size="icon" className="ml-auto h-8 w-8" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!selectedConv ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <MessageSquare className="h-12 w-12 opacity-20" />
              <p className="text-sm">Select a conversation or click <strong>+</strong> to start a new DM</p>
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
                const isEditing = editingId === msg.id;
                const msgReactions = dmReactions[msg.id] || [];

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
                      {/* Avatar / timestamp column */}
                      <div className="w-9 flex-shrink-0 flex justify-center">
                        {startGroup ? (
                          <RoleAvatar
                            userId={msg.sender_id}
                            name={msg.senderName || "?"}
                            isAdmin={userRoles[msg.sender_id] === "admin"}
                            isMod={userRoles[msg.sender_id] === "teacher" || userRoles[msg.sender_id] === "moderator"}
                            avatarSize="h-8 w-8"
                            className="mt-0.5"
                          />
                        ) : (
                          <span className="text-[10px] text-transparent group-hover:text-muted-foreground/60 pt-1 select-none leading-none mt-1">
                            {formatTime(msg.created_at)}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {startGroup && (
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-sm font-semibold ${isOwn ? "text-primary" : ""}`}>
                              {isOwn ? "You" : msg.senderName}
                            </span>
                            <span className="text-xs text-muted-foreground">{formatTime(msg.created_at)}</span>
                          </div>
                        )}

                        {/* Edit mode */}
                        {isEditing ? (
                          <div className="mt-1">
                            <Textarea
                              value={editContent}
                              onChange={e => setEditContent(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                                if (e.key === "Escape") { setEditingId(null); setEditContent(""); }
                              }}
                              className="text-sm min-h-[56px] max-h-40 resize-none"
                              autoFocus
                            />
                            <div className="flex items-center gap-2 mt-1.5">
                              <Button size="sm" className="h-6 text-xs gap-1 px-2" onClick={saveEdit} disabled={!editContent.trim()}>
                                <Check className="h-3 w-3" /> Save
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2"
                                onClick={() => { setEditingId(null); setEditContent(""); }}>
                                <X className="h-3 w-3" /> Cancel
                              </Button>
                              <span className="text-[10px] text-muted-foreground">esc · enter to save</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                            {msg.content}
                            {msg.edited_at && (
                              <span className="text-[10px] text-muted-foreground ml-1.5">(edited)</span>
                            )}
                          </p>
                        )}

                        {/* Reaction pills */}
                        {!isEditing && (
                          <div className="flex flex-wrap gap-1 mt-1 items-center min-h-0">
                            {msgReactions.map(r => (
                              <button key={r.emoji} onClick={() => toggleDmReaction(msg.id, r.emoji)}
                                className={`inline-flex items-center gap-1 rounded-full text-xs px-2 py-0.5 border transition-colors
                                  ${r.mine
                                    ? "border-primary/50 bg-primary/10 text-primary"
                                    : "border-border bg-muted/50 hover:bg-muted"}`}>
                                <span>{r.emoji}</span>
                                <span className="font-medium">{r.count}</span>
                              </button>
                            ))}
                            {/* Emoji picker */}
                            <div className="relative group/picker">
                              <button className="inline-flex items-center justify-center h-6 w-6 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors opacity-0 group-hover:opacity-100 text-sm">
                                +
                              </button>
                              <div className="absolute bottom-7 left-0 hidden group-hover/picker:flex bg-popover border rounded-lg shadow-lg p-1 gap-0.5 z-20">
                                {REACT_EMOJIS.map(e => (
                                  <button key={e} onClick={() => toggleDmReaction(msg.id, e)}
                                    className="h-7 w-7 rounded hover:bg-muted flex items-center justify-center text-base transition-colors">
                                    {e}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions (own messages only) */}
                      {isOwn && !isEditing && (
                        <div className="opacity-0 group-hover:opacity-100 flex-shrink-0 self-start pt-0.5 flex gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => { setEditingId(msg.id); setEditContent(msg.content); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
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

        {/* Typing indicator */}
        {typingUser && (
          <div className="px-6 py-1 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex gap-0.5 items-end">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span>{typingUser} is typing…</span>
          </div>
        )}

        {/* Input */}
        {selectedConv && (
          <div className="flex-shrink-0 px-4 py-3 border-t bg-background">
            <div className="flex items-end gap-2 bg-muted/50 rounded-xl px-3 py-2 border border-border focus-within:border-primary/40 transition-colors">
              <Textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                  if (e.key === "Escape" && editingId) { setEditingId(null); setEditContent(""); }
                }}
                placeholder={`Message ${selectedConv.otherName}...`}
                className="flex-1 bg-transparent border-0 shadow-none resize-none p-0 min-h-[36px] max-h-32 focus-visible:ring-0 text-sm"
                rows={1}
              />
              <Button size="icon" className="h-8 w-8 rounded-lg flex-shrink-0" onClick={sendMessage}
                disabled={!content.trim() || sending}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 text-right">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        )}
      </div>

      {/* New DM Dialog */}
      <Dialog open={newDmOpen} onOpenChange={setNewDmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Direct Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search by name or email…"
                value={userSearch}
                onChange={e => { setUserSearch(e.target.value); searchUsers(e.target.value); }}
                className="pl-9"
              />
            </div>
            {searchingUsers && <p className="text-sm text-muted-foreground text-center py-2">Searching…</p>}
            {userResults.length > 0 && (
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {userResults.map(u => (
                  <button key={u.id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left"
                    onClick={() => startDM(u)}>
                    <RoleAvatar
                      userId={u.id}
                      name={u.full_name}
                      isAdmin={userRoles[u.id] === "admin"}
                      isMod={userRoles[u.id] === "teacher" || userRoles[u.id] === "moderator"}
                      avatarSize="h-8 w-8"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{u.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {userSearch.length >= 2 && !searchingUsers && userResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">No users found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DirectMessages;
