import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ExistingAnnotation {
  id: string;
  timestamp_seconds: number;
  annotation_type: string;
  title: string | null;
}

interface TimelineEvent {
  id: string;
  timestamp_ms: number;
  event_type: string;
  title: string | null;
}

interface SessionData {
  session_id: string;
  title: string;
  game_name: string | null;
  duration_seconds: number;
  existing_annotations: ExistingAnnotation[];
  timeline_events: TimelineEvent[];
}

interface AnnotationSuggestion {
  id: string;
  timestamp_seconds: number;
  end_timestamp_seconds?: number;
  suggestion_type: "kill" | "death" | "fight_cluster" | "highlight";
  title: string;
  reason: string;
  confidence: "high" | "medium" | "low";
}

interface SuggestionResult {
  suggestions: AnnotationSuggestion[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validate JWT and extract user id.
    // NOTE: In edge functions we can't rely on a persisted auth "session";
    // validate the provided Bearer token instead.
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("Auth error:", claimsError?.message || "Invalid token");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const { session } = await req.json() as { session: SessionData };

    // Verify user owns the session
    const { data: sessionData, error: sessionError } = await supabase
      .from("capture_sessions")
      .select("user_id")
      .eq("id", session.session_id)
      .single();
    
    if (sessionError || sessionData?.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden: You don't own this session" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context from existing data
    const existingAnnotationsContext = session.existing_annotations.map(a => 
      `[${formatTime(a.timestamp_seconds)}] ${a.annotation_type}${a.title ? `: ${a.title}` : ''}`
    ).join('\n');

    const eventsContext = session.timeline_events.map(e =>
      `[${formatTime(e.timestamp_ms / 1000)}] ${e.event_type}${e.title ? `: ${e.title}` : ''}`
    ).join('\n');

    const systemPrompt = `You are analyzing a gameplay session to suggest potential annotation points that the player may have missed. Your goal is to identify moments worth reviewing.

DETECTION TARGETS:
1. **Kill Detection**: Moments where the player likely eliminated an opponent (based on events, timing patterns)
2. **Death Detection**: Moments where the player likely died or was eliminated
3. **Fight Clusters**: Extended combat sequences with multiple events close together (within 5-10 seconds)
4. **Highlight Candidates**: Exceptional moments - multi-kills, clutch plays, or noteworthy sequences

IMPORTANT RULES:
- Only suggest moments that DON'T already have annotations
- Skip any timestamp within 3 seconds of an existing annotation
- Be selective - suggest only high-value moments, not every minor event
- For fight clusters, use a range (start and end timestamps)
- Keep suggestions actionable and specific
- Maximum 10 suggestions per session

OUTPUT FORMAT:
Return valid JSON with this structure:
{
  "suggestions": [
    {
      "id": "<unique_id>",
      "timestamp_seconds": <number>,
      "end_timestamp_seconds": <optional number for ranges>,
      "suggestion_type": "kill" | "death" | "fight_cluster" | "highlight",
      "title": "Brief descriptive title",
      "reason": "Why this moment was flagged",
      "confidence": "high" | "medium" | "low"
    }
  ]
}`;

    const userPrompt = `Analyze this gameplay session and suggest annotation points:

SESSION INFO:
- Title: ${session.title}
- Game: ${session.game_name || 'Unknown'}
- Duration: ${formatTime(session.duration_seconds)}

EXISTING ANNOTATIONS (skip these timestamps):
${existingAnnotationsContext || 'None yet'}

DETECTED EVENTS:
${eventsContext || 'No events detected'}

Identify kills, deaths, fight clusters, and highlight candidates. Only suggest moments that aren't already annotated.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("Suggestion gateway error:", response.status, errorText);
      throw new Error(`Suggestion gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in suggestion response");
    }

    // Parse JSON from response (handle markdown code blocks)
    let result: SuggestionResult;
    try {
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/```\n?([\s\S]*?)\n?```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      result = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Failed to parse suggestion response:", content);
      // Return empty suggestions on parse failure
      result = { suggestions: [] };
    }

    // Validate and filter suggestions
    const validSuggestions = (result.suggestions || [])
      .filter(s => 
        s.id && 
        typeof s.timestamp_seconds === 'number' &&
        s.timestamp_seconds >= 0 &&
        s.timestamp_seconds <= session.duration_seconds &&
        ['kill', 'death', 'fight_cluster', 'highlight'].includes(s.suggestion_type)
      )
      .slice(0, 10); // Limit to 10 suggestions

    return new Response(JSON.stringify({ suggestions: validSuggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Suggestion error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
