import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Issue #21: Use specific allowed origins instead of wildcard
const getAllowedOrigin = (req: Request): string => {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigins = [
    "https://id-preview--f393e585-fc10-4a2e-a662-735d93b755e9.lovable.app",
    "https://nls-co-curricular.lovable.app",
    "http://localhost:5173",
    "http://localhost:3000"
  ];
  return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
};

const getCorsHeaders = (req: Request) => ({
  "Access-Control-Allow-Origin": getAllowedOrigin(req),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES = 50;
const RATE_LIMIT_RETRY_SECONDS = 60;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Please log in to use the chatbot" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Create client with user's auth token to verify authentication
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages } = await req.json();

    // Validate messages input
    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid request - messages must be an array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit number of messages to prevent abuse
    const limitedMessages = messages.slice(-MAX_MESSAGES);

    // Validate each message
    for (const msg of limitedMessages) {
      if (typeof msg.content !== 'string') {
        return new Response(
          JSON.stringify({ error: "Invalid message format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (msg.content.length > MAX_MESSAGE_LENGTH) {
        return new Response(
          JSON.stringify({ error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use service role key for fetching activities (internal operation)
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: activities } = await supabase
      .from('activities')
      .select('title, description, category, schedule, days_of_week, capacity, current_enrollment, teacher_in_charge')
      .eq('is_active', true);

    const activitiesContext = activities?.map(a => 
      `- ${a.title} (${a.category}): ${a.description}. Schedule: ${a.schedule} on ${a.days_of_week?.join(', ')}. Teacher: ${a.teacher_in_charge}. Capacity: ${a.current_enrollment}/${a.capacity}`
    ).join('\n') || 'No activities available';

    const systemPrompt = `You are a helpful assistant for Ntare-Louisenlund School's co-curricular activities system. You help students and parents with questions about:
- Available activities and their schedules
- How to select preferences
- Attendance policies
- General questions about the co-curricular program

Here are the current available activities:
${activitiesContext}

Key policies:
- Students submit 5 ranked preferences for each day slot
- Activities are allocated based on preference ranking and availability
- Attendance is tracked via QR code scanning or manual marking
- Students can be marked as present, late, absent, or excused
- Only admins and moderators can excuse students

Be friendly, concise, and helpful. If you don't know something specific, suggest they contact the school administration.`;

    console.log(`Authenticated user ${user.id} calling Lovable AI Gateway...`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...limitedMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      // Issue #12: Add Retry-After header and descriptive message for rate limits
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: `Rate limit exceeded. You've sent too many requests. Please wait ${RATE_LIMIT_RETRY_SECONDS} seconds before trying again.`,
            retry_after: RATE_LIMIT_RETRY_SECONDS
          }), 
          {
            status: 429,
            headers: { 
              ...corsHeaders, 
              "Content-Type": "application/json",
              "Retry-After": String(RATE_LIMIT_RETRY_SECONDS)
            },
          }
        );
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chatbot error:", error);
    const corsHeaders = getCorsHeaders(req);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
