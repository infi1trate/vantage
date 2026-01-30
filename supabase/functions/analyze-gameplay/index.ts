import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnnotationData {
  id: string;
  timestamp_seconds: number;
  annotation_type: string;
  title: string | null;
  content: string | null;
  tags: string[] | null;
}

interface VoiceNoteData {
  id: string;
  timestamp_seconds: number;
  duration_seconds: number;
  transcription: string | null;
}

interface TimelineEventData {
  id: string;
  timestamp_ms: number;
  event_type: string;
  title: string | null;
  description: string | null;
  duration_ms?: number | null;
}

interface ClipWindow {
  start_time: number;
  end_time: number;
  event_type: string;
  event_id: string;
  session_id: string;
  clip_purpose: "pre" | "during" | "post";
  event_timestamp: number;
}

interface EventWithClipWindows {
  event: TimelineEventData;
  clip_windows: ClipWindow[];
}

interface SessionData {
  session_id?: string;
  title: string;
  game_name: string | null;
  duration_seconds: number | null;
  annotations: AnnotationData[];
  voice_notes: VoiceNoteData[];
  events: TimelineEventData[];
}

interface FeedbackCard {
  id: string;
  timestamp_seconds: number;
  type: "strength" | "improvement" | "pattern" | "intent";
  title: string;
  description: string;
  player_intent?: string;
  behavioral_indicator?: string;
  recommendation?: string;
  confidence: "high" | "medium" | "low";
  evidence_windows?: {
    pre?: { start: number; end: number };
    during?: { start: number; end: number };
    post?: { start: number; end: number };
  };
}

interface AnalysisResult {
  summary: string;
  overall_score: number;
  feedback_cards: FeedbackCard[];
  patterns: {
    name: string;
    description: string;
    frequency: string;
    impact: "positive" | "negative" | "neutral";
  }[];
  recommendations: {
    text: string;
    priority: "high" | "medium" | "low";
    category: string;
  }[];
  clip_windows?: ClipWindow[];
}

// Configuration for clip window extraction
const CLIP_CONFIG = {
  PRE_WINDOW_SECONDS: 10,    // 8-12s before, using 10s
  DURING_MAX_SECONDS: 10,    // up to 10s for the event itself
  POST_WINDOW_SECONDS: 8,    // 6-10s after, using 8s
};

/**
 * Extracts clip windows (PRE/DURING/POST) for a gameplay event.
 * These windows provide temporal context for AI Coach analysis.
 */
function extractClipWindows(
  event: TimelineEventData,
  sessionId: string,
  sessionDurationSeconds: number
): ClipWindow[] {
  const eventTimestampSeconds = event.timestamp_ms / 1000;
  const eventDurationSeconds = (event.duration_ms || 0) / 1000;
  const clipWindows: ClipWindow[] = [];

  // PRE window: 8-12 seconds before the event
  const preStart = Math.max(0, eventTimestampSeconds - CLIP_CONFIG.PRE_WINDOW_SECONDS);
  const preEnd = eventTimestampSeconds;
  
  if (preEnd > preStart) {
    clipWindows.push({
      start_time: preStart,
      end_time: preEnd,
      event_type: event.event_type,
      event_id: event.id,
      session_id: sessionId,
      clip_purpose: "pre",
      event_timestamp: eventTimestampSeconds,
    });
  }

  // DURING window: the event itself (up to 10s)
  const duringStart = eventTimestampSeconds;
  const duringEnd = Math.min(
    eventTimestampSeconds + Math.min(eventDurationSeconds || CLIP_CONFIG.DURING_MAX_SECONDS, CLIP_CONFIG.DURING_MAX_SECONDS),
    sessionDurationSeconds
  );

  if (duringEnd > duringStart) {
    clipWindows.push({
      start_time: duringStart,
      end_time: duringEnd,
      event_type: event.event_type,
      event_id: event.id,
      session_id: sessionId,
      clip_purpose: "during",
      event_timestamp: eventTimestampSeconds,
    });
  }

  // POST window: 6-10 seconds after the event ends
  const postStart = duringEnd;
  const postEnd = Math.min(postStart + CLIP_CONFIG.POST_WINDOW_SECONDS, sessionDurationSeconds);

  if (postEnd > postStart) {
    clipWindows.push({
      start_time: postStart,
      end_time: postEnd,
      event_type: event.event_type,
      event_id: event.id,
      session_id: sessionId,
      clip_purpose: "post",
      event_timestamp: eventTimestampSeconds,
    });
  }

  return clipWindows;
}

