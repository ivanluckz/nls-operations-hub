 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
 
const ALLOWED_ORIGINS = [
  "https://id-preview--f393e585-fc10-4a2e-a662-735d93b755e9.lovable.app",
  "https://nls-co-curricular.lovable.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

const getAllowedOrigin = (req: Request): string => {
  const origin = req.headers.get("Origin") || "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
};

const getCorsHeaders = (req: Request) => ({
  "Access-Control-Allow-Origin": getAllowedOrigin(req),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
});
 
 interface ImportRequest {
   email: string;
   full_name: string;
 }
 
// Helper function to link teacher to their activities
async function linkTeacherToActivities(supabaseAdmin: any, userId: string, fullName: string) {
  const normalizedName = fullName.toLowerCase().trim();
  
  // Find activities where teacher_in_charge matches the teacher's name
  const { data: activities, error } = await supabaseAdmin
    .from("activities")
    .select("id, title, teacher_in_charge")
    .is("teacher_id", null);
  
  if (error) {
    console.error("Error fetching activities:", error);
    return 0;
  }
  
  let linkedCount = 0;
  
  for (const activity of activities || []) {
    const activityTeacher = activity.teacher_in_charge.toLowerCase().trim();
    
    // Check for exact match or partial match
    if (activityTeacher === normalizedName || 
        activityTeacher.includes(normalizedName) || 
        normalizedName.includes(activityTeacher)) {
      
      const { error: updateError } = await supabaseAdmin
        .from("activities")
        .update({ teacher_id: userId })
        .eq("id", activity.id);
      
      if (!updateError) {
        console.log(`Linked teacher ${fullName} to activity: ${activity.title}`);
        linkedCount++;
      }
    }
  }
  
  return linkedCount;
}

 serve(async (req) => {
   const corsHeaders = getCorsHeaders(req);
   // Handle CORS preflight
   if (req.method === "OPTIONS") {
     return new Response("ok", { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get("SUPABASE_URL");
     const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 
     if (!supabaseUrl || !serviceRoleKey) {
       throw new Error("Missing environment variables");
     }
 
     // Verify the caller is an admin
     const authHeader = req.headers.get("Authorization");
     if (!authHeader) {
       return new Response(
         JSON.stringify({ error: "Missing authorization header" }),
         { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Create admin client to check caller role
     const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
     
     // Create user client to verify the caller
     const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
     const userClient = createClient(supabaseUrl, anonKey, {
       global: { headers: { Authorization: authHeader } }
     });
     
     const { data: { user: caller }, error: callerError } = await userClient.auth.getUser();
     
     if (callerError || !caller) {
       return new Response(
         JSON.stringify({ error: "Unauthorized" }),
         { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Check if caller is admin
     const { data: roleData, error: roleError } = await supabaseAdmin
       .from("user_roles")
       .select("role")
       .eq("user_id", caller.id)
       .single();
 
     if (roleError || !roleData || roleData.role !== "admin") {
       return new Response(
         JSON.stringify({ error: "Only admins can import teachers" }),
         { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const { email, full_name }: ImportRequest = await req.json();
 
     // Validate email domain
     if (!email.endsWith("@ntare-louisenlund.org")) {
       return new Response(
         JSON.stringify({ error: "Invalid email domain" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Check if user already exists in profiles
     const { data: existingProfile } = await supabaseAdmin
       .from("profiles")
       .select("id")
       .eq("email", email.toLowerCase())
       .maybeSingle();
 
     if (existingProfile) {
       // User exists, update their role to teacher if not already
       const { data: existingRole } = await supabaseAdmin
         .from("user_roles")
         .select("role")
         .eq("user_id", existingProfile.id)
         .single();
 
       if (existingRole?.role !== "teacher" && existingRole?.role !== "admin") {
         // Update role to teacher
         await supabaseAdmin
           .from("user_roles")
           .update({ role: "teacher" })
           .eq("user_id", existingProfile.id);
         
         console.log(`Updated ${email} role to teacher`);
       }
 
      // Link to activities even for existing users
      const linkedCount = await linkTeacherToActivities(supabaseAdmin, existingProfile.id, full_name);
      console.log(`Linked existing teacher ${email} to ${linkedCount} activities`);

       return new Response(
        JSON.stringify({ exists: true, message: "User already exists", linkedActivities: linkedCount }),
         { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Send invite email using admin API - teacher role will be assigned by handle_new_user trigger
     // We pass is_teacher flag in metadata to help the trigger
     const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
       data: { 
         full_name,
         is_teacher: true
       }
     });
 
     if (inviteError) {
       // Check if user exists error
       if (inviteError.message?.includes("already been registered")) {
         console.log(`User ${email} already registered`);
         return new Response(
           JSON.stringify({ exists: true, message: "User already registered" }),
           { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
       
       console.error(`Error inviting ${email}:`, inviteError);
       throw inviteError;
     }
 
     // After invite, update the role to teacher (since handle_new_user might assign student by default)
     if (inviteData.user?.id) {
       // Delete any existing role
       await supabaseAdmin
         .from("user_roles")
         .delete()
         .eq("user_id", inviteData.user.id);
 
       // Insert teacher role
       await supabaseAdmin
         .from("user_roles")
         .insert({ user_id: inviteData.user.id, role: "teacher" });
 
       console.log(`Assigned teacher role to ${email}`);

      // Link to activities
      const linkedCount = await linkTeacherToActivities(supabaseAdmin, inviteData.user.id, full_name);
      console.log(`Linked new teacher ${email} to ${linkedCount} activities`);
     }
 
     console.log(`Successfully invited teacher ${email}`);
 
     return new Response(
      JSON.stringify({ success: true, message: "Invite sent", userId: inviteData.user?.id, linkedActivities: 0 }),
       { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
 
   } catch (error: unknown) {
     console.error("Import error:", error);
     const errorMessage = error instanceof Error ? error.message : "Import failed";
     return new Response(
       JSON.stringify({ error: errorMessage }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });