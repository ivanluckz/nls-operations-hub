import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, KeyRound } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    toast
  } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isInviteFlow, setIsInviteFlow] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: ""
  });
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: ""
  });
  const [signupForm, setSignupForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    role: "student" as "student" | "moderator"
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
        
        const role = (roleData as any)?.role;
        
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.auth.signInWithPassword({
        email: loginForm.email,
        password: loginForm.password
      });
      if (error) throw error;
      if (data.user) {
        const {
          data: roleData
        } = await supabase.from("user_roles" as any).select("role").eq("user_id", data.user.id).single();
        const role = (roleData as any)?.role;
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
        title: "Login Failed",
        description: error.message || "Invalid email or password"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email format and domain
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signupForm.email)) {
      toast({
        variant: "destructive",
        title: "Invalid Email",
        description: "Please enter a valid email address"
      });
      return;
    }

    // Client-side domain validation
    if (!signupForm.email.toLowerCase().endsWith('@ntare-louisenlund.org')) {
      toast({
        variant: "destructive",
        title: "Invalid Email Domain",
        description: "Please use your school email address ending in @ntare-louisenlund.org"
      });
      return;
    }
    if (signupForm.password !== signupForm.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords don't match",
        description: "Please make sure your passwords match"
      });
      return;
    }

    // Enhanced password validation
    if (signupForm.password.length < 8) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Password must be at least 8 characters"
      });
      return;
    }
    if (!/[A-Z]/.test(signupForm.password) || !/[a-z]/.test(signupForm.password) || !/[0-9]/.test(signupForm.password)) {
      toast({
        variant: "destructive",
        title: "Weak password",
        description: "Password must contain uppercase, lowercase, and numbers"
      });
      return;
    }

    // Sanitize input
    const sanitizedFullName = signupForm.fullName.trim().slice(0, 100);
    setIsLoading(true);
    try {
      // Security fix: All signups are students by default
      // Moderators must be promoted by an admin
      const {
        data,
        error
      } = await supabase.auth.signUp({
        email: signupForm.email.trim().toLowerCase(),
        password: signupForm.password,
        options: {
          data: {
            full_name: sanitizedFullName,
            role: 'student' // Force student role for security
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });
      if (error) throw error;
      if (data.user) {
        toast({
          title: "Account created!",
          description: "You can now log in with your credentials"
        });

        // Auto-login after signup
        const {
          data: loginData,
          error: loginError
        } = await supabase.auth.signInWithPassword({
          email: signupForm.email.trim().toLowerCase(),
          password: signupForm.password
        });
        if (!loginError && loginData.user) {
          navigate("/student");
        }
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Signup Failed",
        description: error.message || "Could not create account"
      });
    } finally {
      setIsLoading(false);
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

  return <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center mb-2">
            <GraduationCap className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Co-Curricular Allocation
          </CardTitle>
          <CardDescription className="text-center">
            Manage your co-curricular activity preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" value={loginForm.email} onChange={e => setLoginForm({
                  ...loginForm,
                  email: e.target.value
                })} required placeholder="Student@ntare-louisenlund.org" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input id="login-password" type="password" value={loginForm.password} onChange={e => setLoginForm({
                  ...loginForm,
                  password: e.target.value
                })} required />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Logging in..." : "Login"}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full text-sm"
                  onClick={() => setShowForgotPassword(true)}
                >
                  Forgot password? / First time logging in?
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input id="signup-name" type="text" placeholder="John Doe" value={signupForm.fullName} onChange={e => setSignupForm({
                  ...signupForm,
                  fullName: e.target.value
                })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" type="email" placeholder="student@school.edu" value={signupForm.email} onChange={e => setSignupForm({
                  ...signupForm,
                  email: e.target.value
                })} required />
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm text-muted-foreground">
                    All new accounts are created as <strong>students</strong>. Contact an administrator to be promoted to moderator.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input id="signup-password" type="password" value={signupForm.password} onChange={e => setSignupForm({
                  ...signupForm,
                  password: e.target.value
                })} required />
                  <p className="text-xs text-muted-foreground">
                    Must be 8+ characters with uppercase, lowercase, and numbers
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                  <Input id="signup-confirm-password" type="password" value={signupForm.confirmPassword} onChange={e => setSignupForm({
                  ...signupForm,
                  confirmPassword: e.target.value
                })} required />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating Account..." : "Sign Up"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>;
};
export default Auth;