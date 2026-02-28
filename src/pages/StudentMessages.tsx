import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RoleAvatar } from "@/components/ui/RoleAvatar";
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
import { Input } from "@/components/ui/input";
import { ArrowLeft, Hash, Menu, Send, Trash2, ShieldCheck, Megaphone, Award, Crown, MessageSquare, Trophy } from "lucide-react";
import { UserProfileCard } from "@/components/chat/UserProfileCard";
import devBadge from "@/assets/dev.png";
import { devNameClass, devMsgClass, isDevUser } from "@/lib/dev-badge";

const REACT_EMOJIS = ['👍', '❤️', '😂', '🔥', '👀', '✅'];

function renderContent(text: string, myFirstName: string): React.ReactNode {
  const parts = text.split(/(@\S+)/g);
  if (parts.length <= 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className={`font-medium ${
            myFirstName && part.slice(1).toLowerCase().startsWith(myFirstName.toLowerCase())
              ? 'bg-primary/20 text-primary rounded px-0.5'
              : 'text-primary/80'
          }`}>{part}</span>
        ) : <span key={i}>{part}</span>
      )}
    </>
  );
}

interface Message {
  id: string;
  activity_id: string;
  sender_id: string;
  message_type: "announcement" | "discussion";
  content: string;
  created_at: string;
  sender_name?: string;
  is_teacher?: boolean;
  is_admin?: boolean;
}

interface ActivityInfo {
  id: string;
  title: string;
  teacher_id: string | null;
}

const LAST_SEEN_KEY = "nls-chat-last-seen";


const BADGE_OPTIONS: { name: string; emoji: string; desc: string; animClass: string; img?: string }[] = [
  { name: "Growing",      emoji: "🌱", desc: "Active and improving",    animClass: "badge-anim-grow"  },
  { name: "Star Student", emoji: "⭐", desc: "Outstanding performance", animClass: "badge-anim-star"  },
  { name: "Leader",       emoji: "👑", desc: "Shows leadership",        animClass: "badge-anim-crown" },
  { name: "On Fire",      emoji: "🔥", desc: "Consistent effort",       animClass: "badge-anim-fire"  },
  { name: "Creative",     emoji: "💡", desc: "Brings fresh ideas",      animClass: "badge-anim-bulb"  },
  { name: "Team Player",  emoji: "🤝", desc: "Great collaboration",     animClass: "badge-anim-team"  },
  { name: "Dev",          emoji: "",   desc: "Exclusive developer badge", animClass: "", img: devBadge },
];

