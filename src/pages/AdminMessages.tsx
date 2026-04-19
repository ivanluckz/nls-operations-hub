import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMessageNotifications } from "@/hooks/use-message-notifications";
import NotificationBanner from "@/components/NotificationBanner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoleAvatar } from "@/components/ui/RoleAvatar";
import { devNameClass, devMsgClass, isDevUser } from "@/lib/dev-badge";
import devBadgeImg from "@/assets/dev.png";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hash, ShieldCheck, Megaphone, Send, Trash2, Crown } from "lucide-react";
import { UserProfileCard } from "@/components/chat/UserProfileCard";
import { DayPill } from "@/components/chat/DayPill";
import { ConvSearch } from "@/components/chat/ConvSearch";
import "@/components/chat/chat-glass.css";

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

interface Activity {
  id: string;
  title: string;
  teacher_id: string | null;
}

interface ProfileCard {
  senderId: string;
  senderName: string;
  isAdmin: boolean;
  isTeacher: boolean;
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

const AdminMessages = () => {
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [messageType, setMessageType] = useState<"announcement" | "discussion">("announcement");
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState("");
  const [userBadges, setUserBadges] = useState<Record<string, string[]>>({});
  const [profileCard, setProfileCard] = useState<ProfileCard | null>(null);
  const [convSearch, setConvSearch] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const teacherIdsRef = useRef<Record<string, string | null>>({});
  const selectedActivityRef = useRef<string>("");
  const adminIdsRef = useRef<Set<string>>(new Set());

  // Notifications
  const { showBanner, requestPermission, dismissBanner, notify } = useMessageNotifications({
    userId,
    activeChannelId: selectedActivity,
  });

  useEffect(() => { selectedActivityRef.current = selectedActivity; }, [selectedActivity]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id); });
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase
        .from("activities")
        .select("id, title, teacher_id")
        .eq("is_active", true)
        .order("title");

      if (data) {
        setActivities(data);
        data.forEach(a => { teacherIdsRef.current[a.id] = a.teacher_id; });
        if (data.length > 0) setSelectedActivity(data[0].id);
      }
      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin").limit(100);
      adminRoles?.forEach(r => adminIdsRef.current.add(r.user_id));
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
        supabase.from("user_badges").select("user_id, badge_name").in("user_id", senderIds).limit(500),
      ]);

      const profileMap = new Map(profilesRes.data?.map(p => [p.id, p.full_name]) || []);
      const teacherId = teacherIdsRef.current[selectedActivity];

      const badgeMap: Record<string, string[]> = {};
      (badgesRes.data || []).forEach((b: any) => {
        if (!badgeMap[b.user_id]) badgeMap[b.user_id] = [];
        badgeMap[b.user_id].push(b.badge_name);
      });
      setUserBadges(badgeMap);

      setMessages(data.map(m => ({
        ...m,
        message_type: m.message_type as "announcement" | "discussion",
        sender_name: profileMap.get(m.sender_id) || "Unknown",
        is_teacher: m.sender_id === teacherId,
        is_admin: adminIdsRef.current.has(m.sender_id),
      })));
    };
    fetchMessages();

    const channel = supabase.channel(`admin-msgs-${selectedActivity}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_messages", filter: `activity_id=eq.${selectedActivity}` },
        async (payload) => {
          const msg = payload.new as Message;
          const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", msg.sender_id).single();
          const senderName = profile?.full_name || "Unknown";

          if (msg.sender_id !== userId) {
            const prefix = msg.message_type === "announcement" ? "📢" : "💬";
            notify(`${prefix} ${senderName}`, msg.content.slice(0, 100), `activity-${msg.activity_id}`);
          }

          setMessages(prev => [...prev, {
            ...msg,
            message_type: msg.message_type as "announcement" | "discussion",
            sender_name: senderName,
            is_teacher: msg.sender_id === teacherIdsRef.current[msg.activity_id],
            is_admin: adminIdsRef.current.has(msg.sender_id),
          }]);
        }
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "activity_messages", filter: `activity_id=eq.${selectedActivity}` },
        (payload) => { setMessages(prev => prev.filter(m => m.id !== (payload.old as Message).id)); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedActivity]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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
    } catch {
      toast({ variant: "destructive", title: "Failed to send message" });
    } finally {
      setSending(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    const { error } = await supabase.from("activity_messages").delete().eq("id", deleteTargetId);
    if (error) toast({ variant: "destructive", title: "Failed to delete message" });
    setDeleteTargetId(null);
  };

  const openProfile = (msg: Message) => {
    setProfileCard({
      senderId: msg.sender_id,
      senderName: msg.sender_name || "Unknown",
      isAdmin: !!msg.is_admin,
      isTeacher: !!msg.is_teacher,
    });
  };

  const selectedTitle = activities.find(a => a.id === selectedActivity)?.title;
  const filteredActivities = convSearch.trim()
    ? activities.filter(a => a.title.toLowerCase().includes(convSearch.toLowerCase()))
    : activities;

  return (
    <AdminLayout>
      {showBanner && <NotificationBanner onEnable={requestPermission} onDismiss={dismissBanner} />}
      <div className="chat-shell flex h-[calc(100vh-8rem)] rounded-xl border overflow-hidden">
        {/* Sidebar */}
        <aside className="chat-glass-panel w-60 border-r flex flex-col flex-shrink-0">
          <div className="px-3 py-3 border-b border-border/40 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">All Channels</p>
              <span className="text-[10px] text-muted-foreground">{activities.length}</span>
            </div>
            <ConvSearch value={convSearch} onChange={setConvSearch} placeholder="Search channels…" />
          </div>
          <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
            {filteredActivities.map((a) => (
              <button key={a.id} onClick={() => setSelectedActivity(a.id)}
                className={`chat-conv-item ${selectedActivity === a.id ? "chat-conv-item-active" : ""}`}>
                <Hash className="h-4 w-4 flex-shrink-0 opacity-70" />
                <span className="flex-1 truncate text-sm">{a.title}</span>
              </button>
            ))}
            {filteredActivities.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No matches</p>
            )}
          </div>
        </aside>

        {/* Chat area */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="chat-glass-header px-4 py-3 flex items-center gap-2 flex-shrink-0">
            <Hash className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold text-sm">{selectedTitle || "Select a channel"}</h2>
            <Badge variant="outline" className="ml-auto text-xs">Admin</Badge>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Hash className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="font-semibold">No messages in this channel</p>
                </div>
              </div>
            ) : (
              <div className="pb-2">
                {messages.map((msg, idx) => {
                  const prev = idx > 0 ? messages[idx - 1] : undefined;
                  const showDateSep = !prev || !isSameDay(msg.created_at, prev.created_at);
                  const startGroup = isNewGroup(msg, prev);
                  const isOwn = msg.sender_id === userId;
                  const canClick = !isOwn;

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
                                className={`text-sm font-semibold ${msg.is_admin ? "text-amber-500" : msg.is_teacher ? "text-primary" : ""} ${canClick ? "hover:underline cursor-pointer" : "cursor-default"}`}
                                onClick={() => canClick && openProfile(msg)}
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
                              <span className="text-xs text-muted-foreground">{formatTime(msg.created_at)}</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          </div>
                          <Button variant="ghost" size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 flex-shrink-0 self-start"
                            onClick={() => setDeleteTargetId(msg.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className={`group flex gap-3 px-2 py-0.5 rounded-md hover:bg-muted/40 ${startGroup ? "mt-4" : "mt-0.5"} ${msg.is_admin ? "border-l-2 border-amber-400/40" : ""} ${devMsgClass(userBadges[msg.sender_id] || [])}`}>
                          <div className="w-10 flex-shrink-0 flex justify-center">
                            {startGroup ? (
                              <button
                                className={`${canClick ? "cursor-pointer hover:opacity-80 transition-opacity" : "cursor-default"}`}
                                onClick={() => canClick && openProfile(msg)}
                              >
                                <RoleAvatar
                                  userId={msg.sender_id}
                                  name={msg.sender_name || "?"}
                                  isAdmin={!!msg.is_admin}
                                  isMod={!msg.is_admin && !!msg.is_teacher}
                                  isDev={isDevUser(userBadges[msg.sender_id] || [])}
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
                                  className={`text-sm font-semibold ${devNameClass(userBadges[msg.sender_id] || [])} ${!devNameClass(userBadges[msg.sender_id] || []) ? (msg.is_admin ? "text-amber-500" : msg.is_teacher ? "text-primary" : "") : ""} ${canClick ? "hover:underline cursor-pointer" : "cursor-default"}`}
                                  onClick={() => canClick && openProfile(msg)}
                                >
                                  {isDevUser(userBadges[msg.sender_id] || [])
                                    ? <><span className="dev-nameplate">{isOwn ? "You" : msg.sender_name}</span><img src={devBadgeImg} alt="Dev" className="h-5 w-5 object-contain ml-0.5" /></>
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
                                <span className="text-xs text-muted-foreground">{formatTime(msg.created_at)}</span>
                              </div>
                            )}
                            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 flex-shrink-0 self-start pt-0.5">
                            <Button variant="ghost" size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteTargetId(msg.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Compose bar */}
          {selectedActivity && (
            <div className="flex-shrink-0 px-4 py-3 border-t bg-background space-y-2">
              <div className="flex items-center gap-2">
                <Select value={messageType} onValueChange={(v) => setMessageType(v as "announcement" | "discussion")}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="announcement">
                      <span className="flex items-center gap-1.5"><Megaphone className="h-3.5 w-3.5" />Announcement</span>
                    </SelectItem>
                    <SelectItem value="discussion">
                      <span className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" />Discussion</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 bg-muted/50 rounded-xl px-3 py-2 border border-border focus-within:border-primary/40 transition-colors">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={`Message #${selectedTitle || "..."} as admin...`}
                  className="flex-1 min-h-[24px] max-h-[100px] resize-none bg-transparent border-0 shadow-none focus-visible:ring-0 p-0 text-sm"
                  maxLength={1000}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                />
                <Button onClick={handleSend} disabled={sending || !content.trim()} size="icon" className="h-8 w-8 rounded-lg flex-shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm delete */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(o) => { if (!o) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the message for everyone. This action cannot be undone.
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

      {/* Profile card with badge granting */}
      {profileCard && (
        <UserProfileCard
          open={!!profileCard}
          onClose={() => setProfileCard(null)}
          senderId={profileCard.senderId}
          senderName={profileCard.senderName}
          isAdmin={profileCard.isAdmin}
          isTeacher={profileCard.isTeacher}
          badges={userBadges[profileCard.senderId] || []}
          isAdminViewing
          onBadgeGranted={(badgeName) => {
            setUserBadges(prev => ({
              ...prev,
              [profileCard.senderId]: [...(prev[profileCard.senderId] || []), badgeName],
            }));
          }}
          onBadgeRemoved={(badgeName) => {
            setUserBadges(prev => ({
              ...prev,
              [profileCard.senderId]: (prev[profileCard.senderId] || []).filter(b => b !== badgeName),
            }));
          }}
        />
      )}
    </AdminLayout>
  );
};

export default AdminMessages;
