import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Crown, ShieldCheck, GraduationCap, MessageSquare, Check, X } from "lucide-react";
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

// Preset sparkle particles for the Dev profile effect
const DEV_PARTICLES: { x: string; delay: string; color: string }[] = [
  { x: "8%",  delay: "0s",    color: "#f472b6" },
  { x: "18%", delay: "0.4s",  color: "#818cf8" },
  { x: "28%", delay: "0.8s",  color: "#22d3ee" },
  { x: "38%", delay: "1.2s",  color: "#4ade80" },
  { x: "48%", delay: "0.2s",  color: "#facc15" },
  { x: "58%", delay: "1.6s",  color: "#f472b6" },
  { x: "68%", delay: "0.6s",  color: "#818cf8" },
  { x: "78%", delay: "1.0s",  color: "#22d3ee" },
  { x: "88%", delay: "1.4s",  color: "#4ade80" },
  { x: "13%", delay: "1.8s",  color: "#facc15" },
  { x: "53%", delay: "0.9s",  color: "#f472b6" },
  { x: "73%", delay: "2.2s",  color: "#818cf8" },
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
  /** When true, the admin badge-grant panel is shown */
  isAdminViewing?: boolean;
  /** Called after admin grants a badge so the parent can refresh badge data */
  onBadgeGranted?: (badgeName: string) => void;
  /** Called after admin removes a badge so the parent can refresh badge data */
  onBadgeRemoved?: (badgeName: string) => void;
}

interface UserActivity {
  title: string;
}

