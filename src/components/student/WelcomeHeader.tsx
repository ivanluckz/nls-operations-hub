import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ThemePicker } from "./ThemePicker";
import { LogOut, Sparkles } from "lucide-react";
import devBadgeImg from "@/assets/dev.png";
import HouseBadge from "@/components/ui/HouseBadge";

const BADGE_EMOJI: Record<string, string> = {
  "Growing": "🌱",
  "Star Student": "⭐",
  "Leader": "👑",
  "On Fire": "🔥",
  "Creative": "💡",
  "Team Player": "🤝",
};

interface WelcomeHeaderProps {
  name: string;
  onLogout: () => void;
  badges?: string[];
}

const WelcomeHeader = ({ name, onLogout, badges = [] }: WelcomeHeaderProps) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const isDev = badges.includes("Dev");

  return (
    <header className="relative overflow-hidden glass-nav sticky top-0 z-30">
      {/* Decorative elements */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      
      <div className="container relative mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
                isDev
                  ? "dev-avatar-ring bg-gradient-to-br from-primary to-primary/80 shadow-primary/25"
                  : "bg-gradient-to-br from-primary to-primary/80 shadow-primary/25"
              }`}>
                <span className="text-2xl font-bold text-primary-foreground">
                  {name?.charAt(0)?.toUpperCase() || "S"}
                </span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-success rounded-full border-2 border-background flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-success-foreground" />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">{getGreeting()}</p>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                {isDev ? (
                  <span className="dev-nameplate dev-name-glow">{name}</span>
                ) : (
                  name
                )}
                {isDev && <img src={devBadgeImg} alt="Dev" className="h-6 w-6 object-contain" />}
              </h1>
              {/* Badge pills */}
              {badges.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {badges.map((badge) => (
                    <span
                      key={badge}
                      className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                    >
                      {badge === "Dev" ? (
                        <img src={devBadgeImg} alt="Dev" className="h-3.5 w-3.5 object-contain" />
                      ) : (
                        <span>{BADGE_EMOJI[badge] || "🏅"}</span>
                      )}
                      {badge}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <HouseBadge />
            <ThemePicker />
            <ThemeToggle />
            <Button
              variant="outline"
              onClick={onLogout}
              className="gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default WelcomeHeader;