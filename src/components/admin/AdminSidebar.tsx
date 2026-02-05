 import { useLocation, useNavigate } from "react-router-dom";
 import { supabase } from "@/integrations/supabase/client";
 import { useEffect, useState } from "react";
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
 } from "lucide-react";
 import schoolLogo from "@/assets/school-logo.png";
 
 const menuItems = [
   {
     title: "Dashboard",
     url: "/admin",
     icon: LayoutDashboard,
     description: "Overview",
   },
   {
     title: "User Management",
     url: "/admin/user-management",
     icon: UserCog,
     description: "Manage users and roles",
   },
   {
     title: "Manage Activities",
     url: "/admin/activities",
     icon: Shield,
     description: "Add, edit activities",
   },
   {
     title: "Manual Allocation",
     url: "/admin/manual-allocations",
     icon: Users,
     description: "Assign students",
   },
   {
     title: "Auto Allocation",
     url: "/admin/allocations",
     icon: Shield,
     description: "Auto-allocate",
   },
   {
     title: "View Allocations",
     url: "/admin/view-allocations",
     icon: Users,
     description: "See assignments",
   },
   {
     title: "Activity Roster",
     url: "/admin/activity-roster",
     icon: BookOpen,
     description: "View rosters",
   },
   {
     title: "Attendance",
     url: "/admin/attendance",
     icon: ClipboardCheck,
     description: "Take attendance",
   },
   {
     title: "Attendance Reports",
     url: "/admin/attendance-reports",
     icon: AlertTriangle,
     description: "View reports",
   },
   {
     title: "Pre-Excuse Students",
     url: "/admin/pre-excuse",
     icon: UserCheck,
     description: "Excuse students",
   },
   {
     title: "AI Weekly Summary",
     url: "/admin/weekly-summary",
     icon: Sparkles,
     description: "AI reports",
     highlight: true,
   },
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
 
   return (
     <Sidebar collapsible="icon" className="border-r border-sidebar-border">
       <SidebarHeader className="p-4">
         <div className="flex items-center gap-3">
           <img
             src={schoolLogo}
             alt="NLS Logo"
             className="h-10 w-10 rounded-lg object-contain bg-white p-1"
           />
           {!collapsed && (
             <div className="flex flex-col">
               <span className="font-semibold text-sidebar-foreground">NLS Admin</span>
               <span className="text-xs text-muted-foreground">Co-Curricular</span>
             </div>
           )}
         </div>
       </SidebarHeader>
 
       <SidebarContent>
         <SidebarGroup>
           <SidebarGroupLabel>Navigation</SidebarGroupLabel>
           <SidebarGroupContent>
             <SidebarMenu>
               {menuItems.map((item) => {
                 const isActive = location.pathname === item.url;
                 return (
                   <SidebarMenuItem key={item.title}>
                     <SidebarMenuButton
                       asChild
                       isActive={isActive}
                       tooltip={item.title}
                       className={item.highlight ? "text-primary" : ""}
                     >
                       <button
                         onClick={() => navigate(item.url)}
                         className="w-full flex items-center gap-3"
                       >
                         <item.icon className={`h-4 w-4 ${item.highlight ? "text-primary" : ""}`} />
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