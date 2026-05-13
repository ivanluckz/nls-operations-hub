import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield, Users, GraduationCap, Activity,
  Heart, ChefHat, BookOpen, ArrowRight, Eye,
  BarChart3, ClipboardList, Calendar, MessageSquare,
  QrCode, FileSpreadsheet, Sparkles, Bell
} from "lucide-react";

const ROLES = [
  {
    id: "admin",
    label: "Admin",
    color: "bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20",
    badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    icon: Shield,
    iconColor: "text-purple-400",
    tagline: "Full platform control",
    features: [
      { icon: Users, text: "Manage all 400+ users across every role" },
      { icon: BarChart3, text: "Real-time operations dashboard with live metrics" },
      { icon: Sparkles, text: "AI-powered weekly attendance summary in 1 click" },
      { icon: FileSpreadsheet, text: "Export everything to Excel (5 sheets) or CSV" },
      { icon: ClipboardList, text: "Smart activity allocation engine" },
      { icon: MessageSquare, text: "Broadcast messages to any role or group" },
    ],
    preview: "See enrolment rates, attendance trends, capacity alerts, and this week's AI-generated summary — all from one screen.",
  },
  {
    id: "moderator",
    label: "Moderator",
    color: "bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20",
    badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: BookOpen,
    iconColor: "text-blue-400",
    tagline: "Activity & allocation oversight",
    features: [
      { icon: ClipboardList, text: "Create and manage co-curricular activities" },
      { icon: Users, text: "Run automated student allocations" },
      { icon: Calendar, text: "View weekly timetable and rosters" },
      { icon: Eye, text: "Live attendance oversight across all sessions" },
      { icon: Bell, text: "Pre-excuse students before sessions start" },
      { icon: FileSpreadsheet, text: "Download full allocation reports" },
    ],
    preview: "Oversee all activities, trigger the allocation engine, monitor attendance in real-time, and generate weekly reports.",
  },
  {
    id: "teacher",
    label: "Teacher",
    color: "bg-green-500/10 border-green-500/30 hover:bg-green-500/20",
    badgeColor: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: GraduationCap,
    iconColor: "text-green-400",
    tagline: "Attendance & class management",
    features: [
      { icon: QrCode, text: "QR scan or bulk-tap to submit attendance" },
      { icon: ClipboardList, text: "View your assigned activity rosters" },
      { icon: BarChart3, text: "Attendance history and reports for your classes" },
      { icon: MessageSquare, text: "Message students in your activities" },
      { icon: Bell, text: "Push notifications to your class" },
      { icon: Calendar, text: "See your weekly schedule at a glance" },
    ],
    preview: "Submit attendance for your activities in seconds — QR scan or tap through the roster. See who's absent, late, or excused.",
  },
  {
    id: "student",
    label: "Student",
    color: "bg-yellow-500/10 border-yellow-500/30 hover:bg-yellow-500/20",
    badgeColor: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    icon: Activity,
    iconColor: "text-yellow-400",
    tagline: "My schedule & activities",
    features: [
      { icon: ClipboardList, text: "Browse and rank activity preferences" },
      { icon: QrCode, text: "QR student ID for fast check-in" },
      { icon: Activity, text: "Attendance streaks and milestone badges" },
      { icon: BarChart3, text: "School-wide leaderboard" },
      { icon: Calendar, text: "Sync your timetable to Google Calendar" },
      { icon: MessageSquare, text: "Messages from teachers and activity leads" },
    ],
    preview: "Submit activity preferences, track your attendance streak, earn badges, and check your personalised timetable.",
  },
  {
    id: "rl_coach",
    label: "RL Coach",
    color: "bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20",
    badgeColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    icon: Activity,
    iconColor: "text-orange-400",
    tagline: "Workout & fitness tracking",
    features: [
      { icon: Activity, text: "Track workout session attendance" },
      { icon: BarChart3, text: "Performance and participation reports" },
      { icon: ClipboardList, text: "Session rosters with clearance status" },
      { icon: Bell, text: "Flag students with medical clearance holds" },
      { icon: FileSpreadsheet, text: "Export session data for coaching staff" },
      { icon: Calendar, text: "Workout schedule and session history" },
    ],
    preview: "Track which students attended each workout session, view performance trends, and manage medical clearance flags.",
  },
  {
    id: "medical",
    label: "Medical",
    color: "bg-red-500/10 border-red-500/30 hover:bg-red-500/20",
    badgeColor: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: Heart,
    iconColor: "text-red-400",
    tagline: "Health & clearance management",
    features: [
      { icon: Heart, text: "Log student medical visits with condition notes" },
      { icon: ClipboardList, text: "Searchable visit history for every student" },
      { icon: Shield, text: "Issue and revoke activity clearances" },
      { icon: Bell, text: "Flag students restricted from physical activities" },
      { icon: Users, text: "Track repeat visitors and chronic conditions" },
      { icon: FileSpreadsheet, text: "Export medical visit reports" },
    ],
    preview: "Replace the nurse's notebook — log visits, track conditions, issue clearances, and flag students who can't participate in sports.",
  },
  {
    id: "kitchen",
    label: "Kitchen",
    color: "bg-teal-500/10 border-teal-500/30 hover:bg-teal-500/20",
    badgeColor: "bg-teal-500/20 text-teal-400 border-teal-500/30",
    icon: ChefHat,
    iconColor: "text-teal-400",
    tagline: "Meal attendance & reporting",
    features: [
      { icon: QrCode, text: "QR scan for fast meal check-in" },
      { icon: BarChart3, text: "Daily and weekly meal attendance stats" },
      { icon: ChefHat, text: "Live headcount for meal planning" },
      { icon: FileSpreadsheet, text: "Export daily meal reports" },
      { icon: Bell, text: "Flag dietary restrictions and allergies" },
      { icon: ClipboardList, text: "Meal history per student" },
    ],
    preview: "Replace the kitchen clipboard — QR scan students in, see live headcount, and download daily meal reports.",
  },
];

