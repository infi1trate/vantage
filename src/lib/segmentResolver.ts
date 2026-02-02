/**
 * Segment Resolver - Single Source of Truth
 * 
 * Resolves moments from timeline_events/annotations into valid video segments.
 * Every moment must deterministically produce a valid segment OR return a clear error.
 * 
 * TIME BASIS DEFINITIONS:
 * - sessionTimeMs: Time since recording session start (used in annotations/moments)
 * - videoTimeMs: Time within the screen recording file (used for playback)
 * 
 * These may differ if:
 * - Recording started before video capture began
 * - Video was trimmed at the start
 * - Multiple video assets with offsets
 * 
 * NORMALIZATION:
 * videoTimeMs = sessionTimeMs - videoStartOffsetMs
 * If no offset exists in metadata, assume sessionTimeMs === videoTimeMs
 * 
 * Resolution rules:
 * 1. If moment has explicit startMs/endMs, use them (already in video time).
 * 2. Else derive a safe default range centered on the moment timestamp:
 *    - Default clip length = 10 seconds
 *    - Start = max(0, momentVideoTimeMs - 3000)  [3 seconds before]
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
  /** Whether the segment was auto-repaired from invalid/missing data */
  wasRepaired?: boolean;
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
 * Session data for validation and time normalization
 */
