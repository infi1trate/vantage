import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
}

interface SessionData {
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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session } = await req.json() as { session: SessionData };
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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

    const systemPrompt = `You are an expert gameplay coach and analyst. Your role is to provide actionable, supportive feedback on gaming sessions.

IMPORTANT GUIDELINES:
- Frame all behavioral observations as gameplay-relevant heuristics, NOT medical or psychological diagnoses
- Use language like "appears to show", "may indicate", "pattern suggests" rather than definitive statements
- Focus on actionable improvements within the player's control
- Reference specific moments using timestamps when possible
- When players express intent in voice notes, connect it to observed outcomes
- Identify behavioral patterns that affect gameplay performance
- Be encouraging while honest about areas for improvement

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
      "confidence": "high" | "medium" | "low"
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

Provide comprehensive feedback with moment-level cards, pattern analysis, and actionable recommendations. Focus on connecting player intent (from voice notes) with observed outcomes. Frame any behavioral observations as gameplay heuristics.`;

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
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
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
