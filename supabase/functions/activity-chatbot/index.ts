import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const getAllowedOrigin = (req: Request): string => {
  const origin = req.headers.get("Origin") || "";
  const allowedPatterns = [
    /^https:\/\/.*\.lovable\.app$/,
    /^https:\/\/.*\.lovableproject\.com$/,
    /^http:\/\/localhost:\d+$/,
  ];
  return allowedPatterns.some(p => p.test(origin)) ? origin : "https://nls-co-curricular.lovable.app";
};

const getCorsHeaders = (req: Request) => ({
  "Access-Control-Allow-Origin": getAllowedOrigin(req),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Please log in to use the chatbot" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
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

    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid request - messages must be an array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const limitedMessages = messages.slice(-MAX_MESSAGES);

    for (const msg of limitedMessages) {
      if (msg.role === 'system') continue;
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

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch user role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const userRole = roleData?.role || 'student';

    // Fetch user profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    // Fetch all active activities
    const { data: activities } = await supabase
      .from('activities')
      .select('id, title, description, category, schedule, days_of_week, capacity, current_enrollment, teacher_in_charge')
      .eq('is_active', true)
      .limit(100);

    const activitiesContext = activities?.map(a => 
      `- **${a.title}** (${a.category}): ${a.description}. Schedule: ${a.schedule} on ${a.days_of_week?.join(', ')}. Teacher: ${a.teacher_in_charge}. Spots: ${a.current_enrollment}/${a.capacity}`
    ).join('\n') || 'No activities available';

    // Build role-specific context
    let personalContext = '';

    if (userRole === 'student') {
      // Fetch student allocations
      const { data: allocations } = await supabase
        .from('allocations')
        .select('activity_id, day_of_week, slot_number, status, preference_rank')
        .eq('student_id', user.id)
        .limit(50);

      if (allocations && allocations.length > 0 && activities) {
        const activityMap = new Map(activities.map(a => [a.id, a.title]));
        const allocInfo = allocations.map(al => 
          `  - ${activityMap.get(al.activity_id) || 'Unknown'} on ${al.day_of_week} (Slot ${al.slot_number}, Pref #${al.preference_rank}, Status: ${al.status})`
        ).join('\n');
        personalContext += `\n\n**Your Current Allocations:**\n${allocInfo}`;
      } else {
        personalContext += `\n\nYou don't have any activity allocations yet.`;
      }

      // Fetch recent attendance
      const { data: recentAttendance } = await supabase
        .from('attendance_records')
        .select('status, marked_at, session_id')
        .eq('student_id', user.id)
        .order('marked_at', { ascending: false })
        .limit(10);

      if (recentAttendance && recentAttendance.length > 0) {
        const attendanceSummary = recentAttendance.reduce((acc: Record<string, number>, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1;
          return acc;
        }, {});
        const summaryStr = Object.entries(attendanceSummary).map(([s, c]) => `${s}: ${c}`).join(', ');
        personalContext += `\n\n**Your Recent Attendance (last 10 sessions):** ${summaryStr}`;
      }
    } else if (userRole === 'teacher') {
      // Fetch teacher's activities
      const teacherActivities = activities?.filter(a => a.teacher_in_charge === profileData?.full_name) || [];
      if (teacherActivities.length > 0) {
        const taInfo = teacherActivities.map(a => `  - ${a.title} (${a.current_enrollment}/${a.capacity} enrolled)`).join('\n');
        personalContext += `\n\n**Your Activities:**\n${taInfo}`;
      }
    } else if (userRole === 'admin' || userRole === 'moderator') {
      // Provide system overview stats
      const { count: totalStudents } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student');

      const { count: totalAllocations } = await supabase
        .from('allocations')
        .select('*', { count: 'exact', head: true });

      personalContext += `\n\n**System Overview:** ${totalStudents || 0} students, ${activities?.length || 0} active activities, ${totalAllocations || 0} total allocations.`;
    }

    // Role-specific system prompts
    const roleInstructions: Record<string, string> = {
      student: `You are speaking with a student named ${profileData?.full_name || 'Student'}. Help them understand their schedule, activities, attendance, and how to submit preferences. Be encouraging and supportive.`,
      teacher: `You are speaking with a teacher named ${profileData?.full_name || 'Teacher'}. Help them with managing their activities, taking attendance, understanding student rosters, and sending messages to activity groups.`,
      moderator: `You are speaking with a moderator named ${profileData?.full_name || 'Moderator'}. Help them with overseeing activities, managing allocations, reviewing attendance reports, and handling student issues. You can provide system-level insights.`,
      admin: `You are speaking with an administrator named ${profileData?.full_name || 'Admin'}. Help them with full system management including user roles, activity creation, bulk imports, allocation runs, and system configuration. Provide detailed technical guidance when needed.`,
    };

    const systemPrompt = `You are the NLS Co-Curricular Activity Assistant — a smart, friendly helper for Ntare-Louisenlund School's co-curricular program.

${roleInstructions[userRole] || roleInstructions.student}

## Available Activities
${activitiesContext}
${personalContext}

## Key Policies
- Students submit **5 ranked preferences** for each day slot (Monday, Tuesday, Thursday, Friday, and 2 Wednesday slots)
- Activities are allocated based on preference ranking and availability
- Attendance is tracked via **QR code scanning** or manual marking by teachers
- Students can be marked as: ✅ Present, ⏰ Late, ❌ Absent, or 🔵 Excused
- Only admins and moderators can pre-excuse students

## Response Guidelines
- Use **markdown formatting** for clarity (bold, lists, headers)
- Be concise but thorough
- If you don't know something specific, suggest contacting the school administration
- For schedule questions, reference the actual activity data above
- Be warm and professional`;

    console.log(`User ${user.id} (${userRole}) calling Lovable AI Gateway...`);

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
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: `Rate limit exceeded. Please wait ${RATE_LIMIT_RETRY_SECONDS} seconds before trying again.`,
            retry_after: RATE_LIMIT_RETRY_SECONDS
          }), 
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(RATE_LIMIT_RETRY_SECONDS) },
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