export default function DemoRolePreview() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<typeof ROLES[0] | null>(null);

  return (
    <section className="py-20 bg-muted/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10 space-y-2">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full border border-primary/20 mb-2">
            <Eye className="w-4 h-4" />
            Live Preview
          </div>
          <h2 className="text-3xl font-bold">See it as every role</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            NLS Operations Hub has 7 role-specific dashboards. Pick one to see exactly what that user experiences.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-4xl mx-auto">
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <button
                key={role.id}
                onClick={() => setSelected(role)}
                className={`group flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all text-left ${role.color}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-background/50`}>
                  <Icon className={`w-5 h-5 ${role.iconColor}`} />
                </div>
                <div>
                  <div className="font-semibold text-sm text-center">{role.label}</div>
                  <div className="text-xs text-muted-foreground text-center mt-0.5">{role.tagline}</div>
                </div>
                <Badge variant="outline" className={`text-xs mt-auto ${role.badgeColor}`}>
                  Preview →
                </Badge>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview Modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-muted`}>
                    <selected.icon className={`w-5 h-5 ${selected.iconColor}`} />
                  </div>
                  <div>
                    <DialogTitle className="text-lg">{selected.label} Dashboard</DialogTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{selected.tagline}</p>
                  </div>
                  <Badge variant="outline" className={`ml-auto text-xs ${selected.badgeColor}`}>
                    {selected.label}
                  </Badge>
                </div>
              </DialogHeader>

              <p className="text-sm text-muted-foreground bg-muted/40 rounded-xl p-3 border">
                {selected.preview}
              </p>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">What this role can do</p>
                <ul className="space-y-2">
                  {selected.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm">
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <f.icon className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      {f.text}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2 pt-2">
                <Button className="flex-1" onClick={() => { setSelected(null); navigate("/auth"); }}>
                  Sign in to explore
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
                <Button variant="outline" onClick={() => setSelected(null)} className="flex-1">
                  See other roles
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
