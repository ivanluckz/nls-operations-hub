import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trophy } from "lucide-react";
import devBadge from "@/assets/dev.png";
import { devNameClass } from "@/lib/dev-badge";
import { UserProfileCard } from "@/components/chat/UserProfileCard";

const BADGE_OPTIONS: { name: string; emoji: string; animClass: string; img?: string }[] = [
  { name: "Growing",      emoji: "🌱", animClass: "badge-anim-grow"  },
  { name: "Star Student", emoji: "⭐", animClass: "badge-anim-star"  },
  { name: "Leader",       emoji: "👑", animClass: "badge-anim-crown" },
  { name: "On Fire",      emoji: "🔥", animClass: "badge-anim-fire"  },
  { name: "Creative",     emoji: "💡", animClass: "badge-anim-bulb"  },
  { name: "Team Player",  emoji: "🤝", animClass: "badge-anim-team"  },
  { name: "Dev",          emoji: "",   animClass: "",                  img: devBadge },
];

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

interface RawBadge { user_id: string; badge_name: string; awarded_at: string; }
interface BaseEntry { id: string; name: string; }
type TimePeriod = "all" | "month" | "week";

const PODIUM_MEDALS = ["🥇", "🥈", "🥉"];
const PODIUM_HEIGHTS = ["h-28", "h-20", "h-16"];
const PODIUM_SIZES  = ["h-16 w-16 text-lg ring-4 ring-amber-400", "h-12 w-12 text-sm ring-2 ring-slate-400", "h-12 w-12 text-sm ring-2 ring-amber-600"];

const TIME_LABELS: Record<TimePeriod, string> = { all: "All Time", month: "This Month", week: "This Week" };

