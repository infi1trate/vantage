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

// Evidence signal types for clip windows
type MovementState = "stationary" | "slow" | "fast" | "unknown";
type CoverState = "high" | "medium" | "low" | "unknown";
type HealthState = "healthy" | "low" | "critical" | "unknown";
type AimBehavior = "ADS_heavy" | "hipfire" | "erratic" | "unknown";
type BooleanSignal = true | false | "unknown";
type EnvironmentState = "indoor" | "outdoor" | "mixed" | "unknown";
type ActivityLevel = "low" | "medium" | "high" | "unknown";

interface ClipEvidence {
  player_movement: MovementState;
  player_in_cover: CoverState;
  player_health_state: HealthState;
  aim_behavior: AimBehavior;
  repeat_peek_detected: BooleanSignal;
  indoor_outdoor: EnvironmentState;
  build_or_edit_activity: ActivityLevel;
}

interface ClipWindow {
  start_time: number;
  end_time: number;
  event_type: string;
  event_id: string;
  session_id: string;
  clip_purpose: "pre" | "during" | "post";
  event_timestamp: number;
  evidence?: ClipEvidence;
}

interface ClipWindowWithEvidence {
  event_id: string;
  clip_purpose: "pre" | "during" | "post";
  evidence: ClipEvidence;
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

// New analyst-focused event analysis structure
interface CandidateCause {
  cause: string;
  likelihood: "high" | "medium" | "low";
  evidence_used: string[];
}

interface EventAnalysis {
  event_id: string;
  event_type: string;
  timestamp_seconds: number;
  observed_behaviors: string[];
  uncertainties: string[];
  candidate_causes: CandidateCause[];
}

// Coach layer output structure
type CoachingLens = "Positioning" | "Awareness" | "Tempo" | "Resource Management" | "Mechanics";

interface CoachingCard {
  event_id: string;
  title: string;
  lens: CoachingLens;
  what_happened: string;
  why_it_mattered: string;
  coaching_tip: string;
  drill: string;
  confidence: "high" | "medium" | "low";
  confidence_reason: string;
  evidence_summary: string[];
  safety_verified: boolean;
}

interface SessionSummary {
  recurring_patterns: {
    pattern: string;
    event_count: number;
    lens: CoachingLens;
    evidence: string[];
  }[];
  focus_goal: string;
  kpi: string;
  checklist_item: string;
}

interface AnalysisResult {
  summary: string;
  overall_score: number;
  // Event-level analyses (analyst output - facts only)
  event_analyses: EventAnalysis[];
  // Coach-generated coaching cards (actionable advice)
  coaching_cards: CoachingCard[];
  // Session-level summary (patterns, focus goal, KPI, checklist)
  session_summary?: SessionSummary;
  feedback_cards: FeedbackCard[];
  patterns: {
    name: string;
    description: string;
    frequency: string;
    impact: "positive" | "negative" | "neutral";
  }[];
  clip_windows?: ClipWindow[];
  clip_evidence?: ClipWindowWithEvidence[];
}

// Configuration for clip window extraction
const CLIP_CONFIG = {
  PRE_WINDOW_SECONDS: 10,    // 8-12s before, using 10s
  DURING_MAX_SECONDS: 10,    // up to 10s for the event itself
  POST_WINDOW_SECONDS: 8,    // 6-10s after, using 8s
};

/**
 * Creates a default evidence object with all signals set to "unknown".
 * Used when we cannot determine signals from available data.
 */
function createDefaultEvidence(): ClipEvidence {
  return {
    player_movement: "unknown",
    player_in_cover: "unknown",
    player_health_state: "unknown",
    aim_behavior: "unknown",
    repeat_peek_detected: "unknown",
    indoor_outdoor: "unknown",
    build_or_edit_activity: "unknown",
  };
}

/**
 * Extracts evidence signals from available event/annotation data.
 * This is a heuristic-based approach using metadata from timeline events.
 * When video frame analysis becomes available, this can be extended.
 */
function extractEvidenceFromContext(
  clipWindow: ClipWindow,
  allEvents: TimelineEventData[],
  annotations: AnnotationData[],
  voiceNotes: VoiceNoteData[]
): ClipEvidence {
  const evidence = createDefaultEvidence();
  const startTime = clipWindow.start_time;
  const endTime = clipWindow.end_time;

  // Find events within this clip window
  const eventsInWindow = allEvents.filter(e => {
    const eventTime = e.timestamp_ms / 1000;
    return eventTime >= startTime && eventTime <= endTime;
  });

  // Find annotations within this clip window
  const annotationsInWindow = annotations.filter(a => 
    a.timestamp_seconds >= startTime && a.timestamp_seconds <= endTime
  );

  // Find voice notes within this clip window
  const voiceNotesInWindow = voiceNotes.filter(v =>
    v.timestamp_seconds >= startTime && v.timestamp_seconds <= endTime
  );

  // Infer movement from event types and descriptions
  const hasMovementEvents = eventsInWindow.some(e => {
    const type = e.event_type.toLowerCase();
    const desc = (e.description || '').toLowerCase();
    return type.includes('sprint') || type.includes('slide') || type.includes('jump') ||
           desc.includes('rushing') || desc.includes('pushing') || desc.includes('rotating');
  });

  const hasStationaryIndicators = eventsInWindow.some(e => {
    const type = e.event_type.toLowerCase();
    const desc = (e.description || '').toLowerCase();
    return type.includes('camp') || type.includes('hold') || type.includes('scope') ||
           desc.includes('holding') || desc.includes('waiting') || desc.includes('camping');
  });

  if (hasMovementEvents) {
    evidence.player_movement = "fast";
  } else if (hasStationaryIndicators) {
    evidence.player_movement = "stationary";
  }

  // Infer health state from event types
  const hasLowHealthIndicator = eventsInWindow.some(e => {
    const type = e.event_type.toLowerCase();
    const desc = (e.description || '').toLowerCase();
    return type.includes('heal') || type.includes('medkit') || type.includes('shield') ||
           desc.includes('low health') || desc.includes('one-shot') || desc.includes('cracked');
  });

  const hasCriticalIndicator = eventsInWindow.some(e => {
    const type = e.event_type.toLowerCase();
    return type.includes('death') || type.includes('knocked') || type.includes('eliminated');
  });

  if (hasCriticalIndicator && clipWindow.clip_purpose === "during") {
    evidence.player_health_state = "critical";
  } else if (hasLowHealthIndicator) {
    evidence.player_health_state = "low";
  }

  // Infer cover state from annotations/voice notes
  const coverKeywords = ['cover', 'peek', 'exposed', 'open', 'protected', 'safe'];
  const combinedText = [
    ...annotationsInWindow.map(a => (a.content || '') + (a.title || '')),
    ...voiceNotesInWindow.map(v => v.transcription || '')
  ].join(' ').toLowerCase();

  if (combinedText.includes('exposed') || combinedText.includes('open') || combinedText.includes('no cover')) {
    evidence.player_in_cover = "low";
  } else if (combinedText.includes('cover') || combinedText.includes('safe') || combinedText.includes('protected')) {
    evidence.player_in_cover = "high";
  }

  // Infer aim behavior from event types
  const hasADSEvents = eventsInWindow.some(e => {
    const type = e.event_type.toLowerCase();
    const desc = (e.description || '').toLowerCase();
    return type.includes('snipe') || type.includes('scope') || type.includes('ads') ||
           desc.includes('scoped') || desc.includes('aimed');
  });

  const hasHipfireEvents = eventsInWindow.some(e => {
    const type = e.event_type.toLowerCase();
    const desc = (e.description || '').toLowerCase();
    return type.includes('spray') || type.includes('hipfire') ||
           desc.includes('hip fire') || desc.includes('spray');
  });

  if (hasADSEvents) {
    evidence.aim_behavior = "ADS_heavy";
  } else if (hasHipfireEvents) {
    evidence.aim_behavior = "hipfire";
  }

  // Infer repeat peek from pattern analysis
  const peekEvents = eventsInWindow.filter(e => {
    const type = e.event_type.toLowerCase();
    const desc = (e.description || '').toLowerCase();
    return type.includes('peek') || desc.includes('peek') || desc.includes('re-peek');
  });

  if (peekEvents.length >= 2) {
    evidence.repeat_peek_detected = true;
  } else if (combinedText.includes('re-peek') || combinedText.includes('same angle') || combinedText.includes('repeat peek')) {
    evidence.repeat_peek_detected = true;
  }

  // Infer environment from event descriptions
  if (combinedText.includes('indoor') || combinedText.includes('building') || combinedText.includes('inside')) {
    evidence.indoor_outdoor = "indoor";
  } else if (combinedText.includes('outdoor') || combinedText.includes('open area') || combinedText.includes('outside') || combinedText.includes('field')) {
    evidence.indoor_outdoor = "outdoor";
  }

  // Infer build/edit activity (for games like Fortnite)
  const hasBuildEvents = eventsInWindow.some(e => {
    const type = e.event_type.toLowerCase();
    const desc = (e.description || '').toLowerCase();
    return type.includes('build') || type.includes('edit') || type.includes('wall') || type.includes('ramp') ||
           desc.includes('building') || desc.includes('editing');
  });

  if (hasBuildEvents) {
    // Check density of build events
    const buildEventCount = eventsInWindow.filter(e => {
      const type = e.event_type.toLowerCase();
      return type.includes('build') || type.includes('edit');
    }).length;

    if (buildEventCount >= 3) {
      evidence.build_or_edit_activity = "high";
    } else if (buildEventCount >= 1) {
      evidence.build_or_edit_activity = "medium";
    }
  }

  return evidence;
}
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
 * Processes all timeline events and extracts clip windows with evidence for each.
 * Returns events enriched with their associated clip windows and evidence signals.
 */
function processEventsWithClipWindows(
  events: TimelineEventData[],
  sessionId: string,
  sessionDurationSeconds: number,
  annotations: AnnotationData[],
  voiceNotes: VoiceNoteData[]
): { eventsWithWindows: EventWithClipWindows[]; allClipWindows: ClipWindow[]; clipEvidence: ClipWindowWithEvidence[] } {
  const eventsWithWindows: EventWithClipWindows[] = [];
  const allClipWindows: ClipWindow[] = [];
  const clipEvidence: ClipWindowWithEvidence[] = [];

  // Filter for key gameplay events that warrant clip extraction
  const keyEventTypes = ['kill', 'death', 'fight', 'engagement', 'highlight', 'clutch', 'assist'];
  
  const keyEvents = events.filter(e => 
    keyEventTypes.some(type => e.event_type.toLowerCase().includes(type))
  );

  for (const event of keyEvents) {
    const clipWindows = extractClipWindows(event, sessionId, sessionDurationSeconds);
    
    // Extract evidence for each clip window
    const windowsWithEvidence = clipWindows.map(cw => {
      const evidence = extractEvidenceFromContext(cw, events, annotations, voiceNotes);
      cw.evidence = evidence;
      
      clipEvidence.push({
        event_id: cw.event_id,
        clip_purpose: cw.clip_purpose,
        evidence,
      });
      
      return cw;
    });
    
    eventsWithWindows.push({ event, clip_windows: windowsWithEvidence });
    allClipWindows.push(...windowsWithEvidence);
  }

  return { eventsWithWindows, allClipWindows, clipEvidence };
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

    // Extract clip windows for key gameplay events with evidence
    const sessionDuration = session.duration_seconds || 0;
    const sessionId = session.session_id || 'unknown';
    const { eventsWithWindows, allClipWindows, clipEvidence } = processEventsWithClipWindows(
      session.events,
      sessionId,
      sessionDuration,
      session.annotations,
      session.voice_notes
    );

    console.log(`Extracted ${allClipWindows.length} clip windows with evidence from ${eventsWithWindows.length} key events`);
    
    // Log evidence summary for debugging
    const evidenceWithSignals = clipEvidence.filter(ce => 
      Object.values(ce.evidence).some(v => v !== "unknown")
    );
    console.log(`${evidenceWithSignals.length}/${clipEvidence.length} clip windows have at least one known evidence signal`);

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

    // Build clip windows context with evidence for AI analysis
    const clipWindowsContext = eventsWithWindows.map(ew => {
      const pre = ew.clip_windows.find(c => c.clip_purpose === 'pre');
      const during = ew.clip_windows.find(c => c.clip_purpose === 'during');
      const post = ew.clip_windows.find(c => c.clip_purpose === 'post');
      
      const formatEvidence = (cw: ClipWindow | undefined): string => {
        if (!cw?.evidence) return 'No evidence';
        const e = cw.evidence;
        const signals = [];
        if (e.player_movement !== 'unknown') signals.push(`movement: ${e.player_movement}`);
        if (e.player_in_cover !== 'unknown') signals.push(`cover: ${e.player_in_cover}`);
        if (e.player_health_state !== 'unknown') signals.push(`health: ${e.player_health_state}`);
        if (e.aim_behavior !== 'unknown') signals.push(`aim: ${e.aim_behavior}`);
        if (e.repeat_peek_detected !== 'unknown') signals.push(`repeat_peek: ${e.repeat_peek_detected}`);
        if (e.indoor_outdoor !== 'unknown') signals.push(`environment: ${e.indoor_outdoor}`);
        if (e.build_or_edit_activity !== 'unknown') signals.push(`building: ${e.build_or_edit_activity}`);
        return signals.length > 0 ? signals.join(', ') : 'signals: unknown';
      };
      
      return `EVENT: ${ew.event.event_type} at ${formatTime(ew.event.timestamp_ms / 1000)}
  - PRE (${pre ? `${formatTime(pre.start_time)}-${formatTime(pre.end_time)}` : 'N/A'}): ${formatEvidence(pre)}
  - DURING (${during ? `${formatTime(during.start_time)}-${formatTime(during.end_time)}` : 'N/A'}): ${formatEvidence(during)}
  - POST (${post ? `${formatTime(post.start_time)}-${formatTime(post.end_time)}` : 'N/A'}): ${formatEvidence(post)}`;
    }).join('\n\n');

    const systemPrompt = `You are an AI ANALYST for gameplay review. Your role is to ANALYZE what happened — you do NOT give advice.

CRITICAL RULES:
- You ONLY analyze and report observations
- You do NOT give advice, suggestions, or recommendations
- You do NOT speculate beyond the evidence provided
- If evidence is weak or missing, explicitly state this as an uncertainty
- Every claim must be traceable to specific evidence

EVIDENCE SIGNALS AVAILABLE:
For each event, you receive structured evidence from PRE/DURING/POST windows:
- player_movement: stationary | slow | fast | unknown
- player_in_cover: high | medium | low | unknown
- player_health_state: healthy | low | critical | unknown
- aim_behavior: ADS_heavy | hipfire | erratic | unknown
- repeat_peek_detected: true | false | unknown
- indoor_outdoor: indoor | outdoor | mixed | unknown
- build_or_edit_activity: low | medium | high | unknown

ANALYSIS METHODOLOGY:
1. observed_behaviors: List ONLY things directly supported by evidence signals, annotations, or voice notes
2. uncertainties: List what CANNOT be confidently determined from available data
3. candidate_causes: Rank possible causes from high to low likelihood, each must reference specific evidence

OUTPUT FORMAT:
Provide analysis as JSON with this structure:
{
  "summary": "Brief 2-3 sentence factual overview of the session",
  "overall_score": <number 0-100 based on observable outcomes>,
  "event_analyses": [
    {
      "event_id": "<event id>",
      "event_type": "<kill|death|fight|etc>",
      "timestamp_seconds": <number>,
      "observed_behaviors": [
        "Player was moving fast in PRE window (evidence: player_movement=fast)",
        "Player was in low cover during the fight (evidence: player_in_cover=low)",
        "Voice note indicates player was trying to flank"
      ],
      "uncertainties": [
        "Cannot determine enemy positions from available data",
        "Health state unknown in PRE window",
        "No evidence of teammate coordination"
      ],
      "candidate_causes": [
        {
          "cause": "Exposed positioning during engagement",
          "likelihood": "high",
          "evidence_used": ["player_in_cover=low during DURING window", "indoor_outdoor=outdoor"]
        },
        {
          "cause": "Aggressive push without cover check",
          "likelihood": "medium",
          "evidence_used": ["player_movement=fast in PRE", "no annotation indicating cover check"]
        }
      ]
    }
  ],
  "feedback_cards": [],
  "patterns": [
    {
      "name": "Pattern name",
      "description": "Factual description of observed pattern across events",
      "frequency": "How often it occurred (with counts if possible)",
      "impact": "positive" | "negative" | "neutral"
    }
  ]
}

IMPORTANT:
- The "feedback_cards" array should be empty - analysis only, no feedback
- Do NOT include a "recommendations" field - you are an analyst, not a coach
- Each observed_behavior MUST cite the evidence source in parentheses
- Each candidate_cause MUST list specific evidence_used`;

    const userPrompt = `Analyze this gameplay session. Report ONLY observations and analysis — do NOT provide advice.

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

EVIDENCE WINDOWS WITH SIGNALS (PRE/DURING/POST for key events):
${clipWindowsContext || 'No clip windows extracted'}

For each key event, produce an event_analyses entry with:
1. observed_behaviors - bullet list of things directly supported by evidence
2. uncertainties - what cannot be confidently determined
3. candidate_causes - ranked list of possible causes (high → low likelihood), each referencing evidence

Remember: You are an ANALYST. Report facts and interpretations with evidence. Do NOT give advice.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
      // Log detailed error server-side only
      console.error("[Internal] Coach gateway error:", {
        status: response.status,
        error: errorText,
        timestamp: new Date().toISOString(),
      });
      // Throw safe generic error - don't expose gateway status
      throw new Error("Request failed. Please try again later.");
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

    // Attach extracted clip windows and evidence to the result for downstream processing
    analysisResult.clip_windows = allClipWindows;
    analysisResult.clip_evidence = clipEvidence;
    
    // Ensure event_analyses exists (backward compatibility)
    if (!analysisResult.event_analyses) {
      analysisResult.event_analyses = [];
    }

    console.log(`Analyst phase complete with ${analysisResult.event_analyses?.length || 0} event analyses`);

    // ========== COACH LAYER ==========
    // Transform analyst output into actionable coaching cards
    let coachingCards: CoachingCard[] = [];
    
    if (analysisResult.event_analyses.length > 0) {
      const coachSystemPrompt = `You are an AI COACH for post-session gameplay review. Your role is to provide actionable coaching based on analyst observations.

=== SAFETY CONSTRAINTS (MANDATORY) ===
Before generating ANY suggestion, you MUST verify it does NOT contain:

❌ REAL-TIME GUIDANCE: No advice that would only help during live gameplay
   - Bad: "When you see the enemy peek, immediately..."
   - Good: "Practice pre-aiming common angles in deathmatch"

❌ ENEMY LOCATION INFERENCE: No advice based on where enemies were/will be
   - Bad: "The enemy was likely flanking from..."
   - Good: "Check common flank routes before committing"

❌ AUTOMATION OR AIM ASSISTANCE: No suggestions about scripts, macros, or assisted aim
   - Bad: "Adjust your sensitivity to track better"
   - Good: "Focus on crosshair placement at head level"

❌ EXPLOITS OR GLITCHES: No map exploits, bugs, or unintended mechanics
   - Bad: "Use the pixel-peek on this corner"
   - Good: "Use available cover to minimize exposure"

❌ UNFAIR ADVANTAGE: Nothing that violates game ToS or competitive integrity

If a coaching insight risks violating these:
→ REWRITE it into a generalized, educational tip
→ LOWER confidence to "low"
→ Add "[Generalized]" prefix to the title

=== COACHING SCOPE ===
- This is POST-SESSION coaching only — purely educational
- Advice must be general principles, not situational exploitation
- One coaching card per event

COACHING LENSES (choose the most relevant):
- Positioning: Where the player was relative to cover, angles, teammates
- Awareness: Information gathering, minimap usage, sound cues, tracking threats
- Tempo: Pacing decisions, when to push vs hold, rotation timing
- Resource Management: Health, ammo, abilities, economy decisions
- Mechanics: Aim, movement tech, ability usage execution

CONFIDENCE CALIBRATION (you MUST follow these rules):

HIGH confidence requires ALL of:
- ≥3 strong evidence signals from the analyst (non-"unknown" values)
- No major uncertainties listed for this event
- Clear cause-effect relationship in candidate_causes
- NO safety constraint concerns
→ Use assertive language: "You pushed without checking angles"

MEDIUM confidence requires:
- 1-2 evidence signals present
- Some uncertainty acknowledged
- Candidate causes have "medium" likelihood
→ Use measured language: "The evidence suggests..." or "Based on the available signals..."

LOW confidence applies when:
- Mostly inferred from sparse data
- Multiple uncertainties listed
- Limited or ambiguous evidence signals
- OR the tip was generalized due to safety constraints
→ Use exploratory language: "It looks like...", "This may indicate...", "One possibility is..."

LANGUAGE ADAPTATION:
- HIGH: Direct statements ("You overextended", "The rotation was late")
- MEDIUM: Qualified statements ("The data suggests you may have", "It appears that")
- LOW: Hypothesis framing ("It's possible that", "One interpretation is", "This could indicate")

OUTPUT FORMAT:
Return a JSON array of coaching cards:
[
  {
    "event_id": "<from analyst>",
    "title": "Specific, non-generic title (e.g., 'Wide Peek Into Crossfire' not 'Positioning Error')",
    "lens": "Positioning" | "Awareness" | "Tempo" | "Resource Management" | "Mechanics",
    "what_happened": "1-2 grounded sentences describing what occurred",
    "why_it_mattered": "Game-logic explanation of the consequence",
    "coaching_tip": "1 specific, actionable behavior change (language matches confidence level)",
    "drill": "Simple practice instruction",
    "confidence": "high" | "medium" | "low",
    "confidence_reason": "1 sentence explaining why this confidence level (e.g., 'Based on 4 clear signals with no uncertainties' or 'Limited to movement data only, health unknown')",
    "evidence_summary": ["signal1", "signal2"],
    "safety_verified": true
  }
]

QUALITY CHECK:
- A skilled player should think "yeah, that's fair"
- Low-confidence tips should feel exploratory, not prescriptive
- confidence_reason must be specific to THIS event's evidence
- ALL tips must pass safety constraints`;

      const coachUserPrompt = `Generate coaching cards for these analyst observations:

GAME: ${session.game_name || 'Unknown'}

EVENT ANALYSES:
${JSON.stringify(analysisResult.event_analyses, null, 2)}

For each event_analysis:
1. Count non-"unknown" evidence signals to determine confidence
2. Check uncertainties list
3. Generate exactly ONE coaching card with appropriate confidence level and language
4. Include a specific confidence_reason explaining your calibration`;

      try {
        const coachResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: coachSystemPrompt },
              { role: "user", content: coachUserPrompt }
            ],
            temperature: 0.5,
          }),
        });

        if (coachResponse.ok) {
          const coachData = await coachResponse.json();
          const coachContent = coachData.choices?.[0]?.message?.content;

          if (coachContent) {
            try {
              const jsonMatch = coachContent.match(/```json\n?([\s\S]*?)\n?```/) || coachContent.match(/```\n?([\s\S]*?)\n?```/);
              const jsonStr = jsonMatch ? jsonMatch[1] : coachContent;
              const parsedCards = JSON.parse(jsonStr.trim());
              
              // Safety constraint keywords to flag for review
              const unsafePatterns = [
                /\b(aimbot|triggerbot|wallhack|esp|cheat|hack|macro|script|exploit|glitch|bug abuse)\b/i,
                /\b(when you see the enemy|when they peek|as soon as they)\b/i,
                /\b(enemy (is|was|will be) (at|in|near|behind))\b/i,
                /\b(adjust.*(sensitivity|dpi|aim assist))\b/i,
                /\b(pixel.?peek|out of map|clip through)\b/i,
              ];

              const sanitizeCard = (card: any): any => {
                const tipLower = (card.coaching_tip || '').toLowerCase();
                const drillLower = (card.drill || '').toLowerCase();
                const combinedText = `${tipLower} ${drillLower}`;
                
                const isUnsafe = unsafePatterns.some(pattern => pattern.test(combinedText));
                
                if (isUnsafe) {
                  console.warn(`Safety filter triggered for card: ${card.title}`);
                  return {
                    ...card,
                    title: `[Generalized] ${card.title}`,
                    coaching_tip: "Focus on fundamental positioning and decision-making principles.",
                    drill: "Review this moment and identify what information you had available.",
                    confidence: "low",
                    confidence_reason: "Tip was generalized to comply with safety guidelines.",
                    safety_verified: false,
                  };
                }
                
                return { ...card, safety_verified: true };
              };

              // Validate, filter, and sanitize coaching cards
              coachingCards = (Array.isArray(parsedCards) ? parsedCards : [parsedCards])
                .filter((card: any) => 
                  card.event_id && 
                  card.title && 
                  card.lens && 
                  card.what_happened &&
                  card.coaching_tip &&
                  card.confidence &&
                  card.confidence_reason
                )
                .map((card: any) => sanitizeCard({
                  ...card,
                  confidence_reason: card.confidence_reason || `Confidence: ${card.confidence}`,
                }));
              
              const sanitizedCount = coachingCards.filter((c: any) => !c.safety_verified).length;
              console.log(`Coach phase complete with ${coachingCards.length} coaching cards (${sanitizedCount} sanitized, confidence breakdown: ${coachingCards.filter((c: any) => c.confidence === 'high').length} high, ${coachingCards.filter((c: any) => c.confidence === 'medium').length} medium, ${coachingCards.filter((c: any) => c.confidence === 'low').length} low)`);
            } catch (parseError) {
              console.error("Failed to parse coaching response:", coachContent);
            }
          }
        } else {
          console.error("Coach API error:", coachResponse.status);
        }
      } catch (coachError) {
        console.error("Coach phase error:", coachError);
        // Continue without coaching cards - analyst output is still valuable
      }
    }

    analysisResult.coaching_cards = coachingCards;

    // ========== PHASE 3: SESSION SUMMARIZER ==========
    // Aggregate coaching cards into recurring patterns, focus goal, KPI, and checklist
    let sessionSummary: SessionSummary | undefined;

    if (coachingCards.length >= 2) {
      console.log(`Starting Summarizer phase with ${coachingCards.length} coaching cards...`);

      const summarizerSystemPrompt = `You are the AI Coach SUMMARIZER for Vantage post-session review.

ROLE: Aggregate coaching cards into an encouraging, actionable session summary.

CRITICAL RULES:
- The session should feel COACHED, not critiqued
- Focus on growth opportunities, not failures
- Patterns must be supported by MULTIPLE events (≥2)
- Focus goal must be achievable in ONE session

TASK:
1. Identify Top 2-3 RECURRING PATTERNS (only if multiple coaching cards share similar themes)
   - Look for repeated lenses, similar coaching_tips, or related behaviors
   - Each pattern must reference at least 2 events

2. Generate ONE FOCUS GOAL for next session
   - Specific, achievable in a single session
   - Addresses the most impactful pattern

3. Define ONE KPI to self-track
   - Simple, observable metric player can count themselves
   - Examples: "Deaths from overextending", "Times I checked minimap before pushing"

4. Create ONE CHECKLIST ITEM
   - Pre-game reminder that addresses the focus goal
   - Actionable and easy to remember

OUTPUT FORMAT:
{
  "recurring_patterns": [
    {
      "pattern": "Clear description of the recurring behavior",
      "event_count": 3,
      "lens": "Positioning",
      "evidence": ["event_id_1", "event_id_2", "event_id_3"]
    }
  ],
  "focus_goal": "One specific, achievable goal for next session",
  "kpi": "Simple metric to self-track (e.g., 'Count how many times I info-check before engaging')",
  "checklist_item": "Pre-game reminder (e.g., 'Before each round: call out one enemy position')"
}

TONE:
- Supportive and growth-oriented
- "You showed X tendency" not "You failed at X"
- Frame patterns as opportunities, not problems`;

      const summarizerUserPrompt = `Summarize this session's coaching cards:

GAME: ${session.game_name || 'Unknown'}

COACHING CARDS:
${JSON.stringify(coachingCards.map(c => ({
  event_id: c.event_id,
  title: c.title,
  lens: c.lens,
  coaching_tip: c.coaching_tip,
  confidence: c.confidence
})), null, 2)}

Generate:
1. Only patterns supported by 2+ events (or return empty array if no clear patterns)
2. One achievable focus goal for next session
3. One simple KPI the player can track themselves
4. One pre-game checklist reminder`;

      try {
        const summarizerResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: summarizerSystemPrompt },
              { role: "user", content: summarizerUserPrompt },
            ],
            temperature: 0.3,
            max_tokens: 1000,
          }),
        });

        if (summarizerResponse.ok) {
          const summarizerData = await summarizerResponse.json();
          const summarizerContent = summarizerData.choices?.[0]?.message?.content;

          if (summarizerContent) {
            try {
              // Extract JSON from response
              const jsonMatch = summarizerContent.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsedSummary = JSON.parse(jsonMatch[0]);
                
                // Validate required fields
                if (parsedSummary.focus_goal && parsedSummary.kpi && parsedSummary.checklist_item) {
                  sessionSummary = {
                    recurring_patterns: Array.isArray(parsedSummary.recurring_patterns) 
                      ? parsedSummary.recurring_patterns.filter((p: any) => p.event_count >= 2)
                      : [],
                    focus_goal: parsedSummary.focus_goal,
                    kpi: parsedSummary.kpi,
                    checklist_item: parsedSummary.checklist_item,
                  };
                  
                  console.log(`Summarizer phase complete: ${sessionSummary.recurring_patterns.length} patterns, goal="${sessionSummary.focus_goal.substring(0, 50)}..."`);
                }
              }
            } catch (parseError) {
              console.error("Failed to parse summarizer response:", summarizerContent);
            }
          }
        } else {
          console.error("Summarizer API error:", summarizerResponse.status);
        }
      } catch (summarizerError) {
        console.error("Summarizer phase error:", summarizerError);
        // Continue without summary - coaching cards are still valuable
      }
    }

    analysisResult.session_summary = sessionSummary;

    console.log(`Analysis complete: ${analysisResult.event_analyses?.length || 0} analyses, ${coachingCards.length} coaching cards, ${sessionSummary ? '1 summary' : 'no summary'}, ${allClipWindows.length} clip windows`);

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // Log full error server-side with context for debugging
    console.error("[Internal] Analysis error:", {
      error: error,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    // Return generic safe message to client - never expose internal error details
    return new Response(JSON.stringify({ error: "Request failed. Please try again later." }), {
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
