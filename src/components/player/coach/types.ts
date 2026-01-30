// Coach state machine types
export type CoachState = "not_run" | "running" | "complete" | "failed";

export type CoachConfidence = "high" | "medium" | "low";

export interface CoachNote {
  id: string;
  timestamp_seconds: number;
  end_timestamp_seconds?: number;
  type: "kill" | "death" | "fight_cluster" | "highlight";
  title: string;
  what_happened: string;
  why_it_mattered?: string;
  try_this: string;
  drill?: string;
  confidence: CoachConfidence;
  confidence_reason?: string;
  is_placeholder?: boolean;
}

export interface CoachSummary {
  focus_goal: string;
  patterns: string[];
  overall_confidence: CoachConfidence;
  kpi?: string;
  checklist_item?: string;
}

// Convert suggestion to coach note with coaching-shaped content
export function suggestionToCoachNote(suggestion: {
  id: string;
  timestamp_seconds: number;
  end_timestamp_seconds?: number;
  suggestion_type: "kill" | "death" | "fight_cluster" | "highlight";
  title: string;
  reason?: string;
  confidence?: string;
}): CoachNote {
  // Map suggestion type to coaching context
  const coachingContext: Record<string, { what: string; tryThis: string }> = {
    kill: {
      what: "You secured an elimination here. Review your crosshair placement and positioning leading up to this moment.",
      tryThis: "Pause here and note your angle, cover usage, and whether you over-extended after the kill.",
    },
    death: {
      what: "You were eliminated at this moment. Look at your positioning and the decisions in the seconds before.",
      tryThis: "Identify if you were exposed, low on resources, or made a predictable movement pattern.",
    },
    fight_cluster: {
      what: "Extended combat sequence detected. Multiple engagements happened in quick succession.",
      tryThis: "Review your target prioritization, cover usage between fights, and resource management.",
    },
    highlight: {
      what: "This moment shows notable gameplay worth reviewing for what went well or could improve.",
      tryThis: "Identify the key decision that made this moment stand out and whether it's repeatable.",
    },
  };

  const context = coachingContext[suggestion.suggestion_type] || coachingContext.highlight;

  return {
    id: suggestion.id,
    timestamp_seconds: suggestion.timestamp_seconds,
    end_timestamp_seconds: suggestion.end_timestamp_seconds,
    type: suggestion.suggestion_type,
    title: suggestion.title,
    what_happened: context.what,
    try_this: context.tryThis,
    confidence: (suggestion.confidence as CoachConfidence) || "medium",
    confidence_reason: suggestion.reason || "Based on timeline event patterns",
    is_placeholder: true, // Mark as placeholder until real coaching content is available
  };
}

// Generate a client-side summary from coach notes
export function generateClientSummary(notes: CoachNote[]): CoachSummary | null {
  if (notes.length === 0) return null;

  // Count by type
  const typeCounts = notes.reduce((acc, note) => {
    acc[note.type] = (acc[note.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Generate patterns based on what we have
  const patterns: string[] = [];
  
  if (typeCounts.death && typeCounts.death >= 2) {
    patterns.push(`${typeCounts.death} deaths detected — review positioning patterns`);
  }
  if (typeCounts.kill && typeCounts.kill >= 2) {
    patterns.push(`${typeCounts.kill} eliminations — identify what worked`);
  }
  if (typeCounts.fight_cluster) {
    patterns.push(`${typeCounts.fight_cluster} extended fight sequences`);
  }
  if (typeCounts.highlight) {
    patterns.push(`${typeCounts.highlight} highlight moments to study`);
  }

  // If no patterns from counts, create generic ones
  if (patterns.length === 0) {
    patterns.push("Review each flagged moment for positioning decisions");
  }

  // Determine focus goal based on death count
  let focus_goal = "Watch each flagged moment and note one improvement opportunity.";
  if (typeCounts.death && typeCounts.death >= 2) {
    focus_goal = "Focus on the 2–3 seconds before each death. What could you have done differently?";
  } else if (typeCounts.kill && typeCounts.kill >= typeCounts.death) {
    focus_goal = "Identify the patterns that led to successful eliminations and repeat them.";
  }

  // Calculate overall confidence
  const confidenceCounts = notes.reduce((acc, note) => {
    acc[note.confidence] = (acc[note.confidence] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  let overall_confidence: CoachConfidence = "medium";
  if (confidenceCounts.high && confidenceCounts.high >= notes.length / 2) {
    overall_confidence = "high";
  } else if (confidenceCounts.low && confidenceCounts.low >= notes.length / 2) {
    overall_confidence = "low";
  }

  return {
    focus_goal,
    patterns: patterns.slice(0, 3),
    overall_confidence,
    kpi: `Track: Positioning check before ${typeCounts.death || 0} deaths next session`,
    checklist_item: "Before queuing: Check angles before peeking",
  };
}
