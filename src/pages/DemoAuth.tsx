import { useNavigate } from "react-router-dom";
import { setDemoRole, DEMO_USERS, type DemoRole } from "@/lib/demo-mode";
import { Shield, BookOpen, GraduationCap, Activity, Heart, Users, ArrowRight, Sparkles } from "lucide-react";

const ROLE_CONFIG = {
  admin:     { icon: Shield,      color: "from-purple-500 to-purple-700", bg: "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30", label: "Admin",     desc: "Full platform control — users, allocations, reports, AI insights" },
  moderator: { icon: BookOpen,    color: "from-blue-500 to-blue-700",     bg: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30",       label: "Moderator", desc: "Manage activities, run allocations, oversee attendance" },
  teacher:   { icon: Users,       color: "from-green-500 to-green-700",   bg: "bg-green-500/10 hover:bg-green-500/20 border-green-500/30",    label: "Teacher",   desc: "Submit attendance via QR, view your class rosters" },
  student:   { icon: GraduationCap, color: "from-yellow-500 to-yellow-600", bg: "bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/30", label: "Student", desc: "Browse activities, track your streak and leaderboard rank" },
  rl_coach:  { icon: Activity,    color: "from-orange-500 to-orange-700", bg: "bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30", label: "RL Coach",  desc: "Workout session tracking and performance reports" },
  medical:   { icon: Heart,       color: "from-red-500 to-red-700",       bg: "bg-red-500/10 hover:bg-red-500/20 border-red-500/30",          label: "Medical",   desc: "Log student visits, manage clearances and activity restrictions" },
} as const;

const ROLE_PATHS: Record<DemoRole, string> = {
  admin: "/admin", moderator: "/moderator", teacher: "/teacher",
  student: "/student", rl_coach: "/rl-coach", medical: "/medical",
};

export default function DemoAuth() {
  const navigate = useNavigate();

  const enter = (role: DemoRole) => {
    setDemoRole(role);
    navigate(ROLE_PATHS[role]);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/20 blur-3xl animate-pulse" style={{ animationDuration: "8s" }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-secondary/20 blur-3xl animate-pulse" style={{ animationDuration: "10s", animationDelay: "2s" }} />

      <div className="relative z-10 w-full max-w-2xl space-y-8 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full border border-primary/20">
            <Sparkles className="w-4 h-4" />
            Interactive Demo
          </div>
          <h1 className="text-4xl font-bold tracking-tight">NLS Operations Hub</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Pick a role to explore the platform. All data is pre-loaded — no sign-in required.
          </p>
        </div>

        {/* Role cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {DEMO_USERS.map((user) => {
            const cfg = ROLE_CONFIG[user.role];
            const Icon = cfg.icon;
            return (
              <button
                key={user.role}
                onClick={() => enter(user.role)}
                className={`group flex flex-col gap-3 p-4 rounded-2xl border text-left transition-all duration-200 ${cfg.bg}`}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cfg.color} flex items-center justify-center shrink-0`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="space-y-1">
                  <div className="font-semibold text-sm">{cfg.label}</div>
                  <div className="text-xs text-muted-foreground leading-snug">{cfg.desc}</div>
                  <div className="text-xs text-muted-foreground/70 pt-0.5 truncate">{user.name}</div>
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-primary mt-auto">
                  Enter <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          NLS · Ntare-Louise Nlund School · Kigali, Rwanda
        </p>
      </div>
    </div>
  );
}
