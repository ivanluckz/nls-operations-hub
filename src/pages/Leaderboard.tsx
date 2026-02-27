import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy } from "lucide-react";

const BADGE_OPTIONS = [
  { name: "Growing",      emoji: "🌱", animClass: "badge-anim-grow"  },
  { name: "Star Student", emoji: "⭐", animClass: "badge-anim-star"  },
  { name: "Leader",       emoji: "👑", animClass: "badge-anim-crown" },
  { name: "On Fire",      emoji: "🔥", animClass: "badge-anim-fire"  },
  { name: "Creative",     emoji: "💡", animClass: "badge-anim-bulb"  },
  { name: "Team Player",  emoji: "🤝", animClass: "badge-anim-team"  },
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

interface Entry {
  id: string;
  name: string;
  badges: string[];
  activityCount: number;
  score: number;
}

const PODIUM_MEDALS = ["🥇", "🥈", "🥉"];
const PODIUM_HEIGHTS = ["h-28", "h-20", "h-16"];
const PODIUM_SIZES  = ["h-16 w-16 text-lg ring-4 ring-amber-400", "h-12 w-12 text-sm ring-2 ring-slate-400", "h-12 w-12 text-sm ring-2 ring-amber-600"];

const Leaderboard = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Get student user IDs
      const { data: studentRoles } = await supabase
        .from("user_roles").select("user_id").eq("role", "student").limit(500);
      const studentIds = (studentRoles || []).map(r => r.user_id);
      if (studentIds.length === 0) { setLoading(false); return; }

      // Fetch badges, profiles, allocations in parallel
      const [profilesRes, badgesRes, allocsRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", studentIds),
        supabase.from("user_badges").select("user_id, badge_name").in("user_id", studentIds).limit(2000),
        supabase.from("allocations").select("student_id, activity_id").in("student_id", studentIds).limit(5000),
      ]);

      const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p.full_name]));

      // Aggregate badges per user
      const badgeMap: Record<string, string[]> = {};
      (badgesRes.data || []).forEach(b => {
        if (!badgeMap[b.user_id]) badgeMap[b.user_id] = [];
        badgeMap[b.user_id].push(b.badge_name);
      });

      // Aggregate unique activities per user
      const activityMap: Record<string, Set<string>> = {};
      (allocsRes.data || []).forEach(a => {
        if (!activityMap[a.student_id]) activityMap[a.student_id] = new Set();
        activityMap[a.student_id].add(a.activity_id);
      });

      const list: Entry[] = studentIds
        .filter(id => profileMap.has(id))
        .map(id => {
          const badges = badgeMap[id] || [];
          const activityCount = activityMap[id]?.size || 0;
          return {
            id,
            name: profileMap.get(id) || "Unknown",
            badges,
            activityCount,
            score: badges.length * 3 + activityCount,
          };
        })
        .filter(e => e.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 50);

      setEntries(list);
      setLoading(false);
    };
    load();
  }, []);

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

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">No data yet — earn badges to appear here!</p>
        ) : (
          <>
            {/* Podium */}
            {top3.length >= 2 && (
              <div className="flex items-end justify-center gap-4 mb-10 pt-4">
                {/* Reorder: 2nd | 1st | 3rd */}
                {[top3[1], top3[0], top3[2]].filter(Boolean).map((entry, podiumIdx) => {
                  const actualRank = entry === top3[0] ? 0 : entry === top3[1] ? 1 : 2;
                  return (
                    <div key={entry.id} className="flex flex-col items-center gap-2">
                      <span className="text-2xl">{PODIUM_MEDALS[actualRank]}</span>
                      <Avatar className={`${PODIUM_SIZES[actualRank]} ${getAvatarColor(entry.id)}`}>
                        <AvatarFallback className={`text-white font-bold ${getAvatarColor(entry.id)}`}>
                          {getInitials(entry.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-center">
                        <p className={`font-semibold leading-tight ${entry.id === currentUserId ? "text-primary" : ""} ${actualRank === 0 ? "text-base" : "text-sm"}`}>
                          {entry.name.split(" ")[0]}
                        </p>
                        <p className="text-xs text-muted-foreground">{entry.score} pts</p>
                      </div>
                      <div className={`${PODIUM_HEIGHTS[actualRank]} w-20 rounded-t-lg flex items-center justify-center text-white font-bold text-lg
                        ${actualRank === 0 ? "bg-amber-400" : actualRank === 1 ? "bg-slate-400" : "bg-amber-600/80"}`}>
                        {actualRank + 1}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Rankings table */}
            <div className="space-y-1">
              {entries.map((entry, i) => {
                const isMe = entry.id === currentUserId;
                return (
                  <div key={entry.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold ${isMe ? "text-primary" : ""}`}>
                          {entry.name}{isMe && " (You)"}
                        </span>
                        {entry.badges.slice(0, 4).map(b => {
                          const opt = BADGE_OPTIONS.find(o => o.name === b);
                          return opt ? (
                            <span key={b} title={b} className={`text-sm leading-none ${opt.animClass}`}>{opt.emoji}</span>
                          ) : null;
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {entry.badges.length} badge{entry.badges.length !== 1 ? "s" : ""} · {entry.activityCount} activit{entry.activityCount !== 1 ? "ies" : "y"}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-muted-foreground shrink-0">{entry.score}pts</span>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-xs text-muted-foreground mt-6">
              Score = badges × 3 + activities. Top 50 students shown.
            </p>
          </>
        )}
      </main>
    </div>
  );
};

export default Leaderboard;