export function UserProfileCard({
  open, onClose, senderId, senderName, isAdmin, isTeacher, badges,
  currentActivityTitle, isAdminViewing, onBadgeGranted, onBadgeRemoved,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [localBadges, setLocalBadges] = useState<string[]>(badges);
  const [grantingBadge, setGrantingBadge] = useState<string | null>(null);
  const [removingBadge, setRemovingBadge] = useState<string | null>(null);

  // Sync local badge state if the parent passes new data
  useEffect(() => { setLocalBadges(badges); }, [badges]);

  useEffect(() => {
    if (!open || !senderId) return;
    supabase
      .from("allocations")
      .select("activities(title)")
      .eq("student_id", senderId)
      .limit(10)
      .then(({ data }) => {
        if (data) {
          setActivities(
            data.map((r: any) => r.activities).filter(Boolean).map((a: any) => ({ title: a.title }))
          );
        }
      });
  }, [open, senderId]);

  const grantBadge = async (badgeName: string) => {
    if (localBadges.includes(badgeName)) return;
    setGrantingBadge(badgeName);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("user_badges")
        .upsert(
          { user_id: senderId, badge_name: badgeName, awarded_by: user?.id },
          { onConflict: "user_id,badge_name" }
        );
      if (error) throw error;
      setLocalBadges(prev => [...prev, badgeName]);
      onBadgeGranted?.(badgeName);
      toast({ title: `${badgeName} badge granted!`, description: `${senderName} now has the ${badgeName} badge.` });
    } catch {
      toast({ variant: "destructive", title: "Failed to grant badge" });
    } finally {
      setGrantingBadge(null);
    }
  };

  const removeBadge = async (badgeName: string) => {
    if (!localBadges.includes(badgeName)) return;
    setRemovingBadge(badgeName);
    try {
      const { error } = await (supabase as any)
        .from("user_badges")
        .delete()
        .eq("user_id", senderId)
        .eq("badge_name", badgeName);
      if (error) throw error;
      setLocalBadges(prev => prev.filter(b => b !== badgeName));
      onBadgeRemoved?.(badgeName);
      toast({ title: `${badgeName} badge removed`, description: `${senderName} no longer has the ${badgeName} badge.` });
    } catch {
      toast({ variant: "destructive", title: "Failed to remove badge" });
    } finally {
      setRemovingBadge(null);
    }
  };

  const isDev = localBadges.includes("Dev");
  const idx = hashId(senderId) % AVATAR_COLORS.length;
  const avatarColor = AVATAR_COLORS[idx];
  const bannerClass = BANNER_CLASSES[idx];

  const roleLabel = isAdmin ? "Admin" : isTeacher ? "Supervisor" : "Student";
  const roleColor = isAdmin
    ? "bg-amber-500/15 text-amber-600 border-amber-400/40"
    : isTeacher
    ? "bg-primary/15 text-primary border-primary/40"
    : "bg-muted text-muted-foreground border-border";

  const earnedBadges = BADGE_OPTIONS.filter(b => localBadges.includes(b.name));

  const dmBase = location.pathname.startsWith("/admin")
    ? "/admin"
    : location.pathname.startsWith("/teacher")
    ? "/teacher"
    : location.pathname.startsWith("/moderator")
    ? "/moderator"
    : "/student";
  const dmPath = `${dmBase}/dms?user=${senderId}&name=${encodeURIComponent(senderName)}`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-0 overflow-hidden max-w-sm rounded-xl border-0 shadow-2xl gap-0">
        {/* Banner — Dev users get animated rainbow gradient + floating sparkle particles */}
        <div className={`h-24 relative overflow-hidden ${isDev ? "dev-banner" : `bg-gradient-to-br ${bannerClass}`}`}>
          {isDev && DEV_PARTICLES.map((p, i) => (
            <span
              key={i}
              className="dev-particle"
              style={{ left: p.x, animationDelay: p.delay, background: p.color }}
            />
          ))}
        </div>

        {/* Avatar overlapping banner */}
        <div className="px-4 pb-4">
          <div className="-mt-10 mb-3 flex items-end justify-between">
            <div className="relative">
              <Avatar className={`h-20 w-20 ring-4 ring-background ${avatarColor}`}>
                <AvatarFallback className={`text-white text-xl font-bold ${avatarColor}`}>
                  {getInitials(senderName)}
                </AvatarFallback>
              </Avatar>
              <span className={`absolute -bottom-1 -right-1 rounded-full p-1.5 ring-2 ring-background
                ${isAdmin ? "bg-amber-500" : isTeacher ? "bg-primary" : "bg-muted border"}`}>
                {isAdmin
                  ? <Crown className="h-5 w-5 text-white" />
                  : isTeacher
                  ? <ShieldCheck className="h-5 w-5 text-white" />
                  : <GraduationCap className="h-5 w-5 text-muted-foreground" />}
              </span>
            </div>
            <Badge variant="outline" className={`text-xs px-2 py-0.5 ${roleColor}`}>
              {roleLabel}
            </Badge>
          </div>

          {/* Name + DM button */}
          <div className="flex items-start justify-between gap-2">
            <h2 className={`text-lg font-bold leading-tight flex items-center gap-1.5 ${isAdmin ? "text-amber-500" : ""}`}>
              {isDev
                ? <><span className="dev-nameplate dev-name-glow">{senderName}</span><img src={devBadge} alt="Dev" className="h-6 w-6 object-contain" /></>
                : senderName}
            </h2>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 shrink-0"
              onClick={() => { onClose(); navigate(dmPath); }}>
              <MessageSquare className="h-3 w-3" /> Message
            </Button>
          </div>

          {/* Earned badges */}
          {earnedBadges.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Badges</p>
              <div className="flex flex-wrap gap-2">
                {earnedBadges.map(b => (
                  <div key={b.name}
                    className="flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium"
                    title={b.desc}>
                    {b.img
                      ? <img src={b.img} alt={b.name} className="h-4 w-4 object-contain" />
                      : <span className={b.animClass}>{b.emoji}</span>}
                    {b.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activities */}
          {(activities.length > 0 || currentActivityTitle) && (
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Activities</p>
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

          {earnedBadges.length === 0 && activities.length === 0 && !currentActivityTitle && !isAdminViewing && (
            <p className="mt-4 text-xs text-muted-foreground">No badges yet.</p>
          )}

          {/* Admin: grant badge panel */}
          {isAdminViewing && (
            <div className="mt-4 border-t pt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Grant Badge
              </p>
              <div className="flex flex-wrap gap-2">
                {BADGE_OPTIONS.filter(b => b.name !== "Dev").map(b => {
                  const hasIt = localBadges.includes(b.name);
                  const isGranting = grantingBadge === b.name;
                  const isRemoving = removingBadge === b.name;
                  const busy = isGranting || isRemoving;
                  return (
                    <button
                      key={b.name}
                      onClick={() => hasIt ? removeBadge(b.name) : grantBadge(b.name)}
                      disabled={busy}
                      title={hasIt ? `Remove ${b.name} from ${senderName}` : `Grant ${b.name} to ${senderName}`}
                      className={`group flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors
                        ${hasIt
                          ? "border-primary/40 bg-primary/10 text-primary hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                          : "border-border bg-muted/50 hover:border-primary/50 hover:bg-primary/5 hover:text-primary cursor-pointer"}`}>
                      {b.img
                        ? <img src={b.img} alt={b.name} className="h-4 w-4 object-contain" />
                        : <span className={b.animClass}>{b.emoji}</span>}
                      {b.name}
                      {hasIt
                        ? <><Check className="h-3 w-3 ml-0.5 group-hover:hidden" /><X className="h-3 w-3 ml-0.5 hidden group-hover:block" /></>
                        : null}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Highlighted = already granted. Click to grant or remove.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
