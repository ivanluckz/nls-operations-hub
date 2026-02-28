import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Crown, ShieldCheck } from "lucide-react";

const AVATAR_COLORS = [
  "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500",
  "bg-teal-500", "bg-blue-500", "bg-violet-500", "bg-pink-500",
];

function hashId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}
export function getAvatarColor(id: string) { return AVATAR_COLORS[hashId(id) % AVATAR_COLORS.length]; }
export function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}

interface RoleAvatarProps {
  userId: string;
  name: string;
  isAdmin?: boolean;
  isMod?: boolean;
  isDev?: boolean;
  /** Tailwind size classes for the avatar, e.g. "h-9 w-9" */
  avatarSize?: string;
  /** Tailwind text size for initials, e.g. "text-xs" */
  textSize?: string;
  /** Extra classes on the wrapper div */
  className?: string;
}

/**
 * Avatar with optional role-badge overlay and Dev decoration ring.
 * Admin → amber crown. Teacher/Moderator → primary shield.
 * Dev → spinning rainbow ring (Discord Nitro-style avatar decoration).
 */
export function RoleAvatar({
  userId,
  name,
  isAdmin = false,
  isMod = false,
  isDev = false,
  avatarSize = "h-9 w-9",
  textSize = "text-xs",
  className = "",
}: RoleAvatarProps) {
  const color = getAvatarColor(userId);
  const showBadge = isAdmin || isMod;

  const avatarEl = (
    <Avatar className={`${avatarSize} ${color}`}>
      <AvatarFallback className={`text-white font-bold ${textSize} ${color}`}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <div className={`relative flex-shrink-0 ${className}`}>
      {isDev ? (
        <div className="dev-ring">
          <div className="dev-ring-inner">{avatarEl}</div>
        </div>
      ) : avatarEl}
      {showBadge && (
        <span
          className={`absolute -bottom-1 -right-1 rounded-full p-1 ring-2 ring-background
            ${isAdmin ? "bg-amber-500" : "bg-primary"}`}
        >
          {isAdmin
            ? <Crown className="h-3 w-3 text-white" />
            : <ShieldCheck className="h-3 w-3 text-white" />}
        </span>
      )}
    </div>
  );
}
