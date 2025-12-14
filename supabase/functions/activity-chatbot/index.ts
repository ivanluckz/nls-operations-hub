import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch activities for context
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    console.log("Calling Lovable AI Gateway...");

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
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