function getLastSeen(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LAST_SEEN_KEY) || "{}"); } catch { return {}; }
}
function markSeen(activityId: string) {
  const seen = getLastSeen();
  seen[activityId] = new Date().toISOString();
  localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(seen));
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
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [submittingBadge, setSubmittingBadge] = useState(false);
  const [userBadges, setUserBadges] = useState<Record<string, string[]>>({});
  const [myBadges, setMyBadges] = useState<string[]>([]);
  const [profileCard, setProfileCard] = useState<{
    senderId: string; senderName: string; isAdmin: boolean; isTeacher: boolean;
  } | null>(null);
  const [reactions, setReactions] = useState<Record<string, { emoji: string; count: number; mine: boolean }[]>>({});
  const [activeView, setActiveView] = useState<"channels" | "announcements">("channels");
  const [allAnnouncements, setAllAnnouncements] = useState<Message[]>([]);
  const [activityMembers, setActivityMembers] = useState<{ id: string; name: string }[]>([]);
  const [myName, setMyName] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const teacherIdsRef = useRef<Record<string, string | null>>({});
  const selectedActivityRef = useRef<string>("");
  const activityIdsRef = useRef<string[]>([]);
  const adminIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => { selectedActivityRef.current = selectedActivity; }, [selectedActivity]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: myProfile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      if (myProfile?.full_name) setMyName(myProfile.full_name.split(" ")[0]);

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

      const [{ data: adminRoles }, { data: myBadgeData }] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("role", "admin").limit(100),
        (supabase as any).from("user_badges").select("badge_name").eq("user_id", user.id),
      ]);
      adminRoles?.forEach(r => adminIdsRef.current.add(r.user_id));
      setMyBadges((myBadgeData || []).map((b: any) => b.badge_name));

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
        (supabase as any).from("user_badges").select("user_id, badge_name").in("user_id", senderIds),
      ]);

      const profileMap = new Map(profilesRes.data?.map(p => [p.id, p.full_name]) || []);
      const badgeMap: Record<string, string[]> = {};
      badgesRes.data?.forEach(b => {
        if (!badgeMap[b.user_id]) badgeMap[b.user_id] = [];
        badgeMap[b.user_id].push(b.badge_name);
      });
      setUserBadges(prev => ({ ...prev, ...badgeMap }));

      const teacherId = teacherIdsRef.current[selectedActivity];
      const enriched = data.map(m => ({
        ...m,
        message_type: m.message_type as "announcement" | "discussion",
        sender_name: profileMap.get(m.sender_id) || "Unknown",
        is_teacher: m.sender_id === teacherId,
        is_admin: adminIdsRef.current.has(m.sender_id),
      }));
      setMessages(enriched);

      // Load reactions for these messages
      const { data: reactData } = await (supabase as any)
        .from("message_reactions")
        .select("message_id, user_id, emoji")
        .in("message_id", data.map(m => m.id));
      const { data: { user: me } } = await supabase.auth.getUser();
      const reactionMap: Record<string, { emoji: string; count: number; mine: boolean }[]> = {};
      (reactData || []).forEach(r => {
        if (!reactionMap[r.message_id]) reactionMap[r.message_id] = [];
        const g = reactionMap[r.message_id].find(x => x.emoji === r.emoji);
        if (g) { g.count++; if (r.user_id === me?.id) g.mine = true; }
        else reactionMap[r.message_id].push({ emoji: r.emoji, count: 1, mine: r.user_id === me?.id });
      });
      setReactions(reactionMap);

      // Load activity members for @mentions
      const { data: memberAllocs } = await supabase
        .from("allocations").select("profiles(id, full_name)").eq("activity_id", selectedActivity).limit(100);
      const members = (memberAllocs || []).map((a: any) => a.profiles).filter(Boolean)
        .map((p: any) => ({ id: p.id, name: p.full_name }));
      setActivityMembers(members);
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
          is_admin: adminIdsRef.current.has(msg.sender_id),
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reactions" }, (payload) => {
        const r = payload.new as { message_id: string; user_id: string; emoji: string };
        setReactions(prev => {
          const ex = [...(prev[r.message_id] || [])];
          const idx = ex.findIndex(x => x.emoji === r.emoji);
          if (idx >= 0) ex[idx] = { ...ex[idx], count: ex[idx].count + 1 };
          else ex.push({ emoji: r.emoji, count: 1, mine: false });
          return { ...prev, [r.message_id]: ex };
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "message_reactions" }, (payload) => {
        const r = payload.old as { message_id: string; emoji: string };
        setReactions(prev => {
          const ex = [...(prev[r.message_id] || [])].map(x =>
            x.emoji === r.emoji ? { ...x, count: Math.max(0, x.count - 1) } : x
          ).filter(x => x.count > 0);
          return { ...prev, [r.message_id]: ex };
        });
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
    const isDev = isDevUser(myBadges);

    // Dev users bypass approval — auto-grant immediately
    if (isDev) {
      setSubmittingBadge(true);
      try {
        const { error: badgeError } = await (supabase as any)
          .from("user_badges")
          .upsert({ user_id: userId, badge_name: selectedBadge, awarded_by: userId }, { onConflict: "user_id,badge_name" });
        if (badgeError) throw badgeError;

        // Still create a record for audit, auto-approved
        await (supabase as any).from("badge_requests").insert({
          student_id: userId, badge_name: selectedBadge, reason: badgeReason.trim(),
          status: "approved", reviewed_by: userId, reviewed_at: new Date().toISOString(),
        });

        toast({ title: "⚡ Badge auto-granted!", description: `Dev perk: ${selectedBadge} badge awarded instantly.` });
        setMyBadges(prev => prev.includes(selectedBadge) ? prev : [...prev, selectedBadge]);
        setBadgeOpen(false); setSelectedBadge(""); setBadgeReason("");
      } catch { toast({ variant: "destructive", title: "Failed to grant badge" }); }
      finally { setSubmittingBadge(false); }
      return;
    }

    if (!adminEmail.trim()) return;
    setSubmittingBadge(true);
    try {
      // Look up admin by email
      const { data: adminProfile } = await supabase
        .from("profiles").select("id").eq("email", adminEmail.trim().toLowerCase()).single();
      if (!adminProfile) {
        toast({ variant: "destructive", title: "Admin not found", description: "No user found with that email." });
        return;
      }
      // Verify they're an admin
      const { data: adminRole } = await supabase
        .from("user_roles").select("user_id").eq("user_id", adminProfile.id).eq("role", "admin").single();
      if (!adminRole) {
        toast({ variant: "destructive", title: "Not an admin", description: "That email doesn't belong to an admin." });
        return;
      }
      const { error } = await (supabase as any).from("badge_requests").insert({
        student_id: userId,
        badge_name: selectedBadge,
        reason: badgeReason.trim(),
        target_admin_id: adminProfile.id,
      });
      if (error) throw error;
      toast({ title: "Badge request sent!", description: "The admin will review your request." });
      setBadgeOpen(false); setSelectedBadge(""); setBadgeReason(""); setAdminEmail("");
    } catch { toast({ variant: "destructive", title: "Failed to submit request" }); }
    finally { setSubmittingBadge(false); }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    const mine = reactions[messageId]?.find(r => r.emoji === emoji)?.mine;
    if (mine) {
      await (supabase as any).from("message_reactions").delete().eq("message_id", messageId).eq("user_id", userId).eq("emoji", emoji);
      setReactions(prev => {
        const ex = [...(prev[messageId] || [])].map(x =>
          x.emoji === emoji ? { ...x, count: Math.max(0, x.count - 1), mine: false } : x
        ).filter(x => x.count > 0);
        return { ...prev, [messageId]: ex };
      });
    } else {
      await (supabase as any).from("message_reactions").insert({ message_id: messageId, user_id: userId, emoji });
      setReactions(prev => {
        const ex = [...(prev[messageId] || [])];
        const idx = ex.findIndex(x => x.emoji === emoji);
        if (idx >= 0) ex[idx] = { ...ex[idx], count: ex[idx].count + 1, mine: true };
        else ex.push({ emoji, count: 1, mine: true });
        return { ...prev, [messageId]: ex };
      });
    }
  };

  const fetchAnnouncements = async () => {
    if (activityIdsRef.current.length === 0) return;
    const { data } = await supabase.from("activity_messages").select("*")
      .in("activity_id", activityIdsRef.current).eq("message_type", "announcement")
      .order("created_at", { ascending: false }).limit(100);
    if (!data) return;
    const sids = [...new Set(data.map(m => m.sender_id))];
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", sids);
    const pm = new Map((profiles || []).map(p => [p.id, p.full_name]));
    setAllAnnouncements(data.map(m => ({
      ...m,
      message_type: "announcement" as const,
      sender_name: pm.get(m.sender_id) || "Unknown",
      is_admin: adminIdsRef.current.has(m.sender_id),
      is_teacher: m.sender_id === teacherIdsRef.current[m.activity_id],
    })));
  };

  const mentionMatch = content.match(/@(\w+)$/);
  const mentionQuery = mentionMatch ? mentionMatch[1].toLowerCase() : null;
  const filteredMentions = mentionQuery !== null
    ? activityMembers.filter(m => m.name.toLowerCase().startsWith(mentionQuery) && m.id !== userId).slice(0, 5)
    : [];
  const insertMention = (name: string) => setContent(c => c.replace(/@\w+$/, `@${name} `));

  const selectedActivityInfo = activities.find(a => a.id === selectedActivity);
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  const ChannelList = () => (
    <div className="flex flex-col h-full">
      <div className="px-3 py-4 border-b">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Channels</p>
      </div>
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
        {/* All Announcements feed */}
        <button onClick={() => { setActiveView("announcements"); fetchAnnouncements(); setSheetOpen(false); }}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left
            ${activeView === "announcements" ? "bg-primary/15 text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
          <Megaphone className="h-4 w-4 flex-shrink-0 opacity-70" />
          <span className="flex-1 truncate">All Announcements</span>
        </button>
        <div className="h-px bg-border mx-1 my-1" />
        {activities.map((a) => (
          <button key={a.id} onClick={() => { selectActivity(a.id); setActiveView("channels"); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left ${
              activeView === "channels" && selectedActivity === a.id ? "bg-primary/15 text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
      <div className="px-3 py-3 border-t space-y-2">
        <Button variant="outline" size="sm" className="w-full text-xs gap-1.5"
          onClick={() => navigate("/student/dms")}>
          <MessageSquare className="h-3.5 w-3.5" /> Direct Messages
        </Button>
        <Button variant="outline" size="sm" className="w-full text-xs gap-1.5"
          onClick={() => navigate("/student/leaderboard")}>
          <Trophy className="h-3.5 w-3.5" /> Leaderboard
        </Button>
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
            {activeView === "announcements"
              ? <Megaphone className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              : <Hash className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
            <h1 className="text-base font-semibold truncate">
              {activeView === "announcements" ? "All Announcements" : (selectedActivityInfo?.title || "Activity Messages")}
            </h1>
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
          ) : activeView === "announcements" ? (
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {allAnnouncements.length === 0 ? (
                <div className="flex items-center justify-center h-full min-h-[200px] text-center">
                  <div>
                    <Megaphone className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No announcements yet.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pb-4">
                  {allAnnouncements.map(msg => {
                    const actTitle = activities.find(a => a.id === msg.activity_id)?.title;
                    return (
                      <div key={msg.id} className={`rounded-lg border-l-4 ${msg.is_admin ? "border-amber-500 bg-amber-500/5" : "border-primary bg-primary/5"} p-3`}>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-xs font-bold uppercase tracking-wider ${msg.is_admin ? "text-amber-500" : "text-primary"}`}>
                            {actTitle || "Activity"}
                          </span>
                          <span className={`text-sm font-semibold ${msg.is_admin ? "text-amber-500" : msg.is_teacher ? "text-primary" : ""}`}>
                            {msg.sender_name}
                          </span>
                          {msg.is_admin && <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30 h-4 px-1.5 py-0"><Crown className="h-2.5 w-2.5 mr-1" />Admin</Badge>}
                          {!msg.is_admin && msg.is_teacher && <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 h-4 px-1.5 py-0"><ShieldCheck className="h-2.5 w-2.5 mr-1" />Supervisor</Badge>}
                          <span className="text-xs text-muted-foreground ml-auto">{formatTime(msg.created_at)}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                    );
                  })}
                </div>
              )}
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
                            <div className={`my-3 rounded-lg border-l-4 ${msg.is_admin ? "border-amber-500 bg-amber-500/5" : "border-primary bg-primary/5"} p-3 flex gap-3 group`}>
                              <Megaphone className={`h-5 w-5 flex-shrink-0 mt-0.5 ${msg.is_admin ? "text-amber-500" : "text-primary"}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className={`text-xs font-bold uppercase tracking-wider ${msg.is_admin ? "text-amber-500" : "text-primary"}`}>Announcement</span>
                                  <button
                                    className={`text-sm font-semibold ${msg.is_admin ? "text-amber-500" : msg.is_teacher ? "text-primary" : ""} ${!isOwn ? "hover:underline cursor-pointer" : ""}`}
                                    onClick={() => setProfileCard({ senderId: msg.sender_id, senderName: msg.sender_name || "", isAdmin: !!msg.is_admin, isTeacher: !!msg.is_teacher })}
                                   >
                                     {isOwn ? "You" : msg.sender_name}
                                   </button>
                                  {msg.is_admin && (
                                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30 h-4 px-1.5 py-0">
                                      <Crown className="h-2.5 w-2.5 mr-1" />Admin
                                    </Badge>
                                  )}
                                  {!msg.is_admin && msg.is_teacher && (
                                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 h-4 px-1.5 py-0">
                                      <ShieldCheck className="h-2.5 w-2.5 mr-1" />Supervisor
                                    </Badge>
                                  )}
                                  {senderBadges.map(b => {
                                    const opt = BADGE_OPTIONS.find(o => o.name === b);
                                    if (!opt) return null;
return opt.img ? <img key={b} src={opt.img} title={b} className="h-4 w-4 object-contain inline-block" /> : <span key={b} title={`${b} — ${opt.desc}`} className={`text-sm leading-none ${opt.animClass}`}>{opt.emoji}</span>;
                                  })}
                                  <span className="text-xs text-muted-foreground">{formatTime(msg.created_at)}</span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap break-words">{renderContent(msg.content, myName)}</p>
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
                            <div className={`group flex gap-3 px-2 py-0.5 rounded-md hover:bg-muted/40 ${startGroup ? "mt-4" : "mt-0.5"} ${msg.is_admin ? "border-l-2 border-amber-400/40" : ""} ${devMsgClass(senderBadges)}`}>
                              <div className="w-10 flex-shrink-0 flex justify-center">
                                {startGroup ? (
                                  <button
                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => setProfileCard({ senderId: msg.sender_id, senderName: msg.sender_name || "", isAdmin: !!msg.is_admin, isTeacher: !!msg.is_teacher })}
                                  >
                                    <RoleAvatar
                                      userId={msg.sender_id}
                                      name={msg.sender_name || "?"}
                                      isAdmin={!!msg.is_admin}
                                      isMod={!msg.is_admin && !!msg.is_teacher}
                                      isDev={isDevUser(senderBadges)}
                                      avatarSize="h-9 w-9"
                                      className="mt-0.5"
                                    />
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-transparent group-hover:text-muted-foreground/60 pt-1 select-none leading-none mt-1">
                                    {formatTime(msg.created_at)}
                                  </span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                {startGroup && (
                                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                    <button
                                      className={`text-sm font-semibold ${devNameClass(senderBadges)} ${!devNameClass(senderBadges) ? (msg.is_admin ? "text-amber-500" : msg.is_teacher ? "text-primary" : "") : ""} hover:underline cursor-pointer`}
                                      onClick={() => setProfileCard({ senderId: msg.sender_id, senderName: msg.sender_name || "", isAdmin: !!msg.is_admin, isTeacher: !!msg.is_teacher })}
                                    >
                                      {isDevUser(senderBadges)
                                        ? <span className="dev-nameplate">{isOwn ? "You" : msg.sender_name}</span>
                                        : (isOwn ? "You" : msg.sender_name)}
                                    </button>
                                    {msg.is_admin && (
                                      <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30 h-4 px-1.5 py-0">
                                        <Crown className="h-2.5 w-2.5 mr-1" />Admin
                                      </Badge>
                                    )}
                                    {!msg.is_admin && msg.is_teacher && (
                                      <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 h-4 px-1.5 py-0">
                                        <ShieldCheck className="h-2.5 w-2.5 mr-1" />Supervisor
                                      </Badge>
                                    )}
                                    {senderBadges.map(b => {
                                      const opt = BADGE_OPTIONS.find(o => o.name === b);
                                      if (!opt) return null;
                                    return opt.img ? <img key={b} src={opt.img} title={b} className="h-4 w-4 object-contain inline-block" /> : <span key={b} title={`${b} — ${opt.desc}`} className={`text-base leading-none ${opt.animClass}`}>{opt.emoji}</span>;
                                    })}
                                    <span className="text-xs text-muted-foreground">{formatTime(msg.created_at)}</span>
                                  </div>
                                )}
                                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{renderContent(msg.content, myName)}</p>
                                {/* Reaction pills */}
                                {(reactions[msg.id]?.length > 0 || true) && (
                                  <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                                    {(reactions[msg.id] || []).map(r => (
                                      <button key={r.emoji} onClick={() => toggleReaction(msg.id, r.emoji)}
                                        className={`inline-flex items-center gap-1 rounded-full text-xs px-2 py-0.5 border transition-colors
                                          ${r.mine ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-muted/50 hover:bg-muted"}`}>
                                        <span>{r.emoji}</span><span className="font-medium">{r.count}</span>
                                      </button>
                                    ))}
                                    <div className="relative group/picker">
                                      <button className="inline-flex items-center justify-center h-6 w-6 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors opacity-0 group-hover:opacity-100 text-sm">+</button>
                                      <div className="absolute bottom-7 left-0 hidden group-hover/picker:flex bg-popover border rounded-lg shadow-lg p-1 gap-0.5 z-10">
                                        {REACT_EMOJIS.map(e => (
                                          <button key={e} onClick={() => toggleReaction(msg.id, e)}
                                            className="h-7 w-7 rounded hover:bg-muted flex items-center justify-center text-base transition-colors">
                                            {e}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
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
                {/* @ Mention autocomplete */}
                {filteredMentions.length > 0 && (
                  <div className="mb-2 bg-popover border rounded-lg shadow-lg overflow-hidden">
                    {filteredMentions.map(m => (
                      <button key={m.id} onClick={() => insertMention(m.name)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left">
                        <span className="font-medium">@{m.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2 bg-muted/50 rounded-xl px-3 py-2 border border-border focus-within:border-primary/40 transition-colors">
                  <Textarea value={content} onChange={(e) => setContent(e.target.value)}
                    placeholder={`Message #${selectedActivityInfo?.title || "..."} · Type @ to mention`}
                    className="flex-1 min-h-[24px] max-h-[120px] resize-none bg-transparent border-0 shadow-none focus-visible:ring-0 p-0 text-sm"
                    maxLength={1000}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                      if (e.key === "Escape") setContent(c => c.replace(/@\w+$/, ""));
                    }}
                  />
                  <Button onClick={handleSend} disabled={sending || !content.trim()} size="icon" className="h-8 w-8 rounded-lg flex-shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 px-1">
                  <kbd className="font-mono">Enter</kbd> to send · <kbd className="font-mono">Shift+Enter</kbd> for new line · <kbd className="font-mono">@</kbd> to mention
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
              <Award className="h-5 w-5 text-primary" />
              {isDevUser(myBadges) ? "⚡ Instant Badge Grant" : "Request a Badge"}
            </DialogTitle>
            <DialogDescription>
              {isDevUser(myBadges)
                ? "Dev perk: badges are auto-granted instantly. No approval needed!"
                : "Choose a badge and tell an admin why you deserve it. They'll review and approve or decline."}
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
                  {badge.img
                    ? <img src={badge.img} alt={badge.name} className="h-6 w-6 object-contain" />
                    : <span className="text-xl">{badge.emoji}</span>}
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{badge.name}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{badge.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            {!isDevUser(myBadges) && (
              <div className="space-y-1.5">
                <Label htmlFor="admin-email">Send request to (admin email)</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@school.org"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="badge-reason">{isDevUser(myBadges) ? "Reason (for audit)" : "Why do you deserve this badge?"}</Label>
              <Textarea id="badge-reason" value={badgeReason} onChange={(e) => setBadgeReason(e.target.value)}
                placeholder="Explain your reason..." className="resize-none" rows={3} maxLength={500} />
              <p className="text-xs text-muted-foreground text-right">{badgeReason.length}/500</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBadgeOpen(false)}>Cancel</Button>
            <Button onClick={handleBadgeRequest} disabled={submittingBadge || !selectedBadge || !badgeReason.trim() || (!isDevUser(myBadges) && !adminEmail.trim())}>
              {submittingBadge ? "Processing..." : isDevUser(myBadges) ? "⚡ Grant Instantly" : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discord-style profile card */}
      {profileCard && (
        <UserProfileCard
          open={!!profileCard}
          onClose={() => setProfileCard(null)}
          senderId={profileCard.senderId}
          senderName={profileCard.senderName}
          isAdmin={profileCard.isAdmin}
          isTeacher={profileCard.isTeacher}
          badges={userBadges[profileCard.senderId] || []}
          currentActivityTitle={activities.find(a => a.id === selectedActivity)?.title}
        />
      )}
    </div>
  );
};

export default StudentMessages;
