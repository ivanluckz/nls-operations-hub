import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "student" | "moderator" | "admin" | "teacher" | "kitchen_staff" | "rl_coach" | "medical";
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

      // Fetch role and Dev badge in parallel
      const [{ data: roleData, error: roleError }, { data: devBadge }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId).single(),
        (supabase as any).from("user_badges").select("id").eq("user_id", userId).eq("badge_name", "Dev").maybeSingle(),
      ]);

      if (roleError) throw roleError;
      
      setUserRole(roleData?.role || null);
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

  if (requiredRole && userRole !== requiredRole) {
    // Dev badge holders can access certain admin pages as read-only
    if (requiredRole === "admin" && hasDevBadge && userRole === "student") {
      const currentPath = window.location.pathname;
      if (DEV_ALLOWED_ADMIN_PAGES.includes(currentPath)) {
        return <>{children}</>;
      }
    }

    if (userRole === "admin") return <Navigate to="/admin" replace />;
    if (userRole === "moderator") return <Navigate to="/moderator" replace />;
    if (userRole === "teacher") return <Navigate to="/teacher" replace />;
    if (userRole === "kitchen_staff") return <Navigate to="/kitchen" replace />;
    if (userRole === "rl_coach") return <Navigate to="/rl-coach" replace />;
    if (userRole === "medical") return <Navigate to="/medical" replace />;
    return <Navigate to="/student" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
