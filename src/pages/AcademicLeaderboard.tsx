import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trophy, GraduationCap } from "lucide-react";

const AVATAR_COLORS = ["bg-red-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500", "bg-teal-500", "bg-blue-500", "bg-violet-500", "bg-pink-500"];
function hashId(id: string) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff; return Math.abs(h); }
function getColor(id: string) { return AVATAR_COLORS[hashId(id) % AVATAR_COLORS.length]; }
function getInitials(name: string) { return name.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?"; }

const PODIUM_MEDALS = ["🥇", "🥈", "🥉"];
const PODIUM_HEIGHTS = ["h-28", "h-20", "h-16"];
const PODIUM_SIZES = ["h-16 w-16 text-lg ring-4 ring-amber-400", "h-12 w-12 text-sm ring-2 ring-slate-400", "h-12 w-12 text-sm ring-2 ring-amber-600"];

interface Entry { id: string; name: string; present: number; total: number; pct: number; }

const AcademicLeaderboard = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [classGroups, setClassGroups] = useState<{ id: string; name: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState("all");
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const { data: cg } = await (supabase as any).from("class_groups").select("id, name").order("name");
      setClassGroups(cg || []);

      // Get all students with academic attendance
      const { data: att } = await (supabase as any).from("academic_attendance").select("student_id, status").limit(5000);
      if (!att?.length) { setLoading(false); return; }

      const studentMap: Record<string, { present: number; total: number }> = {};
      for (const a of att) {
        if (!studentMap[a.student_id]) studentMap[a.student_id] = { present: 0, total: 0 };
        studentMap[a.student_id].total++;
        if (a.status === "present") studentMap[a.student_id].present++;
      }

      const studentIds = Object.keys(studentMap);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", studentIds);
      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      // Store memberships for filtering
      const { data: members } = await (supabase as any).from("class_group_members").select("student_id, class_group_id").in("student_id", studentIds);
      const memberMap: Record<string, string[]> = {};
      (members || []).forEach((m: any) => {
        if (!memberMap[m.student_id]) memberMap[m.student_id] = [];
        memberMap[m.student_id].push(m.class_group_id);
      });

      const allEntries: (Entry & { classGroupIds: string[] })[] = studentIds
        .filter(id => profileMap.has(id) && studentMap[id].total > 0)
        .map(id => ({
          id,
          name: profileMap.get(id)!,
          present: studentMap[id].present,
          total: studentMap[id].total,
          pct: Math.round((studentMap[id].present / studentMap[id].total) * 100),
          classGroupIds: memberMap[id] || [],
        }));

      // Store for filtering
      (window as any).__academicLeaderboardData = allEntries;
      setEntries(allEntries.sort((a, b) => b.pct - a.pct).slice(0, 50));
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    const allData = (window as any).__academicLeaderboardData;
    if (!allData) return;
    const filtered = selectedClass === "all" ? allData : allData.filter((e: any) => e.classGroupIds.includes(selectedClass));
    setEntries(filtered.sort((a: Entry, b: Entry) => b.pct - a.pct).slice(0, 50));
  }, [selectedClass]);

  const top3 = entries.slice(0, 3);
  const currentRank = entries.findIndex(e => e.id === currentUserId) + 1;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/student/academic")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <Trophy className="h-5 w-5 text-amber-500" />
            <h1 className="text-xl font-bold">Academic Leaderboard</h1>
          </div>
          {currentRank > 0 && <Badge variant="outline" className="ml-auto text-xs">Your rank: #{currentRank}</Badge>}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex gap-3 mb-6">
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="All Classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classGroups.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>
        ) : entries.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">No attendance data yet.</p>
        ) : (
          <>
            {/* Podium */}
            {top3.length >= 2 && (
              <div className="flex items-end justify-center gap-4 mb-10 pt-4">
                {[top3[1], top3[0], top3[2]].filter(Boolean).map(entry => {
                  const rank = entry === top3[0] ? 0 : entry === top3[1] ? 1 : 2;
                  return (
                    <div key={entry.id} className="flex flex-col items-center gap-2">
                      <span className="text-2xl">{PODIUM_MEDALS[rank]}</span>
                      <Avatar className={`${PODIUM_SIZES[rank]} ${getColor(entry.id)}`}>
                        <AvatarFallback className={`text-white font-bold ${getColor(entry.id)}`}>{getInitials(entry.name)}</AvatarFallback>
                      </Avatar>
                      <div className="text-center">
                        <p className={`font-semibold ${rank === 0 ? "text-base" : "text-sm"} ${entry.id === currentUserId ? "text-primary" : ""}`}>
                          {entry.name.split(" ")[0]}
                        </p>
                        <p className="text-xs text-muted-foreground">{entry.pct}%</p>
                      </div>
                      <div className={`${PODIUM_HEIGHTS[rank]} w-20 rounded-t-lg flex items-center justify-center text-white font-bold text-lg ${rank === 0 ? "bg-amber-400" : rank === 1 ? "bg-slate-400" : "bg-amber-600/80"}`}>
                        {rank + 1}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full list */}
            <div className="space-y-1">
              {entries.map((entry, i) => {
                const isMe = entry.id === currentUserId;
                return (
                  <div key={entry.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${isMe ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-muted/50"}`}>
                    <span className={`w-7 text-center text-sm font-bold shrink-0 ${i < 3 ? "text-amber-500" : "text-muted-foreground"}`}>
                      {i < 3 ? PODIUM_MEDALS[i] : `#${i + 1}`}
                    </span>
                    <Avatar className={`h-9 w-9 shrink-0 ${getColor(entry.id)}`}>
                      <AvatarFallback className={`text-white text-xs font-bold ${getColor(entry.id)}`}>{getInitials(entry.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-semibold ${isMe ? "text-primary" : ""}`}>{entry.name}{isMe ? " (You)" : ""}</span>
                      <p className="text-xs text-muted-foreground">{entry.present}/{entry.total} present</p>
                    </div>
                    <Badge variant={entry.pct >= 90 ? "default" : entry.pct >= 75 ? "secondary" : "destructive"} className="shrink-0">
                      {entry.pct}%
                    </Badge>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-xs text-muted-foreground mt-6">Ranked by attendance percentage. Top 50 shown.</p>
          </>
        )}
      </main>
    </div>
  );
};

export default AcademicLeaderboard;
