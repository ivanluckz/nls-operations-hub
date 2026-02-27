 import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
 import { AdminSidebar } from "./AdminSidebar";
 import { Separator } from "@/components/ui/separator";
 import {
   Breadcrumb,
   BreadcrumbItem,
   BreadcrumbLink,
   BreadcrumbList,
   BreadcrumbPage,
   BreadcrumbSeparator,
 } from "@/components/ui/breadcrumb";
 import { useLocation } from "react-router-dom";
 
 interface AdminLayoutProps {
   children: React.ReactNode;
   title?: string;
   description?: string;
 }
 
 const pageTitles: Record<string, { title: string; description: string }> = {
   "/admin": { title: "Dashboard", description: "Overview of all administrative functions" },
   "/admin/user-management": { title: "User Management", description: "Manage users and roles" },
   "/admin/activities": { title: "Manage Activities", description: "Add, edit, or remove co-curricular activities" },
   "/admin/manual-allocations": { title: "Manual Allocation", description: "Manually assign students to activities" },
   "/admin/allocations": { title: "Auto Allocation", description: "Auto-allocate based on preferences" },
   "/admin/view-allocations": { title: "View Allocations", description: "See all student activity assignments" },
   "/admin/activity-roster": { title: "Activity Roster", description: "View activities and enrolled students" },
   "/admin/attendance": { title: "Attendance", description: "Take and view attendance records" },
   "/admin/attendance-reports": { title: "Attendance Reports", description: "View absent, late, and excused students" },
   "/admin/pre-excuse": { title: "Pre-Excuse Students", description: "Excuse students for past, present, or future dates" },
   "/admin/weekly-summary": { title: "AI Weekly Summary", description: "AI-powered attendance trend reports" },
   "/admin/profile": { title: "Profile Settings", description: "Manage your account settings" },
   "/admin/messages": { title: "All Chats", description: "View and moderate all activity channel messages" },
   "/admin/badge-requests": { title: "Badge Requests", description: "Review and approve student badge requests" },
  "/admin/academic/subjects":   { title: "Subjects",            description: "Manage academic subjects" },
  "/admin/academic/classes":    { title: "Class Groups",        description: "Manage class groups and student membership" },
  "/admin/academic/timetable":  { title: "Timetable",           description: "Build and manage the master timetable" },
  "/admin/academic/attendance": { title: "Academic Attendance", description: "View academic attendance reports" },
 };
 
 export function AdminLayout({ children, title, description }: AdminLayoutProps) {
   const location = useLocation();
   const pageInfo = pageTitles[location.pathname] || { title: title || "Admin", description: description || "" };
 
   return (
     <SidebarProvider>
       <div className="min-h-screen flex w-full">
         <AdminSidebar />
         <SidebarInset className="flex-1">
           <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
             <SidebarTrigger className="-ml-1" />
             <Separator orientation="vertical" className="mr-2 h-4" />
             <Breadcrumb>
               <BreadcrumbList>
                 <BreadcrumbItem className="hidden md:block">
                   <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
                 </BreadcrumbItem>
                 {location.pathname !== "/admin" && (
                   <>
                     <BreadcrumbSeparator className="hidden md:block" />
                     <BreadcrumbItem>
                       <BreadcrumbPage>{pageInfo.title}</BreadcrumbPage>
                     </BreadcrumbItem>
                   </>
                 )}
               </BreadcrumbList>
             </Breadcrumb>
           </header>
           <main className="flex-1 p-6">
             {children}
           </main>
         </SidebarInset>
       </div>
     </SidebarProvider>
   );
 }