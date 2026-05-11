import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "student" | "moderator" | "admin" | "teacher" | "rl_coach" | "medical";
}

/** Admin pages Dev badge holders can view (read-only) */
const DEV_ALLOWED_ADMIN_PAGES = [
  "/admin",
  "/admin/co-curricular/view-allocations",
  "/admin/co-curricular/activity-roster",
  "/admin/co-curricular/attendance-reports",
  "/admin/co-curricular/weekly-summary",
  "/admin/co-curricular/messages",
  "/admin/co-curricular/badge-requests",
];

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [allRoles, setAllRoles] = useState<string[]>([]);
  const [hasDevBadge, setHasDevBadge] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      setUser(authUser ?? null);
      if (authUser) {
        fetchUserRole(authUser.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        fetchUserRole(sessionUser.id);
      } else {
        setUserRole(null);
        setAllRoles([]);
        setHasDevBadge(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("banned")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;
      
      if (profile?.banned) {
        await supabase.auth.signOut();
        setUserRole(null);
        setUser(null);
        return;
      }

      // Fetch all roles and Dev badge in parallel
      const [{ data: rolesData, error: rolesError }, { data: devBadge }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        (supabase as any).from("user_badges").select("id").eq("user_id", userId).eq("badge_name", "Dev").maybeSingle(),
      ]);

      if (rolesError) throw rolesError;
      
      // Pick the highest-priority role if user has multiple
      const rolePriority = ['admin', 'moderator', 'teacher', 'rl_coach', 'medical', 'student'] as const;
      const userRoles = (rolesData || []).map((r: any) => r.role);
      const primaryRole = rolePriority.find(r => userRoles.includes(r)) || userRoles[0] || null;
      
      console.log('ProtectedRoute - User roles:', userRoles, 'Primary role:', primaryRole, 'Required role:', requiredRole);
      
      setUserRole(primaryRole);
      setAllRoles(userRoles);
      setHasDevBadge(!!devBadge);
    } catch (error) {
      console.error("Error fetching user role:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredRole && !allRoles.includes(requiredRole)) {    console.log('ProtectedRoute - Redirecting user. Required role:', requiredRole, 'User roles:', allRoles);    // Dev badge holders can access certain admin pages as read-only
    if (requiredRole === "admin" && hasDevBadge && allRoles.includes("student")) {
      const currentPath = window.location.pathname;
      if (DEV_ALLOWED_ADMIN_PAGES.includes(currentPath)) {
        return <>{children}</>;
      }
    }

    if (allRoles.includes("admin")) return <Navigate to="/admin" replace />;
    if (allRoles.includes("moderator")) return <Navigate to="/moderator" replace />;
    if (allRoles.includes("teacher")) return <Navigate to="/teacher" replace />;
    if (allRoles.includes("rl_coach")) return <Navigate to="/rl-coach" replace />;
    if (allRoles.includes("medical")) return <Navigate to="/medical" replace />;
    return <Navigate to="/student" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
