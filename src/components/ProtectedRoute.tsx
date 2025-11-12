import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "student" | "moderator" | "admin" | "teacher";
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      // Check if user is banned
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

      // Fetch role from secure user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles" as any)
        .select("role")
        .eq("user_id", userId)
        .single();

      if (roleError) throw roleError;
      
      setUserRole((roleData as any)?.role || null);
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
    if (userRole === "admin") return <Navigate to="/admin" replace />;
    if (userRole === "moderator") return <Navigate to="/moderator" replace />;
    if (userRole === "teacher") return <Navigate to="/teacher" replace />;
    return <Navigate to="/student" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
