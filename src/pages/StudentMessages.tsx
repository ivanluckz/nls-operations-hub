import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Hash, Menu, Send, Trash2, ShieldCheck, Megaphone, Award } from "lucide-react";

interface Message {
  id: string;
  activity_id: string;
  sender_id: string;
  message_type: "announcement" | "discussion";
  content: string;
  created_at: string;
  sender_name?: string;
  is_teacher?: boolean;
}

interface ActivityInfo {
  id: string;
  title: string;
  teacher_id: string | null;
}

const LAST_SEEN_KEY = "nls-chat-last-seen";

const AVATAR_COLORS = [
  "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500",
  "bg-teal-500", "bg-blue-500", "bg-violet-500", "bg-pink-500",
];

const BADGE_OPTIONS = [
  { name: "Growing", emoji: "🌱", desc: "Active and improving" },
  { name: "Star Student", emoji: "⭐", desc: "Outstanding performance" },
  { name: "Leader", emoji: "👑", desc: "Shows leadership" },
  { name: "On Fire", emoji: "🔥", desc: "Consistent effort" },
  { name: "Creative", emoji: "💡", desc: "Brings fresh ideas" },
  { name: "Team Player", emoji: "🤝", desc: "Great collaboration" },
];

function getLastSeen(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LAST_SEEN_KEY) || "{}"); } catch { return {}; }
}
function markSeen(activityId: string) {
  const seen = getLastSeen();
  seen[activityId] = new Date().toISOString();
  localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(seen));
}
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
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(dateStr, today.toISOString())) return "Today";
  if (isSameDay(dateStr, yesterday.toISOString())) return "Yesterday";
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}
function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [badgeOpen, setBadgeOpen] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<string>("");
  const [badgeReason, setBadgeReason] = useState("");
  const [targetAdminId, setTargetAdminId] = useState<string>("");
  const [submittingBadge, setSubmittingBadge] = useState(false);
  const [userBadges, setUserBadges] = useState<Record<string, string[]>>({});
  const [admins, setAdmins] = useState<{ id: string; full_name: string }[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const teacherIdsRef = useRef<Record<string, string | null>>({});
  const selectedActivityRef = useRef<string>("");
  const activityIdsRef = useRef<string[]>([]);

  useEffect(() => { selectedActivityRef.current = selectedActivity; }, [selectedActivity]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: allocations } = await supabase
        .from("allocations")
        .select("activity_id, activities(id, title, teacher_id)")
        .eq("student_id", user.id);

      if (!allocations) return;

      const uniqueActivities = new Map<string, ActivityInfo>();
      allocations.forEach((a) => {
        const act = a.activities as any;
        if (act && !uniqueActivities.has(act.id)) {
          uniqueActivities.set(act.id, { id: act.id, title: act.title, teacher_id: act.teacher_id });
        }
      });
      const acts = Array.from(uniqueActivities.values());
      setActivities(acts);
      acts.forEach(a => { teacherIdsRef.current[a.id] = a.teacher_id; });
      activityIdsRef.current = acts.map(a => a.id);

      if (acts.length > 0) { setSelectedActivity(acts[0].id); markSeen(acts[0].id); }

      // Fetch available admins for badge requests
      const { data: adminRoles } = await supabase
        .from("user_roles").select("user_id").eq("role", "admin");
      if (adminRoles && adminRoles.length > 0) {
        const adminIds = adminRoles.map(r => r.user_id);
        const { data: adminProfiles } = await supabase
          .from("profiles").select("id, full_name").in("id", adminIds);
        if (adminProfiles) setAdmins(adminProfiles);
      }

      const lastSeen = getLastSeen();
      const counts: Record<string, number> = {};
      await Promise.all(acts.map(async (a) => {
        const since = lastSeen[a.id] || new Date(0).toISOString();
        const { count } = await supabase
          .from("activity_messages").select("*", { count: "exact", head: true })
          .eq("activity_id", a.id).gt("created_at", since);
        counts[a.id] = count || 0;
      }));
      setUnreadCounts(counts);
    };
    init();
  }, []);

  useEffect(() => {
    if (!selectedActivity) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("activity_messages").select("*")
        .eq("activity_id", selectedActivity)
        .order("created_at", { ascending: true }).limit(200);
      if (!data) return;

      const senderIds = [...new Set(data.map(m => m.sender_id))];
      const [profilesRes, badgesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", senderIds),
        supabase.from("user_badges").select("user_id, badge_name").in("user_id", senderIds),
      ]);

      const profileMap = new Map(profilesRes.data?.map(p => [p.id, p.full_name]) || []);
      const badgeMap: Record<string, string[]> = {};
      badgesRes.data?.forEach(b => {
        if (!badgeMap[b.user_id]) badgeMap[b.user_id] = [];
        badgeMap[b.user_id].push(b.badge_name);
      });
      setUserBadges(prev => ({ ...prev, ...badgeMap }));

      const teacherId = teacherIdsRef.current[selectedActivity];
      setMessages(data.map(m => ({
        ...m,
        message_type: m.message_type as "announcement" | "discussion",
        sender_name: profileMap.get(m.sender_id) || "Unknown",
        is_teacher: m.sender_id === teacherId,
      })));
    };
    fetchMessages();
  }, [selectedActivity]);

  useEffect(() => {
    if (activities.length === 0) return;
    const channel = supabase.channel("student-msgs-all")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_messages" }, async (payload) => {
        const msg = payload.new as Message;
        if (!activityIdsRef.current.includes(msg.activity_id)) return;
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", msg.sender_id).single();
        const enriched: Message = {
          ...msg,
          message_type: msg.message_type as "announcement" | "discussion",
          sender_name: profile?.full_name || "Unknown",
          is_teacher: msg.sender_id === teacherIdsRef.current[msg.activity_id],
        };
        if (msg.activity_id === selectedActivityRef.current) {
          setMessages(prev => [...prev, enriched]);
        } else {
          setUnreadCounts(prev => ({ ...prev, [msg.activity_id]: (prev[msg.activity_id] || 0) + 1 }));
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "activity_messages" }, (payload) => {
        const old = payload.old as Message;
        if (old.activity_id === selectedActivityRef.current) {
          setMessages(prev => prev.filter(m => m.id !== old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activities]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const selectActivity = (activityId: string) => {
    setSelectedActivity(activityId);
    markSeen(activityId);
    setUnreadCounts(prev => ({ ...prev, [activityId]: 0 }));
    setSheetOpen(false);
  };

  const handleSend = async () => {
    if (!content.trim() || !selectedActivity) return;
    setSending(true);
    try {
      const { error } = await supabase.from("activity_messages").insert({
        activity_id: selectedActivity, sender_id: userId,
        message_type: "discussion" as const, content: content.trim(),
      });
      if (error) throw error;
      setContent("");
    } catch { toast({ variant: "destructive", title: "Failed to send message" }); }
    finally { setSending(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    const { error } = await supabase.from("activity_messages").delete().eq("id", deleteTargetId);
    if (error) toast({ variant: "destructive", title: "Failed to delete message" });
    setDeleteTargetId(null);
  };

  const handleBadgeRequest = async () => {
    if (!selectedBadge || !badgeReason.trim()) return;
    setSubmittingBadge(true);
    try {
      const { error } = await supabase.from("badge_requests").insert({
        student_id: userId,
        badge_name: selectedBadge,
        reason: badgeReason.trim(),
        target_admin_id: targetAdminId || null,
      });
      if (error) throw error;
      toast({ title: "Badge request sent!", description: "The admin will review your request." });
      setBadgeOpen(false); setSelectedBadge(""); setBadgeReason(""); setTargetAdminId("");
    } catch { toast({ variant: "destructive", title: "Failed to submit request" }); }
    finally { setSubmittingBadge(false); }
  };

  const selectedActivityInfo = activities.find(a => a.id === selectedActivity);
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  const ChannelList = () => (
    <div className="flex flex-col h-full">
      <div className="px-3 py-4 border-b">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Channels</p>
      </div>
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
        {activities.map((a) => (
          <button key={a.id} onClick={() => selectActivity(a.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left ${
              selectedActivity === a.id ? "bg-primary/15 text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Hash className="h-4 w-4 flex-shrink-0 opacity-70" />
            <span className="flex-1 truncate">{a.title}</span>
            {unreadCounts[a.id] > 0 && (
              <Badge className="h-5 min-w-[20px] text-xs px-1.5 bg-primary text-primary-foreground rounded-full">
                {unreadCounts[a.id] > 99 ? "99+" : unreadCounts[a.id]}
              </Badge>
            )}
          </button>
        ))}
      </div>
      <div className="px-3 py-3 border-t">
        <Button variant="outline" size="sm" className="w-full text-xs gap-1.5"
          onClick={() => { setBadgeOpen(true); setSheetOpen(false); }}>
          <Award className="h-3.5 w-3.5" /> Request a Badge
        </Button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="border-b bg-card shadow-sm flex-shrink-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/student")} className="flex-shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden flex-shrink-0 relative">
                <Menu className="h-5 w-5" />
                {totalUnread > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center font-semibold">
                    {totalUnread > 9 ? "9+" : totalUnread}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0"><ChannelList /></SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Hash className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <h1 className="text-base font-semibold truncate">{selectedActivityInfo?.title || "Activity Messages"}</h1>
          </div>
          <Button variant="outline" size="sm" className="hidden md:flex items-center gap-1.5 text-xs" onClick={() => setBadgeOpen(true)}>
            <Award className="h-3.5 w-3.5" /> Request Badge
          </Button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:flex w-60 border-r bg-muted/20 flex-col flex-shrink-0">
          <ChannelList />
        </aside>

        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          {activities.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-4">
                <Hash className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-semibold text-lg">No activities yet</p>
                <p className="text-sm text-muted-foreground mt-1">Messages appear once you're allocated.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-2">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full min-h-[200px]">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                        <Hash className="h-8 w-8 text-primary/50" />
                      </div>
                      <p className="font-semibold text-lg">Welcome to #{selectedActivityInfo?.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">This is the beginning of the conversation.</p>
                    </div>
                  </div>
                ) : (
                  <div className="pb-2">
                    {messages.map((msg, idx) => {
                      const prev = idx > 0 ? messages[idx - 1] : undefined;
                      const showDateSep = !prev || !isSameDay(msg.created_at, prev.created_at);
                      const startGroup = isNewGroup(msg, prev);
                      const isOwn = msg.sender_id === userId;
                      const senderBadges = userBadges[msg.sender_id] || [];

                      return (
                        <div key={msg.id}>
                          {showDateSep && (
                            <div className="flex items-center gap-3 my-5">
                              <div className="flex-1 h-px bg-border" />
                              <span className="text-xs text-muted-foreground font-medium whitespace-nowrap px-2">
                                {formatDateSeparator(msg.created_at)}
                              </span>
                              <div className="flex-1 h-px bg-border" />
                            </div>
                          )}

                          {msg.message_type === "announcement" ? (
                            <div className="my-3 rounded-lg border-l-4 border-primary bg-primary/5 p-3 flex gap-3 group">
                              <Megaphone className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="text-xs font-bold uppercase tracking-wider text-primary">Announcement</span>
                                  <span className={`text-sm font-semibold ${msg.is_teacher ? "text-primary" : ""}`}>
                                    {isOwn ? "You" : msg.sender_name}
                                  </span>
                                  {msg.is_teacher && (
                                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 h-4 px-1.5 py-0">
                                      <ShieldCheck className="h-2.5 w-2.5 mr-1" />Supervisor
                                    </Badge>
                                  )}
                                  {senderBadges.map(b => {
                                    const opt = BADGE_OPTIONS.find(o => o.name === b);
                                    return opt ? <span key={b} title={b} className="text-sm">{opt.emoji}</span> : null;
                                  })}
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
                            <div className={`group flex gap-3 px-2 py-0.5 rounded-md hover:bg-muted/40 ${startGroup ? "mt-4" : "mt-0.5"}`}>
                              <div className="w-10 flex-shrink-0 flex justify-center">
                                {startGroup ? (
                                  <Avatar className="h-9 w-9 mt-0.5">
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
                                    <span className={`text-sm font-semibold ${msg.is_teacher ? "text-primary" : ""}`}>
                                      {isOwn ? "You" : msg.sender_name}
                                    </span>
                                    {msg.is_teacher && (
                                      <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 h-4 px-1.5 py-0">
                                        <ShieldCheck className="h-2.5 w-2.5 mr-1" />Supervisor
                                      </Badge>
                                    )}
                                    {senderBadges.map(b => {
                                      const opt = BADGE_OPTIONS.find(o => o.name === b);
                                      return opt ? <span key={b} title={b} className="text-base leading-none">{opt.emoji}</span> : null;
                                    })}
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

              <div className="flex-shrink-0 px-4 py-3 border-t bg-background">
                <div className="flex items-end gap-2 bg-muted/50 rounded-xl px-3 py-2 border border-border focus-within:border-primary/40 transition-colors">
                  <Textarea value={content} onChange={(e) => setContent(e.target.value)}
                    placeholder={`Message #${selectedActivityInfo?.title || "..."}`}
                    className="flex-1 min-h-[24px] max-h-[120px] resize-none bg-transparent border-0 shadow-none focus-visible:ring-0 p-0 text-sm"
                    maxLength={1000}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  />
                  <Button onClick={handleSend} disabled={sending || !content.trim()} size="icon" className="h-8 w-8 rounded-lg flex-shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 px-1">
                  <kbd className="font-mono">Enter</kbd> to send · <kbd className="font-mono">Shift+Enter</kbd> for new line
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirm Delete */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(o) => { if (!o) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the message for everyone in the channel. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Badge Request */}
      <Dialog open={badgeOpen} onOpenChange={setBadgeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" /> Request a Badge
            </DialogTitle>
            <DialogDescription>
              Choose a badge and tell an admin why you deserve it. They'll review and approve or decline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              {BADGE_OPTIONS.map((badge) => (
                <button key={badge.name} onClick={() => setSelectedBadge(badge.name)}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                    selectedBadge === badge.name
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  }`}
                >
                  <span className="text-xl">{badge.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{badge.name}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{badge.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>Send request to</Label>
              <Select value={targetAdminId} onValueChange={setTargetAdminId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an admin..." />
                </SelectTrigger>
                <SelectContent>
                  {admins.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="badge-reason">Why do you deserve this badge?</Label>
              <Textarea id="badge-reason" value={badgeReason} onChange={(e) => setBadgeReason(e.target.value)}
                placeholder="Explain your reason..." className="resize-none" rows={3} maxLength={500} />
              <p className="text-xs text-muted-foreground text-right">{badgeReason.length}/500</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBadgeOpen(false)}>Cancel</Button>
            <Button onClick={handleBadgeRequest} disabled={submittingBadge || !selectedBadge || !badgeReason.trim() || !targetAdminId}>
              {submittingBadge ? "Sending..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentMessages;
