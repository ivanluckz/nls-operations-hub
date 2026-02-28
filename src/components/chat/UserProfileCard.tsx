import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Crown, ShieldCheck, GraduationCap, MessageSquare } from "lucide-react";
import devBadge from "@/assets/dev.png";

const BADGE_OPTIONS: { name: string; emoji: string; animClass: string; desc: string; img?: string }[] = [
  { name: "Growing",     emoji: "🌱", animClass: "badge-anim-grow",  desc: "Active and improving" },
  { name: "Star Student",emoji: "⭐", animClass: "badge-anim-star",  desc: "Outstanding performance" },
  { name: "Leader",      emoji: "👑", animClass: "badge-anim-crown", desc: "Shows leadership" },
  { name: "On Fire",     emoji: "🔥", animClass: "badge-anim-fire",  desc: "Consistent effort" },
  { name: "Creative",    emoji: "💡", animClass: "badge-anim-bulb",  desc: "Brings fresh ideas" },
  { name: "Team Player", emoji: "🤝", animClass: "badge-anim-team",  desc: "Great collaboration" },
  { name: "Dev",         emoji: "",   animClass: "",                  desc: "Exclusive developer badge", img: devBadge },
];

const AVATAR_COLORS = [
  "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500",
  "bg-teal-500", "bg-blue-500", "bg-violet-500", "bg-pink-500",
];

const BANNER_CLASSES = [
  "from-red-700 via-red-500 to-red-400",
  "from-orange-700 via-orange-500 to-orange-400",
  "from-amber-700 via-amber-500 to-amber-400",
  "from-emerald-700 via-emerald-500 to-emerald-400",
  "from-teal-700 via-teal-500 to-teal-400",
  "from-blue-700 via-blue-500 to-blue-400",
  "from-violet-700 via-violet-500 to-violet-400",
  "from-pink-700 via-pink-500 to-pink-400",
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}

interface Props {
  open: boolean;
  onClose: () => void;
  senderId: string;
  senderName: string;
  isAdmin: boolean;
  isTeacher: boolean;
  badges: string[];
  currentActivityTitle?: string;
}

interface UserActivity {
  title: string;
}

export function UserProfileCard({
  open, onClose, senderId, senderName, isAdmin, isTeacher, badges, currentActivityTitle,
}: Props) {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<UserActivity[]>([]);

  useEffect(() => {
    if (!open || !senderId) return;
    supabase
      .from("allocations")
      .select("activities(title)")
      .eq("student_id", senderId)
      .limit(10)
      .then(({ data }) => {
        if (data) {
          const acts = data
            .map((r: any) => r.activities)
            .filter(Boolean)
            .map((a: any) => ({ title: a.title }));
          setActivities(acts);
        }
      });
  }, [open, senderId]);

  const idx = hashId(senderId) % AVATAR_COLORS.length;
  const avatarColor = AVATAR_COLORS[idx];
  const bannerClass = BANNER_CLASSES[idx];

  const roleLabel = isAdmin ? "Admin" : isTeacher ? "Supervisor" : "Student";
  const roleColor = isAdmin
    ? "bg-amber-500/15 text-amber-600 border-amber-400/40"
    : isTeacher
    ? "bg-primary/15 text-primary border-primary/40"
    : "bg-muted text-muted-foreground border-border";

  const earnedBadges = BADGE_OPTIONS.filter(b => badges.includes(b.name));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-0 overflow-hidden max-w-sm rounded-xl border-0 shadow-2xl gap-0">
        {/* Banner */}
        <div className={`h-24 bg-gradient-to-br ${bannerClass} relative`} />

        {/* Avatar overlapping banner */}
        <div className="px-4 pb-4">
          <div className="-mt-10 mb-3 flex items-end justify-between">
            <div className="relative">
              <Avatar className={`h-20 w-20 ring-4 ring-background ${avatarColor}`}>
                <AvatarFallback className={`text-white text-xl font-bold ${avatarColor}`}>
                  {getInitials(senderName)}
                </AvatarFallback>
              </Avatar>
              {/* Role icon badge */}
              <span className={`absolute -bottom-1 -right-1 rounded-full p-1 ring-2 ring-background
                ${isAdmin ? "bg-amber-500" : isTeacher ? "bg-primary" : "bg-muted border"}`}>
                {isAdmin
                  ? <Crown className="h-3.5 w-3.5 text-white" />
                  : isTeacher
                  ? <ShieldCheck className="h-3.5 w-3.5 text-white" />
                  : <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />}
              </span>
            </div>
            <Badge variant="outline" className={`text-xs px-2 py-0.5 ${roleColor}`}>
              {roleLabel}
            </Badge>
          </div>

          {/* Name + DM button */}
          <div className="flex items-start justify-between gap-2">
            <h2 className={`text-lg font-bold leading-tight ${isAdmin ? "text-amber-500" : ""}`}>
              {senderName}
            </h2>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 shrink-0"
              onClick={() => { onClose(); navigate(`/student/dms?user=${senderId}&name=${encodeURIComponent(senderName)}`); }}>
              <MessageSquare className="h-3 w-3" /> Message
            </Button>
          </div>

          {/* Badges section */}
          {earnedBadges.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Badges
              </p>
              <div className="flex flex-wrap gap-2">
                {earnedBadges.map(b => (
                  <div
                    key={b.name}
                    className="flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium"
                    title={b.desc}
                  >
                    {b.img
                      ? <img src={b.img} alt={b.name} className="h-4 w-4 object-contain" />
                      : <span className={b.animClass}>{b.emoji}</span>}
                    {b.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activities section */}
          {(activities.length > 0 || currentActivityTitle) && (
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Activities
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activities.length > 0
                  ? activities.map((a, i) => (
                      <span key={i} className="rounded-full bg-secondary/20 text-secondary-foreground text-xs px-2.5 py-0.5 border border-secondary/30">
                        {a.title}
                      </span>
                    ))
                  : currentActivityTitle && (
                      <span className="rounded-full bg-secondary/20 text-secondary-foreground text-xs px-2.5 py-0.5 border border-secondary/30">
                        {currentActivityTitle}
                      </span>
                    )}
              </div>
            </div>
          )}

          {earnedBadges.length === 0 && activities.length === 0 && !currentActivityTitle && (
            <p className="mt-4 text-xs text-muted-foreground">No badges yet.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
