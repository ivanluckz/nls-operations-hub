import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  UserCog,
  Shield,
  Users,
  BookOpen,
  ClipboardCheck,
  AlertTriangle,
  UserCheck,
  Sparkles,
  LogOut,
  ChevronUp,
  Settings,
  LayoutDashboard,
  MessageSquare,
  Award,
  Zap,
} from "lucide-react";

import nlsLogo from "@/assets/nls-logo.png";

const coCurricularItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard, description: "Overview" },
  { title: "User Management", url: "/admin/user-management", icon: UserCog, description: "Manage users and roles" },
  { title: "Manage Activities", url: "/admin/co-curricular/activities", icon: Shield, description: "Add, edit activities" },
  { title: "Manual Allocation", url: "/admin/co-curricular/manual-allocations", icon: Users, description: "Assign students" },
  { title: "Auto Allocation", url: "/admin/co-curricular/allocations", icon: Shield, description: "Auto-allocate" },
  { title: "View Allocations", url: "/admin/co-curricular/view-allocations", icon: Users, description: "See assignments" },
  { title: "Activity Roster", url: "/admin/co-curricular/activity-roster", icon: BookOpen, description: "View rosters" },
  { title: "Attendance", url: "/admin/co-curricular/attendance", icon: ClipboardCheck, description: "Take attendance" },
  { title: "Attendance Reports", url: "/admin/co-curricular/attendance-reports", icon: AlertTriangle, description: "View reports" },
  { title: "Pre-Excuse Students", url: "/admin/co-curricular/pre-excuse", icon: UserCheck, description: "Excuse students" },
  { title: "AI Weekly Summary", url: "/admin/co-curricular/weekly-summary", icon: Sparkles, description: "AI reports", highlight: true },
  { title: "All Chats", url: "/admin/co-curricular/messages", icon: MessageSquare, description: "View all activity chats" },
  { title: "Badge Requests", url: "/admin/co-curricular/badge-requests", icon: Award, description: "Approve student badges" },
  { title: "Admin AI", url: "/admin/admin-ai", icon: Zap, description: "AI-powered request processing", highlight: true },
  { title: "Direct Messages", url: "/admin/dms", icon: MessageSquare, description: "Message anyone directly" },
];

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
}

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("id, email, full_name, avatar_url")
          .eq("id", user.id)
          .single();
        if (data) setProfile(data);
      }
    };
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Logout error:", error);
      setLoggingOut(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const menuItems = coCurricularItems;
  const sectionLabel = "Co-curricular";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img
            src={nlsLogo}
            alt="NLS Logo"
            className="h-10 w-10 rounded-lg object-cover"
          />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-sidebar-foreground">NLS Admin</span>
              <span className="text-xs text-muted-foreground">{sectionLabel}</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{sectionLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location.pathname === item.url;
                const isHighlighted = 'highlight' in item && item.highlight;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={isHighlighted ? "text-primary" : ""}
                    >
                      <button
                        onClick={() => navigate(item.url)}
                        className="w-full flex items-center gap-3"
                      >
                        <item.icon className={`h-4 w-4 ${isHighlighted ? "text-primary" : ""}`} />
                        <span>{item.title}</span>
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={`w-full justify-start gap-3 h-auto py-3 ${collapsed ? "px-2" : "px-3"}`}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {profile ? getInitials(profile.full_name) : "U"}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex flex-col items-start text-left flex-1 min-w-0">
                    <span className="text-sm font-medium truncate w-full">
                      {profile?.full_name || "Admin"}
                    </span>
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {profile?.email || ""}
                    </span>
                  </div>
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => navigate("/admin/profile")}>
              <Settings className="mr-2 h-4 w-4" />
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-sm text-muted-foreground">Dark mode</span>
              <ThemeToggle className="h-7 w-7" />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} disabled={loggingOut}>
              <LogOut className="mr-2 h-4 w-4" />
              {loggingOut ? "Logging out..." : "Logout"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
