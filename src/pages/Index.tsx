import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Users, BookOpen, Sparkles, ArrowRight, MessageCircle } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAuthAndRedirect();
  }, []);

  const checkAuthAndRedirect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (roleError) {
          console.error("Error fetching user role:", roleError);
          // If role fetch fails, redirect to student dashboard as fallback
          navigate("/student");
          return;
        }

        const role = roleData?.role;
        if (role === "admin") {
          navigate("/admin");
        } else if (role === "moderator") {
          navigate("/moderator");
        } else if (role === "teacher") {
          navigate("/teacher");
        } else if (role === "kitchen_staff") {
          navigate("/kitchen");
        } else if (role === "rl_coach") {
          navigate("/rl-coach");
        } else {
          // Default to student for any other role or missing role
          navigate("/student");
        }
      }
    } catch (error) {
      console.error("Error checking auth:", error);
    } finally {
      setChecking(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Admin Link - Top Right Corner */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/auth")}
        className="fixed top-4 right-4 z-50 text-xs text-muted-foreground hover:text-foreground"
      >
        Admin
      </Button>

      {/* Hero Section */}
      <section className="relative bg-gradient-hero text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm mb-4">
              <GraduationCap className="w-10 h-10" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              Co-Curricular Activity
              <br />
              Allocation System
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/90 max-w-2xl mx-auto">
              A fair and transparent system for managing student preferences
              and allocating co-curricular activities efficiently.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="bg-white text-primary hover:bg-white/90 shadow-elevated"
              >
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/auth")}
                className="border-white text-white hover:bg-white/10"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our intelligent allocation system ensures fair distribution of
              activities based on student preferences.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="shadow-card hover:shadow-elevated transition-shadow">
              <CardContent className="pt-6 text-center space-y-3">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-primary text-primary-foreground mb-2">
                  <Users className="w-7 h-7" />
                </div>
                <h3 className="font-semibold text-lg">For Students</h3>
                <p className="text-sm text-muted-foreground">
                  Browse activities, submit your ranked preferences, and receive
                  fair allocations based on your choices and availability.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-elevated transition-shadow">
              <CardContent className="pt-6 text-center space-y-3">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-secondary text-secondary-foreground mb-2">
                  <BookOpen className="w-7 h-7" />
                </div>
                <h3 className="font-semibold text-lg">For Moderators</h3>
                <p className="text-sm text-muted-foreground">
                  Manage activities, view statistics, and run automated
                  allocations with AI-powered fairness algorithms.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-elevated transition-shadow">
              <CardContent className="pt-6 text-center space-y-3">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent text-accent-foreground mb-2">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h3 className="font-semibold text-lg">AI Allocation</h3>
                <p className="text-sm text-muted-foreground">
                  Smart algorithms respect capacity limits while maximizing
                  student satisfaction and ensuring fair distribution.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl font-bold">Ready to Get Started?</h2>
            <p className="text-muted-foreground">
              Join hundreds of students and moderators using our platform to
              streamline co-curricular activity management.
            </p>
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="shadow-elevated"
            >
              Create Your Account
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Chatbot FAB */}
      <Button
        size="lg"
        onClick={() => navigate("/chatbot")}
        className="fixed bottom-6 right-6 rounded-full h-14 w-14 shadow-elevated z-50"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Co-Curricular Allocation System. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