/**
 * Processes all timeline events and extracts clip windows for each.
 * Returns events enriched with their associated clip windows.
 */
function processEventsWithClipWindows(
  events: TimelineEventData[],
  sessionId: string,
  sessionDurationSeconds: number
): { eventsWithWindows: EventWithClipWindows[]; allClipWindows: ClipWindow[] } {
  const eventsWithWindows: EventWithClipWindows[] = [];
  const allClipWindows: ClipWindow[] = [];

  // Filter for key gameplay events that warrant clip extraction
  const keyEventTypes = ['kill', 'death', 'fight', 'engagement', 'highlight', 'clutch', 'assist'];
  
  const keyEvents = events.filter(e => 
    keyEventTypes.some(type => e.event_type.toLowerCase().includes(type))
  );

  for (const event of keyEvents) {
    const clipWindows = extractClipWindows(event, sessionId, sessionDurationSeconds);
    eventsWithWindows.push({ event, clip_windows: clipWindows });
    allClipWindows.push(...clipWindows);
  }

  return { eventsWithWindows, allClipWindows };
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const { session } = await req.json() as { session: SessionData };

    // Verify user owns the session if session_id is provided
    if (session.session_id) {
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
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Extract clip windows for key gameplay events
    const sessionDuration = session.duration_seconds || 0;
    const sessionId = session.session_id || 'unknown';
    const { eventsWithWindows, allClipWindows } = processEventsWithClipWindows(
      session.events,
      sessionId,
      sessionDuration
    );

    console.log(`Extracted ${allClipWindows.length} clip windows from ${eventsWithWindows.length} key events`);

    // Build context from session data
    const annotationsContext = session.annotations.map(a => 
      `[${formatTime(a.timestamp_seconds)}] ${a.annotation_type.toUpperCase()}${a.title ? `: ${a.title}` : ''}${a.content ? ` - "${a.content}"` : ''}${a.tags?.length ? ` [tags: ${a.tags.join(', ')}]` : ''}`
    ).join('\n');

    const voiceNotesContext = session.voice_notes.map(v =>
      `[${formatTime(v.timestamp_seconds)}] Voice note (${v.duration_seconds}s): "${v.transcription || 'No transcription'}"`
    ).join('\n');

    const eventsContext = session.events.map(e =>
      `[${formatTime(e.timestamp_ms / 1000)}] ${e.event_type}${e.title ? `: ${e.title}` : ''}${e.description ? ` - ${e.description}` : ''}`
    ).join('\n');

    // Build clip windows context for AI analysis
    const clipWindowsContext = eventsWithWindows.map(ew => {
      const pre = ew.clip_windows.find(c => c.clip_purpose === 'pre');
      const during = ew.clip_windows.find(c => c.clip_purpose === 'during');
      const post = ew.clip_windows.find(c => c.clip_purpose === 'post');
      
      return `EVENT: ${ew.event.event_type} at ${formatTime(ew.event.timestamp_ms / 1000)}
  - PRE context: ${pre ? `${formatTime(pre.start_time)} - ${formatTime(pre.end_time)}` : 'N/A'}
  - DURING: ${during ? `${formatTime(during.start_time)} - ${formatTime(during.end_time)}` : 'N/A'}
  - POST context: ${post ? `${formatTime(post.start_time)} - ${formatTime(post.end_time)}` : 'N/A'}`;
    }).join('\n\n');

    const systemPrompt = `You are an expert gameplay coach providing post-game review. Your role is to provide actionable, supportive feedback on recorded gaming sessions.

IMPORTANT GUIDELINES:
- This is a POST-GAME REVIEW only - never provide real-time assistance
- Frame all behavioral observations as gameplay-relevant heuristics, NOT medical or psychological diagnoses
- Use language like "appears to show", "may indicate", "pattern suggests" rather than definitive statements
- Focus on actionable improvements within the player's control
- Reference specific moments using timestamps so players can jump to those moments
- When players express intent in voice notes, connect it to observed outcomes
- Identify behavioral patterns that affect gameplay performance
- Be encouraging while honest about areas for improvement

EVIDENCE WINDOWS:
For each key event, you are provided with temporal evidence windows:
- PRE: What happened 8-12 seconds BEFORE the event (positioning, decisions leading up)
- DURING: The event itself (up to 10 seconds of action)
- POST: What happened 6-10 seconds AFTER (recovery, repositioning, follow-up)

Use these windows to provide deeper context in your analysis. Reference the specific time ranges when discussing what led to an outcome or what could be improved.

BEHAVIORAL PATTERNS TO IDENTIFY (as gameplay heuristics, not diagnoses):
- Decision hesitation: Delayed actions that may indicate uncertainty
- Overextension: Aggressive positioning that leads to disadvantageous situations  
- Tilt indicators: Patterns that suggest frustration affecting performance
- Confidence fluctuation: Changes in playstyle after success/failure
- Communication gaps: Moments where callouts or coordination could improve outcomes

OUTPUT FORMAT:
Provide analysis as JSON with this structure:
{
  "summary": "Brief 2-3 sentence overview of the session",
  "overall_score": <number 0-100>,
  "feedback_cards": [
    {
      "id": "<unique id>",
      "timestamp_seconds": <number>,
      "type": "strength" | "improvement" | "pattern" | "intent",
      "title": "Short title",
      "description": "Detailed observation",
      "player_intent": "What the player said they were trying to do (from voice notes)",
      "behavioral_indicator": "Observable gameplay pattern (framed as heuristic)",
      "recommendation": "Actionable suggestion",
      "confidence": "high" | "medium" | "low",
      "evidence_windows": {
        "pre": { "start": <seconds>, "end": <seconds> },
        "during": { "start": <seconds>, "end": <seconds> },
        "post": { "start": <seconds>, "end": <seconds> }
      }
    }
  ],
  "patterns": [
    {
      "name": "Pattern name",
      "description": "Description of observed pattern",
      "frequency": "How often it occurred",
      "impact": "positive" | "negative" | "neutral"
    }
  ],
  "recommendations": [
    {
      "text": "Specific actionable recommendation",
      "priority": "high" | "medium" | "low",
      "category": "mechanics" | "positioning" | "decision-making" | "communication" | "mentality"
    }
  ]
}`;

    const userPrompt = `Analyze this gameplay session:

SESSION INFO:
- Title: ${session.title}
- Game: ${session.game_name || 'Unknown'}
- Duration: ${session.duration_seconds ? formatTime(session.duration_seconds) : 'Unknown'}

PLAYER ANNOTATIONS (manual markers):
${annotationsContext || 'No annotations'}

VOICE NOTES (player commentary):
${voiceNotesContext || 'No voice notes'}

GAMEPLAY EVENTS (automatic detection):
${eventsContext || 'No events detected'}

EVIDENCE WINDOWS (PRE/DURING/POST context for key events):
${clipWindowsContext || 'No clip windows extracted'}

Provide comprehensive feedback with moment-level cards, pattern analysis, and actionable recommendations. For each feedback card related to a key event, include the evidence_windows object with the PRE/DURING/POST time ranges. Focus on connecting player intent (from voice notes) with observed outcomes. Frame any behavioral observations as gameplay heuristics.`;

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
        temperature: 0.7,
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
      console.error("Coach gateway error:", response.status, errorText);
      throw new Error(`Coach gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in Coach response");
    }

    // Parse JSON from response (handle markdown code blocks)
    let analysisResult: AnalysisResult;
    try {
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/```\n?([\s\S]*?)\n?```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      analysisResult = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse analysis result");
    }

    // Attach extracted clip windows to the result for downstream processing
    analysisResult.clip_windows = allClipWindows;

    console.log(`Analysis complete with ${analysisResult.feedback_cards?.length || 0} feedback cards and ${allClipWindows.length} clip windows`);

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Analysis error:", error);
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
