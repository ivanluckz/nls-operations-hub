 import { useEffect, useState } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { AdminLayout } from "@/components/admin/AdminLayout";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { useToast } from "@/hooks/use-toast";
 import { AvatarUpload } from "@/components/AvatarUpload";
 import { Loader2, Save, User, Mail, Shield, Award } from "lucide-react";
 import { Badge } from "@/components/ui/badge";
 import { useNavigate } from "react-router-dom";
 import devBadgeImg from "@/assets/dev.png";

 const BADGE_DISPLAY: Record<string, { emoji: string }> = {
   "Growing": { emoji: "🌱" },
   "Star Student": { emoji: "⭐" },
   "Leader": { emoji: "👑" },
   "On Fire": { emoji: "🔥" },
   "Creative": { emoji: "💡" },
   "Team Player": { emoji: "🤝" },
 };
 
  interface Profile {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string | null;
    created_at: string;
  }
  
  const AdminProfile = () => {
     const navigate = useNavigate();
     const { toast } = useToast();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [fullName, setFullName] = useState("");
    const [role, setRole] = useState<string>("");
    const [userBadges, setUserBadges] = useState<string[]>([]);
 
   useEffect(() => {
     fetchProfile();
   }, []);
 
   const fetchProfile = async () => {
     try {
       const { data: { user } } = await supabase.auth.getUser();
       if (!user) return;
 
       const { data: profileData } = await supabase
         .from("profiles")
         .select("*")
         .eq("id", user.id)
         .single();
 
        const [{ data: roleData }, { data: badgesData }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", user.id).single(),
          (supabase as any).from("user_badges").select("badge_name").eq("user_id", user.id).limit(20),
        ]);

        if (profileData) {
          setProfile(profileData);
          setFullName(profileData.full_name);
        }
        if (roleData) {
          setRole(roleData.role);
        }
        setUserBadges((badgesData || []).map((b: any) => b.badge_name));
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };
 
   const handleSave = async () => {
     if (!profile) return;
 
     setSaving(true);
     try {
       const { error } = await supabase
         .from("profiles")
         .update({ full_name: fullName })
         .eq("id", profile.id);
 
       if (error) throw error;
 
       setProfile({ ...profile, full_name: fullName });
       toast({
         title: "Profile updated",
         description: "Your profile has been saved successfully",
       });
     } catch (error) {
       console.error("Error updating profile:", error);
       toast({
         title: "Error",
         description: "Failed to update profile",
         variant: "destructive",
       });
     } finally {
       setSaving(false);
     }
   };
 
   const handleAvatarChange = (url: string | null) => {
     if (profile) {
       setProfile({ ...profile, avatar_url: url });
     }
   };
 
   if (loading) {
     return (
       <AdminLayout>
         <div className="flex items-center justify-center h-64">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
         </div>
       </AdminLayout>
     );
   }
 
   if (!profile) {
     return (
       <AdminLayout>
         <div className="text-center py-12">
           <p className="text-muted-foreground">Profile not found</p>
         </div>
       </AdminLayout>
     );
   }
 
   return (
     <AdminLayout>
       <div className="max-w-2xl mx-auto space-y-6">
         <div>
           <h1 className="text-3xl font-bold text-foreground">Profile Settings</h1>
           <p className="text-muted-foreground mt-1">Manage your account information</p>
         </div>
 
         <Card>
           <CardHeader>
             <CardTitle>Profile Picture</CardTitle>
             <CardDescription>
               Upload a profile picture to personalize your account
             </CardDescription>
           </CardHeader>
           <CardContent className="flex justify-center">
             <AvatarUpload
               userId={profile.id}
               currentAvatarUrl={profile.avatar_url}
               fullName={profile.full_name}
               onAvatarChange={handleAvatarChange}
               size="xl"
             />
           </CardContent>
         </Card>
 
         <Card>
           <CardHeader>
             <CardTitle>Account Information</CardTitle>
             <CardDescription>
               Update your personal details
             </CardDescription>
           </CardHeader>
           <CardContent className="space-y-6">
             <div className="space-y-2">
               <Label htmlFor="fullName" className="flex items-center gap-2">
                 <User className="h-4 w-4" />
                 Full Name
               </Label>
               <Input
                 id="fullName"
                 value={fullName}
                 onChange={(e) => setFullName(e.target.value)}
                 placeholder="Enter your full name"
               />
             </div>
 
             <div className="space-y-2">
               <Label className="flex items-center gap-2">
                 <Mail className="h-4 w-4" />
                 Email Address
               </Label>
               <Input
                 value={profile.email}
                 disabled
                 className="bg-muted"
               />
               <p className="text-xs text-muted-foreground">
                 Email cannot be changed
               </p>
             </div>
 
             <div className="space-y-2">
               <Label className="flex items-center gap-2">
                 <Shield className="h-4 w-4" />
                 Role
               </Label>
               <div>
                 <Badge variant="secondary" className="capitalize">
                   {role}
                 </Badge>
               </div>
              </div>

              {/* Badges */}
              {userBadges.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Badges
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {userBadges.map((badgeName) => (
                      <div
                        key={badgeName}
                        className="flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1.5 text-sm font-medium"
                      >
                        {badgeName === "Dev" ? (
                          <img src={devBadgeImg} alt="Dev" className="h-5 w-5 object-contain" />
                        ) : (
                          <span>{BADGE_DISPLAY[badgeName]?.emoji || "🏅"}</span>
                        )}
                        {badgeName === "Dev" ? (
                          <span className="dev-nameplate dev-name-glow">{badgeName}</span>
                        ) : (
                          badgeName
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}


             <div className="pt-4">
               <Button onClick={handleSave} disabled={saving}>
                 {saving ? (
                   <>
                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                     Saving...
                   </>
                 ) : (
                   <>
                     <Save className="mr-2 h-4 w-4" />
                     Save Changes
                   </>
                 )}
               </Button>
             </div>
           </CardContent>
         </Card>
 

          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Member since {new Date(profile.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </CardContent>
          </Card>
       </div>
     </AdminLayout>
   );
 };
 
 export default AdminProfile;