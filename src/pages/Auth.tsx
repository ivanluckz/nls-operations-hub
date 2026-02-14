import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, KeyRound } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  
  const {
    toast
  } = useToast();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInviteFlow, setIsInviteFlow] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: ""
  });

  // Check for invite token in URL hash or search params
  useEffect(() => {
    const checkInviteToken = async () => {
      const hash = window.location.hash;
      
      // Check for invite/recovery token in URL hash
      if (hash && (hash.includes('type=invite') || hash.includes('type=recovery'))) {
        setIsInviteFlow(true);
        
        // Supabase will automatically process the token
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error processing invite:', error);
          toast({
            variant: "destructive",
            title: "Invalid or Expired Link",
            description: "This invitation link is no longer valid. Please contact your administrator."
          });
          setIsInviteFlow(false);
        }
      }
    };
    
    checkInviteToken();
  }, [toast]);

  // Handle forgot password / reset request
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail.trim()) {
      toast({
        variant: "destructive",
        title: "Email Required",
        description: "Please enter your email address"
      });
      return;
    }
    
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/auth`
      });
      
      if (error) throw error;
      
      toast({
        title: "Password Reset Email Sent",
        description: "Check your email for a link to set your password. If you don't see it, check your spam folder."
      });
      
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to Send Reset Email",
        description: error.message || "Could not send reset email. Please try again."
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle password setup for invited users
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.password !== passwordForm.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords don't match",
        description: "Please make sure your passwords match"
      });
      return;
    }
    
    if (passwordForm.password.length < 8) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Password must be at least 8 characters"
      });
      return;
    }
    
    if (!/[A-Z]/.test(passwordForm.password) || !/[a-z]/.test(passwordForm.password) || !/[0-9]/.test(passwordForm.password)) {
      toast({
        variant: "destructive",
        title: "Weak password",
        description: "Password must contain uppercase, lowercase, and numbers"
      });
      return;
    }
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: passwordForm.password
      });
      
      if (error) throw error;
      
      toast({
        title: "Password Set Successfully!",
        description: "You can now access your account."
      });
      
      // Get user role and redirect
      if (data.user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .single();
        
        const role = roleData?.role;
        
        if (role === "moderator" || role === "admin") {
          navigate("/moderator");
        } else if (role === "teacher") {
          navigate("/teacher");
        } else {
          navigate("/student");
        }
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to Set Password",
        description: error.message || "Could not set password. Please try again."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (error) {
        toast({
          variant: "destructive",
          title: "Google Sign-In Failed",
          description: error.message || "Could not sign in with Google",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Google Sign-In Failed",
        description: error.message || "Could not sign in with Google",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Show forgot password form
  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
        <Card className="w-full max-w-md shadow-elevated">
          <CardHeader className="space-y-1 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center mb-2">
              <KeyRound className="w-8 h-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold text-center">
              Reset Password
            </CardTitle>
            <CardDescription className="text-center">
              Enter your email to receive a password reset link
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="rounded-lg bg-muted p-3 mb-4">
                <p className="text-sm text-muted-foreground">
                  <strong>First time logging in?</strong> If you received an invitation email but haven't set your password yet, 
                  enter your email below and we'll send you a link to set your password.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  placeholder="your.email@ntare-louisenlund.org"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setShowForgotPassword(false)}
              >
                Back to Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show password setup form for invited users
  if (isInviteFlow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
        <Card className="w-full max-w-md shadow-elevated">
          <CardHeader className="space-y-1 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center mb-2">
              <KeyRound className="w-8 h-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold text-center">
              Welcome!
            </CardTitle>
            <CardDescription className="text-center">
              Set up your password to complete your account setup
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="rounded-lg bg-muted p-3 mb-4">
                <p className="text-sm text-muted-foreground">
                  You've been invited to join the Co-Curricular Allocation system. 
                  Please create a secure password for your account.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={passwordForm.password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                  required
                  placeholder="Enter your new password"
                />
                <p className="text-xs text-muted-foreground">
                  Must be 8+ characters with uppercase, lowercase, and numbers
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirm Password</Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  required
                  placeholder="Confirm your password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Setting Password..." : "Set Password & Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center mb-2">
            <GraduationCap className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Co-Curricular Allocation
          </CardTitle>
          <CardDescription className="text-center">
            Sign in with your school Google account to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full h-12 text-base"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {isGoogleLoading ? "Signing in..." : "Sign in with Google"}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Use your <strong>@ntare-louisenlund.org</strong> Google account to sign in.
            New accounts are automatically created as students.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
export default Auth;