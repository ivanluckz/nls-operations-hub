import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleAvatar } from "@/components/ui/RoleAvatar";
import HouseBadge from "@/components/ui/HouseBadge";
import { isDevUser, devNameClass } from "@/lib/dev-badge";
import {
  ArrowLeft, MessageSquare, Crown, ShieldCheck, GraduationCap,
  Flame, Trophy, Calendar, Award, Sparkles,
} from "lucide-react";
import devBadgeImg from "@/assets/dev.png";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  student_class: string | null;
  house_id: string | null;
  workout_location: string | null;
}

interface House {
  id: string;
  name: string;
  color: string;
}

interface Streak {
  streak_type: string;
  current_streak: number;
  longest_streak: number;
}

interface Milestone {
  milestone_type: string;
  streak_type: string;
  achieved_at: string;
}

interface ActivityItem {
  title: string;
  day_of_week: string;
}

const STREAK_META: Record<string, { label: string; icon: any; color: string }> = {
  activity: { label: "Activity", icon: Calendar, color: "text-blue-500" },
  meal:     { label: "Meals",    icon: Trophy,   color: "text-emerald-500" },
  workout:  { label: "Workouts", icon: Flame,    color: "text-orange-500" },
};

export default function StudentProfile() {
  const { userId: rawUserId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [meId, setMeId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [house, setHouse] = useState<House | null>(null);
  const [role, setRole] = useState<string>("student");
  const [badges, setBadges] = useState<string[]>([]);
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      setMeId(user.id);
      const targetId = !rawUserId || rawUserId === "me" ? user.id : rawUserId;
      setUserId(targetId);
      await loadAll(targetId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawUserId]);

  const loadAll = async (uid: string) => {
    setLoading(true);
    try {
      const [profileR, roleR, badgesR, streaksR, milestonesR, allocR] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
        supabase.from("user_badges").select("badge_name").eq("user_id", uid),
        supabase.from("attendance_streaks").select("streak_type,current_streak,longest_streak").eq("student_id", uid),
        supabase.from("streak_milestones").select("milestone_type,streak_type,achieved_at").eq("student_id", uid).order("achieved_at", { ascending: false }).limit(8),
        supabase.from("allocations").select("day_of_week, activities(title)").eq("student_id", uid).limit(20),
      ]);

      if (profileR.data) {
        setProfile(profileR.data as Profile);
        if (profileR.data.house_id) {
          const { data: h } = await supabase.from("houses").select("*").eq("id", profileR.data.house_id).maybeSingle();
          if (h) setHouse(h as House);
        }
      }
      if (roleR.data) setRole(roleR.data.role);
      if (badgesR.data) setBadges(badgesR.data.map((b: any) => b.badge_name));
      if (streaksR.data) setStreaks(streaksR.data as Streak[]);
      if (milestonesR.data) setMilestones(milestonesR.data as Milestone[]);
      if (allocR.data) {
        setActivities(
          allocR.data
            .filter((r: any) => r.activities?.title)
            .map((r: any) => ({ title: r.activities.title, day_of_week: r.day_of_week }))
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const isOwn = meId && meId === userId;
  const isDev = isDevUser(badges);
  const isAdmin = role === "admin";
  const isStaff = role === "teacher" || role === "moderator" || role === "admin" || role === "rl_coach" || role === "medical";

  const dmBase = location.pathname.startsWith("/admin") ? "/admin"
    : location.pathname.startsWith("/teacher") ? "/teacher"
    : location.pathname.startsWith("/moderator") ? "/moderator"
    : "/student";

  if (loading) {
    return (
      <div className="min-h-screen p-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-48 w-full rounded-2xl mb-6" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 mb-6">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen p-4 max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Profile not found or you don't have access.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>

      {/* Hero card */}
      <Card className="overflow-hidden border-0 shadow-xl mb-6">
        <div className={`h-28 ${isDev ? "dev-banner" : "bg-gradient-to-br from-primary/80 via-primary to-primary/60"}`} />
        <CardContent className="px-5 pb-5 -mt-12">
          <div className="flex items-end justify-between gap-3 mb-4">
            <div className="ring-4 ring-background rounded-full">
              <RoleAvatar
                userId={profile.id}
                name={profile.full_name}
                isAdmin={isAdmin}
                isMod={role === "teacher" || role === "moderator"}
                isDev={isDev}
                avatarSize="h-24 w-24"
              />
            </div>
            <div className="flex gap-2 mb-1">
              {!isOwn && (
                <Button size="sm" variant="outline"
                  onClick={() => navigate(`${dmBase}/dms?user=${profile.id}&name=${encodeURIComponent(profile.full_name)}`)}>
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Message
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <h1 className={`text-2xl font-bold leading-tight ${isDev ? devNameClass(badges) : ""} ${isAdmin ? "text-amber-500" : ""}`}>
              {profile.full_name}
            </h1>
            {isDev && <img src={devBadgeImg} alt="Dev" className="h-6 w-6" />}
            {isAdmin
              ? <Badge variant="outline" className="bg-amber-500/15 text-amber-600 border-amber-400/40 gap-1"><Crown className="h-3 w-3" />Admin</Badge>
              : isStaff
              ? <Badge variant="outline" className="bg-primary/15 text-primary border-primary/40 gap-1"><ShieldCheck className="h-3 w-3" />{role.replace("_", " ")}</Badge>
              : <Badge variant="outline" className="gap-1"><GraduationCap className="h-3 w-3" />Student</Badge>}
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {house && <HouseBadge name={house.name} color={house.color} />}
            {profile.student_class && (
              <Badge variant="secondary" className="text-xs">Class {profile.student_class}</Badge>
            )}
            {profile.workout_location && (
              <Badge variant="outline" className="text-xs gap-1"><Flame className="h-3 w-3" />{profile.workout_location}</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Streaks */}
      {streaks.length > 0 && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 mb-6">
          {(["activity", "meal", "workout"] as const).map(type => {
            const s = streaks.find(x => x.streak_type === type);
            const meta = STREAK_META[type];
            const Icon = meta.icon;
            return (
              <Card key={type} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{meta.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{s?.current_streak ?? 0}</span>
                    <span className="text-xs text-muted-foreground">current</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Best: <span className="font-semibold text-foreground">{s?.longest_streak ?? 0}</span> days
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        {/* Badges */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" /> Badges ({badges.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {badges.length === 0 ? (
              <p className="text-xs text-muted-foreground">No badges yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {badges.map(b => (
                  <Badge key={b} variant="outline" className="text-xs">
                    {b === "Dev"
                      ? <span className="flex items-center gap-1"><img src={devBadgeImg} alt="" className="h-3.5 w-3.5" />Dev</span>
                      : b}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Milestones */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" /> Milestones ({milestones.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {milestones.length === 0 ? (
              <p className="text-xs text-muted-foreground">Earn streaks to unlock milestones.</p>
            ) : (
              <div className="space-y-1.5">
                {milestones.slice(0, 5).map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="font-medium">
                      {m.milestone_type.replace("_day", "-day")} {m.streak_type}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(m.achieved_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activities */}
      {activities.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Activities ({activities.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {activities.map((a, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {a.title} <span className="opacity-60 ml-1">· {a.day_of_week.slice(0, 3)}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
