 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
 interface ImportRequest {
   email: string;
   full_name: string;
 }
 
 serve(async (req) => {
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
         JSON.stringify({ error: "Only admins can import students" }),
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
       console.log(`User ${email} already exists`);
       return new Response(
         JSON.stringify({ exists: true, message: "User already exists" }),
         { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Send invite email using admin API
     const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
       data: { full_name }
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
 
     console.log(`Successfully invited ${email}`);
 
     return new Response(
       JSON.stringify({ success: true, message: "Invite sent", userId: inviteData.user?.id }),
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