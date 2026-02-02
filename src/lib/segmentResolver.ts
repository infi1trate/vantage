/**
 * Segment Resolver - Single Source of Truth
 * 
 * Resolves moments from timeline_events/annotations into valid video segments.
 * Every moment must deterministically produce a valid segment OR return a clear error.
 * 
 * Resolution rules:
 * 1. If moment has explicit startMs/endMs, use them.
 * 2. Else derive a safe default range centered on the moment timestamp:
 *    - Default clip length = 10 seconds
 *    - Start = max(0, momentTimestampMs - 3000)  [3 seconds before]
 *    - End = min(videoDurationMs, start + 10000) [10 seconds total]
 * 
 * Validation requirements:
 * - startMs < endMs
 * - endMs - startMs >= 2000ms (2 second minimum)
 */

import { supabase } from "@/integrations/supabase/client";

// Configuration
const DEFAULT_CLIP_LENGTH_MS = 10_000; // 10 seconds default clip
const LEAD_IN_MS = 3_000; // 3 seconds before the moment
const MIN_CLIP_DURATION_MS = 2_000; // 2 seconds minimum

/**
 * Moment types for display
 */
export type MomentType = "Kill" | "Death" | "Highlight" | "Objective" | "Marker" | "Note";

/**
 * Resolved segment with all required data for reel assembly
 */
export interface ResolvedSegment {
  /** The moment ID this segment was resolved from */
  momentId: string;
  /** Reference to the source video (video_assets id or session video_url) */
  sourceVideoRef: string;
  /** Start time within the source video in milliseconds */
  startMs: number;
  /** End time within the source video in milliseconds */
  endMs: number;
  /** Duration of the segment in milliseconds */
  durationMs: number;
  /** Type of moment (Kill, Death, etc.) */
  momentType: MomentType;
  /** Formatted timestamp for display (e.g., "3:14") */
  momentTimestamp: string;
  /** Raw timestamp in seconds */
  timestampSeconds: number;
  /** Human-readable label */
  label: string;
}

/**
 * Segment resolution error
 */
export interface SegmentResolutionError {
  momentId: string;
  momentType: MomentType;
  momentTimestamp: string;
  timestampSeconds: number;
  reason:
    | "moment_not_found"
    | "session_not_found"
    | "no_video_available"
    | "invalid_range"
    | "duration_too_short"
    | "exceeds_video_duration"
    | "unknown";
  description: string;
}

/**
 * Result of segment resolution
 */
export type SegmentResolutionResult =
  | { success: true; segment: ResolvedSegment }
  | { success: false; error: SegmentResolutionError };

/**
 * Raw moment data from database
 */
interface RawMomentData {
  id: string;
  annotation_type?: string | null;
  title?: string | null;
  timestamp_seconds: number;
  end_timestamp_seconds?: number | null;
  /** Explicit start in seconds (if set by user) */
  start_timestamp_seconds?: number | null;
}

/**
 * Session data for validation
 */
interface SessionData {
  id: string;
  video_url: string | null;
  duration_seconds: number | null;
}

/**
 * Format seconds as MM:SS
 */
export function formatTimestampSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Map annotation_type to display MomentType
 */
export function getMomentType(annotationType: string | null | undefined): MomentType {
  switch (annotationType?.toLowerCase()) {
    case "kill":
      return "Kill";
    case "death":
      return "Death";
    case "highlight":
      return "Highlight";
    case "objective":
      return "Objective";
    case "note":
      return "Note";
    case "marker":
    default:
      return "Marker";
  }
}

/**
 * Create a segment resolution error
 */
function createError(
  momentId: string,
  momentType: MomentType,
  timestampSeconds: number,
  reason: SegmentResolutionError["reason"],
  description: string
): SegmentResolutionError {
  return {
    momentId,
    momentType,
    momentTimestamp: formatTimestampSeconds(timestampSeconds),
    timestampSeconds,
    reason,
    description,
  };
}

/**
 * Calculate clip range from moment timestamp
 * 
 * Uses centered approach: 3 seconds before, 7 seconds after
 * Clamped to video bounds and minimum duration enforced
 */
function calculateClipRange(
  momentTimestampMs: number,
  explicitStartMs: number | null | undefined,
  explicitEndMs: number | null | undefined,
  videoDurationMs: number | null
): { startMs: number; endMs: number } {
  // If explicit start/end are provided, use them
  if (
    explicitStartMs !== null &&
    explicitStartMs !== undefined &&
    explicitEndMs !== null &&
    explicitEndMs !== undefined
  ) {
    return {
      startMs: Math.max(0, explicitStartMs),
      endMs: explicitEndMs,
    };
  }

  // Derive from moment timestamp with lead-in
  // Start 3 seconds before the moment (or 0 if that's before the start)
  let startMs = Math.max(0, momentTimestampMs - LEAD_IN_MS);
  
  // End 10 seconds after start
  let endMs = startMs + DEFAULT_CLIP_LENGTH_MS;

  // Clamp to video duration if known
  if (videoDurationMs !== null && videoDurationMs > 0) {
    // If end exceeds video, push it back
    if (endMs > videoDurationMs) {
      endMs = videoDurationMs;
      // Also adjust start to try to maintain clip length
      startMs = Math.max(0, endMs - DEFAULT_CLIP_LENGTH_MS);
    }
  }

  return { startMs, endMs };
}

