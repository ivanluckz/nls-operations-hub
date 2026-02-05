 import { useState, useRef } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
 import { Button } from "@/components/ui/button";
 import { useToast } from "@/hooks/use-toast";
 import { Camera, Loader2, X } from "lucide-react";
 import { cn } from "@/lib/utils";
 
 interface AvatarUploadProps {
   userId: string;
   currentAvatarUrl?: string | null;
   fullName: string;
   onAvatarChange?: (url: string | null) => void;
   size?: "sm" | "md" | "lg" | "xl";
   editable?: boolean;
 }
 
 const sizeClasses = {
   sm: "h-10 w-10",
   md: "h-16 w-16",
   lg: "h-24 w-24",
   xl: "h-32 w-32",
 };
 
 const iconSizes = {
   sm: "h-3 w-3",
   md: "h-4 w-4",
   lg: "h-5 w-5",
   xl: "h-6 w-6",
 };
 
 export function AvatarUpload({
   userId,
   currentAvatarUrl,
   fullName,
   onAvatarChange,
   size = "lg",
   editable = true,
 }: AvatarUploadProps) {
   const [uploading, setUploading] = useState(false);
   const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
   const fileInputRef = useRef<HTMLInputElement>(null);
   const { toast } = useToast();
 
   const getInitials = (name: string) => {
     return name
       .split(" ")
       .map((n) => n[0])
       .join("")
       .toUpperCase()
       .slice(0, 2);
   };
 
   const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
     const file = event.target.files?.[0];
     if (!file) return;
 
     // Validate file type
     if (!file.type.startsWith("image/")) {
       toast({
         title: "Invalid file type",
         description: "Please upload an image file",
         variant: "destructive",
       });
       return;
     }
 
     // Validate file size (max 5MB)
     if (file.size > 5 * 1024 * 1024) {
       toast({
         title: "File too large",
         description: "Please upload an image smaller than 5MB",
         variant: "destructive",
       });
       return;
     }
 
     setUploading(true);
 
     try {
       // Create unique file path
       const fileExt = file.name.split(".").pop();
       const fileName = `${userId}/avatar.${fileExt}`;
 
       // Delete existing avatar if present
       if (avatarUrl) {
         const oldPath = avatarUrl.split("/avatars/")[1];
         if (oldPath) {
           await supabase.storage.from("avatars").remove([oldPath]);
         }
       }
 
       // Upload new avatar
       const { error: uploadError } = await supabase.storage
         .from("avatars")
         .upload(fileName, file, { upsert: true });
 
       if (uploadError) throw uploadError;
 
       // Get public URL
       const { data: { publicUrl } } = supabase.storage
         .from("avatars")
         .getPublicUrl(fileName);
 
       // Add cache-busting query param
       const newUrl = `${publicUrl}?t=${Date.now()}`;
 
       // Update profile
       const { error: updateError } = await supabase
         .from("profiles")
         .update({ avatar_url: newUrl })
         .eq("id", userId);
 
       if (updateError) throw updateError;
 
       setAvatarUrl(newUrl);
       onAvatarChange?.(newUrl);
 
       toast({
         title: "Avatar updated",
         description: "Your profile picture has been updated",
       });
     } catch (error) {
       console.error("Upload error:", error);
       toast({
         title: "Upload failed",
         description: "Failed to upload avatar. Please try again.",
         variant: "destructive",
       });
     } finally {
       setUploading(false);
       if (fileInputRef.current) {
         fileInputRef.current.value = "";
       }
     }
   };
 
   const handleRemove = async () => {
     if (!avatarUrl) return;
 
     setUploading(true);
     try {
       // Remove from storage
       const path = avatarUrl.split("/avatars/")[1]?.split("?")[0];
       if (path) {
         await supabase.storage.from("avatars").remove([path]);
       }
 
       // Update profile
       const { error } = await supabase
         .from("profiles")
         .update({ avatar_url: null })
         .eq("id", userId);
 
       if (error) throw error;
 
       setAvatarUrl(null);
       onAvatarChange?.(null);
 
       toast({
         title: "Avatar removed",
         description: "Your profile picture has been removed",
       });
     } catch (error) {
       console.error("Remove error:", error);
       toast({
         title: "Remove failed",
         description: "Failed to remove avatar. Please try again.",
         variant: "destructive",
       });
     } finally {
       setUploading(false);
     }
   };
 
   return (
     <div className="flex flex-col items-center gap-4">
       <div className="relative group">
         <Avatar className={cn(sizeClasses[size], "border-4 border-background shadow-lg")}>
           <AvatarImage src={avatarUrl || undefined} className="object-cover" />
           <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
             {getInitials(fullName)}
           </AvatarFallback>
         </Avatar>
 
         {editable && (
           <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
             {uploading ? (
               <Loader2 className={cn(iconSizes[size], "text-white animate-spin")} />
             ) : (
               <Button
                 variant="ghost"
                 size="icon"
                 className="text-white hover:bg-white/20"
                 onClick={() => fileInputRef.current?.click()}
               >
                 <Camera className={iconSizes[size]} />
               </Button>
             )}
           </div>
         )}
 
         {avatarUrl && editable && !uploading && (
           <Button
             variant="destructive"
             size="icon"
             className="absolute -top-1 -right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
             onClick={handleRemove}
           >
             <X className="h-3 w-3" />
           </Button>
         )}
       </div>
 
       <input
         ref={fileInputRef}
         type="file"
         accept="image/*"
         onChange={handleUpload}
         className="hidden"
       />
 
       {editable && (
         <p className="text-xs text-muted-foreground text-center">
           Click to upload • Max 5MB
         </p>
       )}
     </div>
   );
 }