interface SessionData {
  id: string;
  video_url: string | null;
  duration_seconds: number | null;
  /** 
   * Offset in milliseconds from session start to video start.
   * videoTimeMs = sessionTimeMs - videoStartOffsetMs
   * Default: 0 (session time equals video time)
   */
  videoStartOffsetMs: number;
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
 * Convert session time to video time
 * 
 * @param sessionTimeMs - Time in session basis (since recording start)
 * @param videoStartOffsetMs - Offset from session start to video start
 * @returns Time in video basis (within the video file)
 */
function sessionTimeToVideoTime(sessionTimeMs: number, videoStartOffsetMs: number): number {
  // videoTimeMs = sessionTimeMs - videoStartOffsetMs
  // Clamp to 0 if the result would be negative (moment before video started)
  return Math.max(0, sessionTimeMs - videoStartOffsetMs);
}

/**
 * Calculate clip range from moment timestamp (in VIDEO time basis)
 * 
 * Uses centered approach: 3 seconds before, 7 seconds after
 * Clamped to video bounds and minimum duration enforced
 * 
 * AUTO-REPAIR LOGIC:
 * - If explicit range is out of bounds, clamp to valid range
 * - If range is too short, extend to minimum duration
 * - Always produces a valid range if videoDurationMs >= MIN_CLIP_DURATION_MS
 * 
 * IMPORTANT: All input timestamps must be in VIDEO time (not session time)
 */
function calculateClipRange(
  momentVideoTimeMs: number,
  explicitStartMs: number | null | undefined,
  explicitEndMs: number | null | undefined,
  videoDurationMs: number | null
): { startMs: number; endMs: number; wasRepaired: boolean } {
  let wasRepaired = false;
  let startMs: number;
  let endMs: number;

  // If explicit start/end are provided, use them (with repair)
  if (
    explicitStartMs !== null &&
    explicitStartMs !== undefined &&
    explicitEndMs !== null &&
    explicitEndMs !== undefined
  ) {
    startMs = explicitStartMs;
    endMs = explicitEndMs;
    
    // REPAIR: Clamp negative start
    if (startMs < 0) {
      startMs = 0;
      wasRepaired = true;
    }
    
    // REPAIR: Swap if inverted
    if (startMs > endMs) {
      [startMs, endMs] = [endMs, startMs];
      wasRepaired = true;
    }
  } else {
    // Derive from moment video timestamp with lead-in
    // Start 3 seconds before the moment (or 0 if that's before the start)
    startMs = Math.max(0, momentVideoTimeMs - LEAD_IN_MS);
    
    // End 10 seconds after start
    endMs = startMs + DEFAULT_CLIP_LENGTH_MS;
  }

  // Clamp to video duration if known
  if (videoDurationMs !== null && videoDurationMs > 0) {
    // REPAIR: If end exceeds video, clamp it
    if (endMs > videoDurationMs) {
      endMs = videoDurationMs;
      wasRepaired = true;
    }
    
    // REPAIR: If start exceeds video, clamp it
    if (startMs >= videoDurationMs) {
      startMs = Math.max(0, videoDurationMs - DEFAULT_CLIP_LENGTH_MS);
      wasRepaired = true;
    }
    
    // Adjust start to try to maintain clip length
    if (endMs - startMs < DEFAULT_CLIP_LENGTH_MS) {
      startMs = Math.max(0, endMs - DEFAULT_CLIP_LENGTH_MS);
    }
  }

  // REPAIR: Ensure minimum duration
  if (endMs - startMs < MIN_CLIP_DURATION_MS) {
    // Try to extend end first
    if (videoDurationMs === null || endMs + (MIN_CLIP_DURATION_MS - (endMs - startMs)) <= videoDurationMs) {
      endMs = startMs + MIN_CLIP_DURATION_MS;
    } else if (videoDurationMs !== null) {
      // Can't extend end, try to move start back
      endMs = videoDurationMs;
      startMs = Math.max(0, endMs - MIN_CLIP_DURATION_MS);
    }
    wasRepaired = true;
  }

  return { startMs, endMs, wasRepaired };
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

      // Normalize: Convert session time to video time
      // timeline_events.timestamp_ms is in session time basis
      const sessionTimestampMs = timelineEvent.timestamp_ms ?? 0;
      const videoTimestampMs = sessionTimeToVideoTime(sessionTimestampMs, session.videoStartOffsetMs);
      
      // Calculate range using video-time basis (with auto-repair)
      const { startMs, endMs, wasRepaired } = calculateClipRange(
        videoTimestampMs,
        null,
        durationMs ? videoTimestampMs + durationMs : null,
        videoDurationMs > 0 ? videoDurationMs : null
      );
      
      if (wasRepaired) {
        console.log(`[SegmentResolver] Auto-repaired segment for timeline event ${momentId}: ${startMs}ms-${endMs}ms`);
      }

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
          wasRepaired,
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

    // 3. Normalize timestamps: Convert session time to video time
    // annotations.timestamp_seconds is in session time basis
    const sessionTimestampMs = timestampSeconds * 1000;
    const videoTimestampMs = sessionTimeToVideoTime(sessionTimestampMs, session.videoStartOffsetMs);
    
    // Handle explicit end timestamp if present (also needs normalization)
    const explicitEndSessionMs = moment.end_timestamp_seconds
      ? moment.end_timestamp_seconds * 1000
      : null;
    const explicitEndVideoMs = explicitEndSessionMs !== null
      ? sessionTimeToVideoTime(explicitEndSessionMs, session.videoStartOffsetMs)
      : null;

    // 4. Calculate clip range using video-time basis (with auto-repair)
    const { startMs, endMs, wasRepaired } = calculateClipRange(
      videoTimestampMs,
      null, // No explicit start in annotations schema
      explicitEndVideoMs,
      videoDurationMs > 0 ? videoDurationMs : null
    );
    
    if (wasRepaired) {
      console.log(`[SegmentResolver] Auto-repaired segment for annotation ${momentId}: ${startMs}ms-${endMs}ms`);
    }

    // 5. Validate range
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
    // 6. Return resolved segment
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
        wasRepaired,
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
 * Extracts video start offset from metadata for time normalization
 */
async function getSessionData(
  sessionId: string
): Promise<
  | { success: true; session: SessionData }
  | { success: false; reason: SegmentResolutionError["reason"]; description: string }
> {
  const { data: session, error } = await supabase
    .from("capture_sessions")
    .select("id, video_url, duration_seconds, metadata")
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

  // Extract video start offset from metadata if present
  // This handles cases where recording started before video capture
  const metadata = session.metadata as Record<string, unknown> | null;
  const videoStartOffsetMs = extractVideoStartOffset(metadata);

  return { 
    success: true, 
    session: {
      id: session.id,
      video_url: session.video_url,
      duration_seconds: session.duration_seconds,
      videoStartOffsetMs,
    }
  };
}

/**
 * Extract video start offset from session metadata
 * 
 * Looks for common offset fields that might be stored:
 * - videoStartOffsetMs (direct milliseconds)
 * - videoStartOffset (seconds, converted to ms)
 * - recordingStartDelta (legacy field)
 * 
 * Returns 0 if no offset is found (session time === video time)
 */
function extractVideoStartOffset(metadata: Record<string, unknown> | null): number {
  if (!metadata) return 0;

  // Check for direct millisecond offset
  if (typeof metadata.videoStartOffsetMs === "number") {
    return metadata.videoStartOffsetMs;
  }

  // Check for seconds offset (convert to ms)
  if (typeof metadata.videoStartOffset === "number") {
    return metadata.videoStartOffset * 1000;
  }

  // Check for legacy delta field
  if (typeof metadata.recordingStartDelta === "number") {
    return metadata.recordingStartDelta;
  }

  // Check nested in video metadata
  const videoMeta = metadata.video as Record<string, unknown> | undefined;
  if (videoMeta) {
    if (typeof videoMeta.startOffsetMs === "number") {
      return videoMeta.startOffsetMs;
    }
    if (typeof videoMeta.startOffset === "number") {
      return videoMeta.startOffset * 1000;
    }
  }

  // No offset found - assume session time equals video time
  return 0;
}

/**
 * Validate a clip range
 */
/**
 * Validate a clip range - only fails for truly unrecoverable issues
 * 
 * AUTO-REPAIR means most issues are fixed in calculateClipRange.
 * This validation catches edge cases that couldn't be repaired:
 * - Video too short to produce minimum segment
 * - Completely invalid state after repair
 */
function validateRange(
  startMs: number,
  endMs: number,
  videoDurationMs: number | null
): { valid: true } | { valid: false; reason: SegmentResolutionError["reason"]; description: string } {
  // Check startMs < endMs (should be fixed by repair, but sanity check)
  if (startMs >= endMs) {
    return {
      valid: false,
      reason: "invalid_range",
      description: `Invalid time range after repair: start (${startMs}ms) >= end (${endMs}ms)`,
    };
  }

  // Check minimum duration (should be ensured by repair)
  const durationMs = endMs - startMs;
  if (durationMs < MIN_CLIP_DURATION_MS) {
    // Only fail if video is too short to produce minimum segment
    if (videoDurationMs !== null && videoDurationMs < MIN_CLIP_DURATION_MS) {
      return {
        valid: false,
        reason: "duration_too_short",
        description: `Video duration (${videoDurationMs}ms) is too short for minimum clip (${MIN_CLIP_DURATION_MS}ms)`,
      };
    }
    // Otherwise this shouldn't happen after repair
    return {
      valid: false,
      reason: "duration_too_short",
      description: `Clip duration (${durationMs}ms) is less than minimum after repair`,
    };
  }

  // Note: We no longer fail for exceeds_video_duration because calculateClipRange clamps it
  // Only check for obviously invalid state
  if (videoDurationMs !== null && videoDurationMs > 0 && startMs >= videoDurationMs) {
    return {
      valid: false,
      reason: "exceeds_video_duration",
      description: `Clip start (${startMs}ms) is at or beyond video end (${videoDurationMs}ms)`,
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