/**
 * Resolve a single moment into a valid video segment
 * 
 * This is the SINGLE SOURCE OF TRUTH for moment → segment resolution.
 * All reel assembly must use this function.
 * 
 * @param sessionId - The session containing the moment
 * @param momentId - The ID of the moment (annotation) to resolve
 * @returns A resolved segment or a clear error
 */
export async function resolveSegmentFromMoment(
  sessionId: string,
  momentId: string
): Promise<SegmentResolutionResult> {
  const defaultMomentType: MomentType = "Marker";
  const defaultTimestamp = 0;

  try {
    // 1. Fetch moment data from annotations table
    const { data: moment, error: momentError } = await supabase
      .from("annotations")
      .select("id, annotation_type, title, timestamp_seconds, end_timestamp_seconds")
      .eq("id", momentId)
      .maybeSingle();

    if (momentError) {
      console.error(`[SegmentResolver] Moment lookup error for ${momentId}:`, momentError);
      return {
        success: false,
        error: createError(
          momentId,
          defaultMomentType,
          defaultTimestamp,
          "moment_not_found",
          "Failed to look up moment"
        ),
      };
    }

    if (!moment) {
      // Try timeline_events as fallback
      const { data: timelineEvent, error: timelineError } = await supabase
        .from("timeline_events")
        .select("id, event_type, title, timestamp_ms, duration_ms")
        .eq("id", momentId)
        .maybeSingle();

      if (timelineError || !timelineEvent) {
        return {
          success: false,
          error: createError(
            momentId,
            defaultMomentType,
            defaultTimestamp,
            "moment_not_found",
            "Moment not found in annotations or timeline events"
          ),
        };
      }

      // Use timeline event data
      const momentType = getMomentType(timelineEvent.event_type);
      const timestampSeconds = (timelineEvent.timestamp_ms ?? 0) / 1000;
      const durationMs = timelineEvent.duration_ms ?? DEFAULT_CLIP_LENGTH_MS;

      // Get session data for video reference
      const sessionResult = await getSessionData(sessionId);
      if (sessionResult.success === false) {
        return {
          success: false,
          error: createError(
            momentId,
            momentType,
            timestampSeconds,
            sessionResult.reason,
            sessionResult.description
          ),
        };
      }

      const session = sessionResult.session;
      const videoDurationMs = (session.duration_seconds ?? 0) * 1000;

      // Calculate range
      const momentTimestampMs = timelineEvent.timestamp_ms ?? 0;
      const { startMs, endMs } = calculateClipRange(
        momentTimestampMs,
        null,
        durationMs ? momentTimestampMs + durationMs : null,
        videoDurationMs > 0 ? videoDurationMs : null
      );

      // Validate range
      const validationResult = validateRange(startMs, endMs, videoDurationMs || null);
      if (validationResult.valid === false) {
        return {
          success: false,
          error: createError(
            momentId,
            momentType,
            timestampSeconds,
            validationResult.reason,
            validationResult.description
          ),
        };
      }

      return {
        success: true,
        segment: {
          momentId,
          sourceVideoRef: session.video_url!,
          startMs,
          endMs,
          durationMs: endMs - startMs,
          momentType,
          momentTimestamp: formatTimestampSeconds(timestampSeconds),
          timestampSeconds,
          label: timelineEvent.title || `${momentType} at ${formatTimestampSeconds(timestampSeconds)}`,
        },
      };
    }

    // Process annotation moment
    const momentType = getMomentType(moment.annotation_type);
    const timestampSeconds = moment.timestamp_seconds ?? 0;

    // 2. Get session data for video reference and duration
    const sessionResult = await getSessionData(sessionId);
    if (sessionResult.success === false) {
      return {
        success: false,
        error: createError(
          momentId,
          momentType,
          timestampSeconds,
          sessionResult.reason,
          sessionResult.description
        ),
      };
    }

    const session = sessionResult.session;
    const videoDurationMs = (session.duration_seconds ?? 0) * 1000;

    // 3. Calculate clip range
    const momentTimestampMs = timestampSeconds * 1000;
    const explicitEndMs = moment.end_timestamp_seconds
      ? moment.end_timestamp_seconds * 1000
      : null;

    const { startMs, endMs } = calculateClipRange(
      momentTimestampMs,
      null, // No explicit start in annotations schema
      explicitEndMs,
      videoDurationMs > 0 ? videoDurationMs : null
    );

    // 4. Validate range
    const validationResult = validateRange(startMs, endMs, videoDurationMs || null);
    if (validationResult.valid === false) {
      return {
        success: false,
        error: createError(
          momentId,
          momentType,
          timestampSeconds,
          validationResult.reason,
          validationResult.description
        ),
      };
    }

    // 5. Return resolved segment
    return {
      success: true,
      segment: {
        momentId,
        sourceVideoRef: session.video_url!,
        startMs,
        endMs,
        durationMs: endMs - startMs,
        momentType,
        momentTimestamp: formatTimestampSeconds(timestampSeconds),
        timestampSeconds,
        label: moment.title || `${momentType} at ${formatTimestampSeconds(timestampSeconds)}`,
      },
    };
  } catch (error) {
    console.error(`[SegmentResolver] Unexpected error resolving ${momentId}:`, error);
    return {
      success: false,
      error: createError(
        momentId,
        defaultMomentType,
        defaultTimestamp,
        "unknown",
        error instanceof Error ? error.message : "Unknown error during resolution"
      ),
    };
  }
}