const Leaderboard = () => {
  const navigate = useNavigate();
  const [baseEntries, setBaseEntries] = useState<BaseEntry[]>([]);
  const [rawBadges, setRawBadges] = useState<RawBadge[]>([]);
  const [activityMap, setActivityMap] = useState<Record<string, Set<string>>>({});
  const [allActivities, setAllActivities] = useState<{ id: string; title: string }[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [activityFilter, setActivityFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState<TimePeriod>("all");
  const [profileCard, setProfileCard] = useState<{
    senderId: string; senderName: string; badges: string[];
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: studentRoles } = await supabase
        .from("user_roles").select("user_id").eq("role", "student").limit(500);
      const studentIds = (studentRoles || []).map(r => r.user_id);
      if (studentIds.length === 0) { setLoading(false); return; }

      const [profilesRes, badgesRes, allocsRes, activitiesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", studentIds),
        supabase.from("user_badges").select("user_id, badge_name, awarded_at").in("user_id", studentIds).limit(2000),
        supabase.from("allocations").select("student_id, activity_id").in("student_id", studentIds).limit(5000),
        supabase.from("activities").select("id, title").order("title").limit(200),
      ]);

      const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p.full_name]));

      const aMap: Record<string, Set<string>> = {};
      (allocsRes.data || []).forEach(a => {
        if (!aMap[a.student_id]) aMap[a.student_id] = new Set();
        aMap[a.student_id].add(a.activity_id);
      });

      const entries: BaseEntry[] = studentIds
        .filter(id => profileMap.has(id))
        .map(id => ({ id, name: profileMap.get(id) || "Unknown" }));

      setBaseEntries(entries);
      setRawBadges((badgesRes.data || []) as RawBadge[]);
      setActivityMap(aMap);
      setAllActivities(activitiesRes.data || []);
      setLoading(false);
    };
    load();
  }, []);

  const entries = useMemo(() => {
    const now = new Date();

    const filteredBadges = rawBadges.filter(b => {
      if (timeFilter === "all") return true;
      const d = new Date(b.awarded_at);
      if (timeFilter === "month") return d >= new Date(now.getFullYear(), now.getMonth(), 1);
      const ws = new Date(now); ws.setDate(now.getDate() - now.getDay()); ws.setHours(0, 0, 0, 0);
      return d >= ws;
    });

    const badgeMap: Record<string, string[]> = {};
    filteredBadges.forEach(b => {
      if (!badgeMap[b.user_id]) badgeMap[b.user_id] = [];
      badgeMap[b.user_id].push(b.badge_name);
    });

    return baseEntries
      .filter(e => activityFilter === "all" || activityMap[e.id]?.has(activityFilter))
      .map(e => ({
        ...e,
        badges: badgeMap[e.id] || [],
        activityCount: activityMap[e.id]?.size || 0,
        score: (badgeMap[e.id]?.length || 0) * 3 + (activityMap[e.id]?.size || 0),
      }))
      .filter(e => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
  }, [baseEntries, rawBadges, activityMap, activityFilter, timeFilter]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const currentRank = entries.findIndex(e => e.id === currentUserId) + 1;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/student")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h1 className="text-xl font-bold">Leaderboard</h1>
          </div>
          {currentRank > 0 && (
            <Badge variant="outline" className="ml-auto text-xs">
              Your rank: #{currentRank}
            </Badge>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6 items-center">
          {/* Activity filter */}
          <Select value={activityFilter} onValueChange={setActivityFilter}>
            <SelectTrigger className="h-8 text-xs w-44">
              <SelectValue placeholder="All Activities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Activities</SelectItem>
              {allActivities.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Time period filter */}
          <div className="flex rounded-lg border overflow-hidden h-8">
            {(["all", "month", "week"] as TimePeriod[]).map(t => (
              <button
                key={t}
                onClick={() => setTimeFilter(t)}
                className={`px-3 text-xs font-medium transition-colors
                  ${timeFilter === t ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted text-muted-foreground"}`}
              >
                {TIME_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">
            {activityFilter !== "all" || timeFilter !== "all"
              ? "No results for the selected filters."
              : "No data yet — earn badges to appear here!"}
          </p>
        ) : (
          <>
            {/* Podium */}
            {top3.length >= 2 && (
              <div className="flex items-end justify-center gap-4 mb-10 pt-4">
                {[top3[1], top3[0], top3[2]].filter(Boolean).map((entry) => {
                  const actualRank = entry === top3[0] ? 0 : entry === top3[1] ? 1 : 2;
                  return (
                    <button key={entry.id} className="flex flex-col items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setProfileCard({ senderId: entry.id, senderName: entry.name, badges: entry.badges })}>
                      <span className="text-2xl">{PODIUM_MEDALS[actualRank]}</span>
                      <Avatar className={`${PODIUM_SIZES[actualRank]} ${getAvatarColor(entry.id)}`}>
                        <AvatarFallback className={`text-white font-bold ${getAvatarColor(entry.id)}`}>
                          {getInitials(entry.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-center">
                        <p className={`font-semibold leading-tight ${devNameClass(entry.badges)} ${!devNameClass(entry.badges) ? (entry.id === currentUserId ? "text-primary" : "") : ""} ${actualRank === 0 ? "text-base" : "text-sm"} flex items-center justify-center gap-1`}>
                          {entry.name.split(" ")[0]}
                          {entry.badges.includes("Dev") && <img src={devBadge} alt="Dev" className="h-5 w-5 object-contain" />}
                        </p>
                        <p className="text-xs text-muted-foreground">{entry.score} pts</p>
                      </div>
                      <div className={`${PODIUM_HEIGHTS[actualRank]} w-20 rounded-t-lg flex items-center justify-center text-white font-bold text-lg
                        ${actualRank === 0 ? "bg-amber-400" : actualRank === 1 ? "bg-slate-400" : "bg-amber-600/80"}`}>
                        {actualRank + 1}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Rankings table */}
            <div className="space-y-1">
              {entries.map((entry, i) => {
                const isMe = entry.id === currentUserId;
                return (
                  <button key={entry.id}
                    onClick={() => setProfileCard({ senderId: entry.id, senderName: entry.name, badges: entry.badges })}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left cursor-pointer
                      ${isMe ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-muted/50"}`}>
                    <span className={`w-7 text-center text-sm font-bold shrink-0 ${i < 3 ? "text-amber-500" : "text-muted-foreground"}`}>
                      {i < 3 ? PODIUM_MEDALS[i] : `#${i + 1}`}
                    </span>
                    <Avatar className={`h-9 w-9 shrink-0 ${getAvatarColor(entry.id)}`}>
                      <AvatarFallback className={`text-white text-xs font-bold ${getAvatarColor(entry.id)}`}>
                        {getInitials(entry.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-sm font-semibold ${devNameClass(entry.badges)} ${!devNameClass(entry.badges) ? (isMe ? "text-primary" : "") : ""}`}>
                          {entry.name}{isMe && " (You)"}
                        </span>
                        {entry.badges.slice(0, 5).map(b => {
                          const opt = BADGE_OPTIONS.find(o => o.name === b);
                          if (!opt) return null;
                          return opt.img
                            ? <img key={b} src={opt.img} title={b} className="h-4 w-4 object-contain" />
                            : <span key={b} title={b} className={`text-sm leading-none ${opt.animClass}`}>{opt.emoji}</span>;
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {entry.badges.length} badge{entry.badges.length !== 1 ? "s" : ""} · {entry.activityCount} activit{entry.activityCount !== 1 ? "ies" : "y"}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-muted-foreground shrink-0">{entry.score}pts</span>
                  </button>
                );
              })}
            </div>

            <p className="text-center text-xs text-muted-foreground mt-6">
              Score = badges × 3 + activities. Top 50 students shown.
            </p>
          </>
        )}
      </main>

      {profileCard && (
        <UserProfileCard
          open={!!profileCard}
          onClose={() => setProfileCard(null)}
          senderId={profileCard.senderId}
          senderName={profileCard.senderName}
          isAdmin={false}
          isTeacher={false}
          badges={profileCard.badges}
        />
      )}
    </div>
  );
};

export default Leaderboard;