/**
 * Get session data with caching potential
 */
async function getSessionData(
  sessionId: string
): Promise<
  | { success: true; session: SessionData }
  | { success: false; reason: SegmentResolutionError["reason"]; description: string }
> {
  const { data: session, error } = await supabase
    .from("capture_sessions")
    .select("id, video_url, duration_seconds")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    console.error(`[SegmentResolver] Session lookup error for ${sessionId}:`, error);
    return {
      success: false,
      reason: "session_not_found",
      description: "Failed to look up session",
    };
  }

  if (!session) {
    return {
      success: false,
      reason: "session_not_found",
      description: "Session not found",
    };
  }

  if (!session.video_url) {
    return {
      success: false,
      reason: "no_video_available",
      description: "Session has no video available",
    };
  }

  return { success: true, session };
}

/**
 * Validate a clip range
 */
function validateRange(
  startMs: number,
  endMs: number,
  videoDurationMs: number | null
): { valid: true } | { valid: false; reason: SegmentResolutionError["reason"]; description: string } {
  // Check startMs < endMs
  if (startMs >= endMs) {
    return {
      valid: false,
      reason: "invalid_range",
      description: `Invalid time range: start (${startMs}ms) >= end (${endMs}ms)`,
    };
  }

  // Check minimum duration
  const durationMs = endMs - startMs;
  if (durationMs < MIN_CLIP_DURATION_MS) {
    return {
      valid: false,
      reason: "duration_too_short",
      description: `Clip duration (${durationMs}ms) is less than minimum (${MIN_CLIP_DURATION_MS}ms)`,
    };
  }

  // Check against video duration if known
  if (videoDurationMs !== null && videoDurationMs > 0 && endMs > videoDurationMs) {
    return {
      valid: false,
      reason: "exceeds_video_duration",
      description: `Clip end (${endMs}ms) exceeds video duration (${videoDurationMs}ms)`,
    };
  }

  return { valid: true };
}

/**
 * Resolve multiple moments into segments in parallel (with individual timeouts)
 * 
 * Returns all results, both successes and failures, so callers can decide
 * whether to proceed with partial results.
 */
export async function resolveAllSegments(
  sessionId: string,
  momentIds: string[],
  timeoutMs: number = 5_000
): Promise<{
  segments: ResolvedSegment[];
  errors: SegmentResolutionError[];
  /** Map of momentId → segment/error for quick lookup */
  results: Map<string, SegmentResolutionResult>;
}> {
  const results = new Map<string, SegmentResolutionResult>();
  const segments: ResolvedSegment[] = [];
  const errors: SegmentResolutionError[] = [];

  // Resolve all in parallel with individual timeouts
  const promises = momentIds.map(async (momentId) => {
    const timeoutPromise = new Promise<SegmentResolutionResult>((resolve) => {
      setTimeout(() => {
        resolve({
          success: false,
          error: {
            momentId,
            momentType: "Marker",
            momentTimestamp: "0:00",
            timestampSeconds: 0,
            reason: "unknown",
            description: `Timed out resolving segment after ${timeoutMs}ms`,
          },
        });
      }, timeoutMs);
    });

    const resolutionPromise = resolveSegmentFromMoment(sessionId, momentId);

    return Promise.race([resolutionPromise, timeoutPromise]);
  });

  const allResults = await Promise.all(promises);

  // Organize results
  allResults.forEach((result, index) => {
    const momentId = momentIds[index];
    results.set(momentId, result);

    if (result.success === true) {
      segments.push(result.segment);
    } else {
      errors.push(result.error);
    }
  });

  return { segments, errors, results };
}

/**
 * Build MomentSegmentInput array from resolved segments
 * This bridges the resolver to the existing executeAssembly function
 */
export function toMomentSegmentInputs(
  segments: ResolvedSegment[]
): Array<{
  momentId: string;
  durationMs: number;
  startMs: number;
  endMs: number;
  label: string;
  timestampSeconds: number;
}> {
  return segments.map((seg) => ({
    momentId: seg.momentId,
    durationMs: seg.durationMs,
    startMs: seg.startMs,
    endMs: seg.endMs,
    label: seg.label,
    timestampSeconds: seg.timestampSeconds,
  }));
}
