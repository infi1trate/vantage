/**
 * Reels Data Layer
 * 
 * Functions for managing Reel entities - first-class objects
 * that represent edited clips with effects, frames, and packages.
 */

import { supabase } from "@/integrations/supabase/client";

// Re-export segment resolver as the single source of truth for moment → segment conversion
export {
  resolveSegmentFromMoment,
  resolveAllSegments,
  toMomentSegmentInputs,
  formatTimestampSeconds,
  getMomentType,
  type ResolvedSegment,
  type SegmentResolutionError,
  type SegmentResolutionResult,
  type MomentType as ResolverMomentType,
} from "./segmentResolver";

// Re-export asset readiness gate
export {
  checkAssetReadiness,
  waitForAssetReadiness,
  getAssetStatusMessage,
  type AssetReadinessStatus,
  type AssetReadinessResult,
} from "./assetReadiness";

// NOTE: status is stored as text in the backend; we model the known states here.
export type ReelStatus = "compiling" | "waiting_for_source" | "draft" | "rendering" | "ready" | "failed" | "needs_attention";
export type AspectRatio = "16:9" | "9:16" | "1:1";

/**
 * Assembly steps for reel creation
 * MANIFEST-FIRST: Assembly completes at finalizing_manifest
 * Preview rendering is a separate background job
 */
export type AssemblyStep = 
  | "collecting_clips"       // Resolve clip segment references
  | "finalizing_manifest"    // Write manifest + totalDurationMs → SUCCESS
  | "ready"                  // Assembly complete (manifest ready)
  | "failed";

/**
 * Preview status - separate from assembly status
 * Preview is optional and doesn't block editing
 */
export type PreviewStatus = "pending" | "rendering" | "ready" | "failed";

export type PlaybackMode = "preview" | "manifest";

/**
 * Custom error for assembly failures with user-friendly message
 */
export class AssemblyError extends Error {
  readonly userMessage: string;
  
  constructor(devMessage: string, userMessage: string) {
    super(devMessage);
    this.name = "AssemblyError";
    this.userMessage = userMessage;
  }
}

/**
 * Manifest clip entry - ordered clip list with timing info
 */
export interface ManifestClip {
  momentId: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  order: number;
}

/**
 * Reel manifest - complete playback specification
 */
export interface ReelManifest {
  clips: ManifestClip[];
  totalDurationMs: number;
  aspectRatio: AspectRatio;
  createdAt: string;
}

export interface Reel {
  id: string;
  user_id: string;
  session_id: string | null;
  title: string;
  aspect_ratio: AspectRatio;
  status: ReelStatus;
  source_moment_ids: string[];
  duration_seconds: number | null;
  thumbnail_url: string | null;
  preview_url: string | null;
  output_url: string | null;
  output_file_size_bytes: number | null;
  render_started_at: string | null;
  render_completed_at: string | null;
  render_error: string | null;
  // Assembly instrumentation
  assembly_step: AssemblyStep | null;
  step_started_at: string | null;
  step_completed_at: string | null;
  // Manifest and playback
  manifest: ReelManifest | null;
  preview_ref: string | null;
  playback_mode: PlaybackMode;
  total_duration_ms: number | null;
  // Preview generation (separate from assembly)
  /** Status of optional preview video generation */
  preview_status: PreviewStatus;
  // Retry tracking
  attempt_count: number;
  job_id: string | null;
  /** Unique ID for the current assembly attempt - prevents stale updates */
  assembly_attempt_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReelInput {
  sessionId: string;
  title?: string;
  aspectRatio: AspectRatio;
  momentIds: string[];
}

/**
 * Convert raw Supabase row to typed Reel
 * Handles JSON -> typed object conversion for manifest
 */
function toReel(row: unknown): Reel {
  const r = row as Record<string, unknown>;
  return {
    ...r,
    manifest: r.manifest as ReelManifest | null,
    playback_mode: (r.playback_mode as PlaybackMode) || "preview",
    preview_status: (r.preview_status as PreviewStatus) || "pending",
  } as Reel;
}

function toReelArray(rows: unknown[]): Reel[] {
  return rows.map(toReel);
}

/**
 * Determine effective playback mode for a reel
 * 
 * Returns "stitched_preview" if a valid preview is available,
 * "manifest" otherwise (falls back to sequencing clips)
 */
export function getEffectivePlaybackMode(reel: Reel | null): "stitched_preview" | "manifest" {
  if (!reel) return "manifest";
  
  // Use stitched preview if:
  // 1. Preview URL exists
  // 2. Preview status is ready
  // 3. Preview ref exists
  if (reel.preview_url && reel.preview_status === "ready" && reel.preview_ref) {
    return "stitched_preview";
  }
  
  // Otherwise fall back to manifest playback
  return "manifest";
}

/**
 * Check if reel has valid video playback available
 * (either stitched preview or manifest with session video)
 */
export function hasPlaybackAvailable(reel: Reel | null, sessionVideoUrl?: string | null): boolean {
  if (!reel) return false;
  
  // Has stitched preview
  if (reel.preview_url && reel.preview_status === "ready") {
    return true;
  }
  
  // Has manifest + session video for fallback
  if (reel.manifest && reel.manifest.clips.length > 0 && sessionVideoUrl) {
    return true;
  }
  
  return false;
}

/**
 * Create a new reel from selected moments
 * 
 * Reels are first-class persistent objects that exist independently
 * of Session Detail and are always edited via the Reel Editor.
 */
export async function createReel(input: CreateReelInput): Promise<Reel> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Create with "compiling" status and initial assembly step
  const now = new Date().toISOString();
  const attemptId = crypto.randomUUID();
  
  const { data, error } = await supabase
    .from("reels")
    .insert({
      user_id: user.id,
      session_id: input.sessionId,
      title: input.title || "Untitled Reel",
      aspect_ratio: input.aspectRatio,
      source_moment_ids: input.momentIds,
      status: "compiling",
      assembly_step: "collecting_clips",
      step_started_at: now,
      assembly_attempt_id: attemptId,
    })
    .select()
    .single();

  if (error) throw error;
  
  // Return immediately - assembly will be triggered by the hook
  // The reel is in "compiling" status with "collecting_clips" step
  // The Reel Editor will detect this and show the compiling placeholder
  return toReel(data);
}

/**
 * Get a single reel by ID
 */
export async function getReel(reelId: string): Promise<Reel | null> {
  const { data, error } = await supabase
    .from("reels")
    .select("*")
    .eq("id", reelId)
    .maybeSingle();

  if (error) throw error;
  return data ? toReel(data) : null;
}

/**
 * Get all reels for a session
 */
export async function getReelsForSession(sessionId: string): Promise<Reel[]> {
  const { data, error } = await supabase
    .from("reels")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return toReelArray(data || []);
}

/**
 * Get all reels for current user
 */
export async function getUserReels(): Promise<Reel[]> {
  const { data, error } = await supabase
    .from("reels")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return toReelArray(data || []);
}

/**
 * Update reel properties
 */
export async function updateReel(
  reelId: string,
  updates: Partial<Pick<Reel, "title" | "aspect_ratio" | "source_moment_ids" | "status">>
): Promise<Reel> {
  const { data, error } = await supabase
    .from("reels")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reelId)
    .select()
    .single();

  if (error) throw error;
  return toReel(data);
}

/**
 * Delete a reel
 */
export async function deleteReel(reelId: string): Promise<void> {
  const { error } = await supabase
    .from("reels")
    .delete()
    .eq("id", reelId);

  if (error) throw error;
}

/**
 * Start rendering a reel (updates status)
 */
export async function startReelRender(reelId: string): Promise<Reel> {
  const { data, error } = await supabase
    .from("reels")
    .update({
      status: "rendering",
      render_started_at: new Date().toISOString(),
      render_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reelId)
    .select()
    .single();

  if (error) throw error;
  return toReel(data);
}

/**
 * Complete reel render successfully
 */
export async function completeReelRender(
  reelId: string,
  outputUrl: string,
  fileSizeBytes?: number
): Promise<Reel> {
  const { data, error } = await supabase
    .from("reels")
    .update({
      status: "ready",
      output_url: outputUrl,
      output_file_size_bytes: fileSizeBytes || null,
      render_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", reelId)
    .select()
    .single();

  if (error) throw error;
  return toReel(data);
}

/**
 * Update assembly step with timestamp instrumentation
 * Used for debugging to identify exactly where stalls occur
 */
export async function updateAssemblyStep(
  reelId: string,
  step: AssemblyStep,
  options?: { completesPrevious?: boolean }
): Promise<void> {
  const now = new Date().toISOString();
  
  const updates: Record<string, unknown> = {
    assembly_step: step,
    step_started_at: now,
    updated_at: now,
  };
  
  // If this step completes the previous one, also record completion time
  if (options?.completesPrevious) {
    updates.step_completed_at = now;
  } else {
    updates.step_completed_at = null;
  }
  
  const { error } = await supabase
    .from("reels")
    .update(updates)
    .eq("id", reelId);

  if (error) {
    console.error("[Reels] Failed to update assembly step:", error);
  } else {
    console.log(`[Reels] Assembly step updated: ${step}`);
  }
}

/**
 * Mark assembly step as completed
 */
export async function completeAssemblyStep(reelId: string): Promise<void> {
  const { error } = await supabase
    .from("reels")
    .update({
      step_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", reelId);

  if (error) {
    console.error("[Reels] Failed to complete assembly step:", error);
  }
}

/**
 * Mark reel render as failed
 */
export async function failReelRender(reelId: string, errorMessage: string): Promise<Reel> {
  const { data, error } = await supabase
    .from("reels")
    .update({
      status: "failed",
      render_error: errorMessage,
      render_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", reelId)
    .select()
    .single();

  if (error) throw error;
  return toReel(data);
}

/**
 * Generate a unique job ID for assembly tracking
 */
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate a unique attempt ID for assembly tracking
 */
function generateAttemptId(): string {
  return crypto.randomUUID();
}

/**
 * Retry reel assembly with clean state reset
 * 
 * This function:
 * 1. Clears any partial preview data
 * 2. Resets all in-progress flags
 * 3. Sets status back to "compiling" with "collecting_clips" step
 * 4. Increments attempt count
 * 5. Generates a new job_id to prevent duplicate concurrent jobs
 * 6. Generates a new assembly_attempt_id to filter stale UI updates
 * 
 * @returns The new job_id and attemptId that should be used to track this assembly attempt
 */
export async function retryAssembly(reelId: string): Promise<{ reel: Reel; jobId: string; attemptId: string }> {
  const now = new Date().toISOString();
  const newJobId = generateJobId();
  const newAttemptId = generateAttemptId();
  
  console.log(`[Reels] Retrying assembly for ${reelId} with job ${newJobId}, attempt ${newAttemptId}`);
  
  // Get current attempt count
  const currentReel = await getReel(reelId);
  const newAttemptCount = (currentReel?.attempt_count || 0) + 1;
  
  const { data, error } = await supabase
    .from("reels")
    .update({
      // Reset status
      status: "compiling",
      // Reset assembly step to beginning
      assembly_step: "collecting_clips",
      step_started_at: now,
      step_completed_at: null,
      // Clear partial preview data
      preview_ref: null,
      preview_url: null,
      playback_mode: "preview", // Reset to default, will be set appropriately during assembly
      // Clear error state
      render_error: null,
      render_started_at: null,
      render_completed_at: null,
      // Increment attempt count and set new job ID + attempt ID
      attempt_count: newAttemptCount,
      job_id: newJobId,
      assembly_attempt_id: newAttemptId,
      updated_at: now,
    })
    .eq("id", reelId)
    .select()
    .single();

  if (error) throw error;
  
  console.log(`[Reels] Assembly retry initiated, attempt #${newAttemptCount}, job ${newJobId}, attemptId ${newAttemptId}`);
  
  return { reel: toReel(data), jobId: newJobId, attemptId: newAttemptId };
}

/**
 * Check if an attempt ID is still the active one for a reel
 * Used to prevent stale UI updates from old attempts
 */
export async function isAttemptActive(reelId: string, attemptId: string): Promise<boolean> {
  const reel = await getReel(reelId);
  return reel?.assembly_attempt_id === attemptId;
}

/**
 * Check if a job ID is still the active one for a reel
 * Used to prevent duplicate/stale jobs from completing
 */
export async function isJobActive(reelId: string, jobId: string): Promise<boolean> {
  const reel = await getReel(reelId);
  return reel?.job_id === jobId;
}

/**
 * Cancel any in-progress assembly by clearing the job_id
 * The assembly process should check isJobActive before completing
 */
export async function cancelAssemblyJob(reelId: string): Promise<void> {
  const { error } = await supabase
    .from("reels")
    .update({
      job_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reelId);

  if (error) {
    console.error("[Reels] Failed to cancel assembly job:", error);
  } else {
    console.log(`[Reels] Cancelled assembly job for ${reelId}`);
  }
}
/**
 * Structured error payload for assembly failures
 * Stored in render_error as JSON for the UI to display actionable info
 */
export interface LastError {
  /** User-friendly error message */
  message: string;
  /** Which assembly step failed */
  step: AssemblyStep | "unknown";
  /** Which segment index was being processed (0-based) */
  segmentIndex?: number;
  /** Which moment ID failed */
  momentId?: string;
  /** When the error occurred */
  timestamp: string;
  /** Stack trace (dev-only, stripped in production) */
  stack?: string;
  /** Machine-readable error code */
  code?: 
    | "clip_validation_failed"
    | "clip_timeout"
    | "manifest_write_failed"
    | "session_not_found"
    | "max_retries_exceeded"
    | "unknown_error";
}

/**
 * Structured error payload for clip validation failures
 * This provides actionable information for the UI
 */
export interface ClipValidationError {
  /** Index of the failing segment (0-based) */
  index: number;
  /** Moment ID that failed */
  momentId: string;
  /** Human-readable moment label (e.g., "Kill", "Death", "Highlight") */
  momentLabel: string;
  /** Timestamp in seconds where the moment occurs */
  timestampSeconds: number;
  /** Machine-readable failure reason */
  reason: 
    | "missing_source_video"
    | "invalid_range"
    | "timeout_resolving_source"
    | "session_not_found"
    | "invalid_moment_id"
    | "invalid_duration"
    | "unknown";
  /** Human-readable description */
  description: string;
}

/**
 * Deterministic assembly result
 */
export interface AssemblyResult {
  success: boolean;
  reel: Reel | null;
  error?: string;
  /** User-friendly error message */
  userMessage?: string;
  previewAvailable: boolean;
  /** Structured error for UI to show specific failing clip */
  clipError?: ClipValidationError;
}

/**
 * Extended moment input with full metadata for validation
 */
export interface MomentSegmentInput {
  momentId: string;
  /** Duration of the clip in milliseconds */
  durationMs: number;
  /** Start time within the source video (ms) */
  startMs?: number;
  /** End time within the source video (ms) */
  endMs?: number;
  /** Human-readable label (e.g., "Kill", "Death", "Highlight") */
  label?: string;
  /** Timestamp in seconds where the moment occurs in the source */
  timestampSeconds?: number;
}

/**
 * Clip validation result with enhanced error info
 */
interface ClipValidationResult {
  valid: boolean;
  clips: ManifestClip[];
  /** Structured error payload for the failing segment */
  clipError?: ClipValidationError;
}

// Timeouts for collecting_clips step
const SEGMENT_VALIDATION_TIMEOUT_MS = 5_000; // 5 seconds per segment
const COLLECTING_CLIPS_GLOBAL_TIMEOUT_MS = 20_000; // 20 seconds total

/**
 * Format seconds as MM:SS for display
 */
export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Parse a clip validation error from the stored render_error JSON
 * Returns null if not a structured clip error
 */
export function parseClipValidationError(renderError: string | null): ClipValidationError | null {
  if (!renderError) return null;
  
  try {
    const parsed = JSON.parse(renderError);
    if (parsed.failingMomentId && parsed.failingMomentLabel !== undefined) {
      return {
        index: parsed.index ?? 0,
        momentId: parsed.failingMomentId,
        momentLabel: parsed.failingMomentLabel,
        timestampSeconds: parsed.failingMomentTimestamp ?? 0,
        reason: parsed.reason || "unknown",
        description: parsed.description || "Unknown error",
      };
    }
  } catch {
    // Not JSON - it's a plain string error message
  }
  
  return null;
}

/**
 * Parse a LastError from the stored render_error JSON
 * Returns null if not a structured LastError
 */
export function parseLastError(renderError: string | null): LastError | null {
  if (!renderError) return null;
  
  try {
    const parsed = JSON.parse(renderError);
    // Check if it's a LastError (has message and timestamp fields)
    if (parsed.message && parsed.timestamp) {
      return {
        message: parsed.message,
        step: parsed.step || "unknown",
        code: parsed.code,
        segmentIndex: parsed.segmentIndex,
        momentId: parsed.momentId,
        timestamp: parsed.timestamp,
        stack: parsed.stack,
      };
    }
  } catch {
    // Not JSON - it's a plain string error message
  }
  
  return null;
}

/**
 * Get a user-friendly error message from render_error
 * Handles both structured LastError and plain string errors
 */
export function getErrorMessage(renderError: string | null): string {
  if (!renderError) return "An unknown error occurred.";
  
  // Try parsing as LastError
  const lastError = parseLastError(renderError);
  if (lastError) {
    return lastError.message;
  }
  
  // Try parsing as ClipValidationError
  const clipError = parseClipValidationError(renderError);
  if (clipError) {
    return `We couldn't access 1 clip: ${clipError.momentLabel} at ${formatTimestamp(clipError.timestampSeconds)}`;
  }
  
  // Plain string
  return renderError;
}

/**
 * Moment type for display - derived from annotation_type
 */
export type MomentType = "Kill" | "Death" | "Highlight" | "Objective" | "Marker" | "Note";

/**
 * Segment status for tracking progress
 */
export type SegmentStatusType = "pending" | "resolving" | "resolved" | "failed" | "skipped";

/**
 * Full segment progress with instrumentation
 */
export interface SegmentProgressInfo {
  segmentIndex: number;
  momentId: string;
  momentType: MomentType;
  label: string;
  momentTimestamp: string;
  timestampSeconds: number;
  intendedRangeMs: { startMs: number; endMs: number };
  sourceRef: string | null;
  status: SegmentStatusType;
  errorReason?: string;
}

/**
 * Map annotation type to display MomentType
 */
export function getDisplayMomentType(annotationType: string | null | undefined): MomentType {
  switch (annotationType) {
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
 * Build initial segment progress array from moment IDs and annotations
 * All segments start as "pending"
 */
export function buildSegmentProgress(
  momentIds: string[],
  annotations: Array<{
    id: string;
    annotation_type?: string | null;
    title?: string | null;
    timestamp_seconds?: number;
    end_timestamp_seconds?: number | null;
  }>,
  sessionId: string | null
): SegmentProgressInfo[] {
  return momentIds.map((momentId, index) => {
    // Find the matching annotation
    const annotation = annotations.find(a => a.id === momentId);
    const momentType = getDisplayMomentType(annotation?.annotation_type);
    const timestampSeconds = annotation?.timestamp_seconds ?? 0;
    const endTimestampSeconds = annotation?.end_timestamp_seconds ?? timestampSeconds + 5; // Default 5s duration
    
    const startMs = Math.round(timestampSeconds * 1000);
    const endMs = Math.round(endTimestampSeconds * 1000);
    
    return {
      segmentIndex: index,
      momentId,
      momentType,
      label: annotation?.title || `${momentType} at ${formatTimestamp(timestampSeconds)}`,
      momentTimestamp: formatTimestamp(timestampSeconds),
      timestampSeconds,
      intendedRangeMs: { startMs, endMs },
      sourceRef: sessionId,
      status: "pending" as SegmentStatusType,
    };
  });
}

/**
 * Validate a single clip segment with timeout and full metadata
 */
async function validateClipSegment(
  moment: MomentSegmentInput,
  index: number,
  sessionId: string | null,
  sessionDurationMs?: number | null
): Promise<{ valid: boolean; clip?: ManifestClip; clipError?: ClipValidationError }> {
  const label = moment.label || "Clip";
  const timestampSeconds = moment.timestampSeconds ?? 0;

  // Helper to create error with full context
  const createError = (
    reason: ClipValidationError["reason"],
    description: string
  ): ClipValidationError => ({
    index,
    momentId: moment.momentId,
    momentLabel: label,
    timestampSeconds,
    reason,
    description,
  });

  // Create a timeout promise
  const timeoutPromise = new Promise<{ valid: false; clipError: ClipValidationError }>((resolve) => {
    setTimeout(() => {
      resolve({
        valid: false,
        clipError: createError(
          "timeout_resolving_source",
          `Timed out accessing ${label} at ${formatTimestamp(timestampSeconds)}`
        ),
      });
    }, SEGMENT_VALIDATION_TIMEOUT_MS);
  });

  // Create the validation promise
  const validationPromise = (async (): Promise<{ valid: boolean; clip?: ManifestClip; clipError?: ClipValidationError }> => {
    try {
      // Validate moment ID exists
      if (!moment.momentId || typeof moment.momentId !== "string") {
        return {
          valid: false,
          clipError: createError("invalid_moment_id", `Invalid clip reference for ${label}`),
        };
      }

      // Validate duration is positive
      if (!moment.durationMs || moment.durationMs <= 0) {
        return {
          valid: false,
          clipError: createError(
            "invalid_duration",
            `Invalid duration for ${label} at ${formatTimestamp(timestampSeconds)}`
          ),
        };
      }

      // Validate duration is reasonable (max 1 hour per clip)
      if (moment.durationMs > 3600_000) {
        return {
          valid: false,
          clipError: createError(
            "invalid_duration",
            `${label} at ${formatTimestamp(timestampSeconds)} is too long (max 1 hour)`
          ),
        };
      }

      // Calculate start/end times
      const startMs = moment.startMs ?? Math.round(timestampSeconds * 1000);
      const endMs = moment.endMs ?? startMs + moment.durationMs;

      // Validate range
      if (startMs >= endMs) {
        return {
          valid: false,
          clipError: createError(
            "invalid_range",
            `Invalid time range for ${label} at ${formatTimestamp(timestampSeconds)}`
          ),
        };
      }

      // Validate range is within source duration (if known)
      if (sessionDurationMs && endMs > sessionDurationMs) {
        return {
          valid: false,
          clipError: createError(
            "invalid_range",
            `${label} at ${formatTimestamp(timestampSeconds)} extends beyond video end`
          ),
        };
      }

      // Check if we can reference the session (if sessionId provided)
      if (sessionId) {
        const { data: session, error } = await supabase
          .from("capture_sessions")
          .select("id, video_url, status, duration_seconds")
          .eq("id", sessionId)
          .maybeSingle();

        if (error) {
          console.warn(`[Reels] Session lookup error for segment ${index}:`, error);
          return {
            valid: false,
            clipError: createError(
              "session_not_found",
              `Cannot access source video for ${label} at ${formatTimestamp(timestampSeconds)}`
            ),
          };
        }

        if (!session) {
          return {
            valid: false,
            clipError: createError(
              "session_not_found",
              `Source session not found for ${label} at ${formatTimestamp(timestampSeconds)}`
            ),
          };
        }

        if (!session.video_url) {
          return {
            valid: false,
            clipError: createError(
              "missing_source_video",
              `No video available for ${label} at ${formatTimestamp(timestampSeconds)}`
            ),
          };
        }

        // Additional range validation against actual session duration
        const actualDurationMs = (session.duration_seconds ?? 0) * 1000;
        if (actualDurationMs > 0 && endMs > actualDurationMs) {
          return {
            valid: false,
            clipError: createError(
              "invalid_range",
              `${label} at ${formatTimestamp(timestampSeconds)} extends beyond video end`
            ),
          };
        }
      }

      // Validation passed - create clip with full timing info
      const clip: ManifestClip = {
        momentId: moment.momentId,
        startMs,
        endMs,
        durationMs: endMs - startMs,
        order: index,
      };

      return { valid: true, clip };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown validation error";
      console.error(`[Reels] Unexpected validation error for segment ${index}:`, message);
      return {
        valid: false,
        clipError: createError(
          "unknown",
          `Failed to validate ${label} at ${formatTimestamp(timestampSeconds)}`
        ),
      };
    }
  })();

  // Race validation against timeout
  return Promise.race([validationPromise, timeoutPromise]);
}

/**
 * Validate all clip segments with global timeout
 */
async function validateAllClips(
  moments: MomentSegmentInput[],
  sessionId: string | null,
  sessionDurationMs?: number | null
): Promise<ClipValidationResult> {
  console.log(`[Reels] Validating ${moments.length} clip segments...`);

  // Create global timeout
  const globalTimeoutPromise = new Promise<ClipValidationResult>((resolve) => {
    setTimeout(() => {
      // On global timeout, we don't know which specific clip, but report the last one in progress
      const lastIndex = Math.max(0, moments.length - 1);
      const lastMoment = moments[lastIndex];
      resolve({
        valid: false,
        clips: [],
        clipError: {
          index: lastIndex,
          momentId: lastMoment?.momentId || "unknown",
          momentLabel: lastMoment?.label || "Clip",
          timestampSeconds: lastMoment?.timestampSeconds ?? 0,
          reason: "timeout_resolving_source",
          description: `Clip collection timed out after ${COLLECTING_CLIPS_GLOBAL_TIMEOUT_MS / 1000}s`,
        },
      });
    }, COLLECTING_CLIPS_GLOBAL_TIMEOUT_MS);
  });

  // Create validation promise
  const validationPromise = (async (): Promise<ClipValidationResult> => {
    const clips: ManifestClip[] = [];

    for (let i = 0; i < moments.length; i++) {
      const moment = moments[i];
      const result = await validateClipSegment(moment, i, sessionId, sessionDurationMs);

      if (!result.valid) {
        console.error(`[Reels] Segment ${i} validation failed:`, result.clipError?.reason);
        return {
          valid: false,
          clips,
          clipError: result.clipError,
        };
      }

      if (result.clip) {
        clips.push(result.clip);
      }
    }

    console.log(`[Reels] All ${clips.length} segments validated successfully`);
    return { valid: true, clips };
  })();

  // Race validation against global timeout
  return Promise.race([validationPromise, globalTimeoutPromise]);
}

/**
 * Execute deterministic reel assembly (MANIFEST-FIRST)
 * 
 * CRITICAL: Assembly success = valid manifest written
 * Preview is started as a SEPARATE background job and doesn't block ready state.
 * 
 * Flow:
 * 1. collecting_clips: Resolve + validate clip segment references (with timeouts)
 * 2. finalizing_manifest: Write manifest + totalDurationMs
 * 3. ready: Mark reel as ready (editor becomes usable!)
 * 4. (Background) Start preview generation as optional enhancement
 */
export async function executeAssembly(
  reelId: string,
  moments: MomentSegmentInput[]
): Promise<AssemblyResult> {
  const now = () => new Date().toISOString();

  try {
    console.log(`[Reels] Starting manifest-first assembly for ${reelId} with ${moments.length} moments`);

    // Validate inputs early - minimum 2 clips required for a valid reel
    const MIN_CLIPS_REQUIRED = 2;
    
    if (!moments || moments.length === 0) {
      throw new AssemblyError(
        "No clips provided for assembly",
        "Please select at least 2 clips for your reel."
      );
    }
    
    if (moments.length < MIN_CLIPS_REQUIRED) {
      throw new AssemblyError(
        `Not enough clips: ${moments.length} provided, ${MIN_CLIPS_REQUIRED} required`,
        `Not enough usable clips. Need at least ${MIN_CLIPS_REQUIRED} clips to make a reel.`
      );
    }

    // STEP 1: Collecting clips with validation + timeouts
    await updateAssemblyStep(reelId, "collecting_clips");

    // Get current reel for session reference
    const currentReel = await getReel(reelId);
    if (!currentReel) {
      throw new AssemblyError(
        "Reel not found during assembly",
        "The reel could not be found. Please try creating a new one."
      );
    }

    // Validate all clip segments with timeouts (pass session duration for range checks)
    const validationResult = await validateAllClips(moments, currentReel.session_id);

    if (!validationResult.valid) {
      const clipError = validationResult.clipError;

      // Determine if this is a timeout (needs_attention) or hard failure
      const isTimeout = clipError?.reason === "timeout_resolving_source";

      // Build structured error payload for storage
      const errorPayload = clipError
        ? JSON.stringify({
            failingMomentId: clipError.momentId,
            failingMomentLabel: clipError.momentLabel,
            failingMomentTimestamp: clipError.timestampSeconds,
            reason: clipError.reason,
            description: clipError.description,
          })
        : null;

      // User-friendly message mentioning the specific clip
      const userMessage = clipError
        ? `We couldn't access 1 clip: ${clipError.momentLabel} at ${formatTimestamp(clipError.timestampSeconds)}`
        : "We couldn't access one of the clips needed for this reel.";

      if (isTimeout) {
        // Timeout - recoverable; do NOT remain in compiling indefinitely.
        console.warn(`[Reels] Clip collection timed out for ${reelId}:`, clipError?.description);

        await supabase
          .from("reels")
          .update({
            status: "needs_attention",
            // Keep the step so the UI can show exactly where it stalled.
            assembly_step: "collecting_clips",
            render_error: errorPayload || userMessage,
            updated_at: now(),
          })
          .eq("id", reelId);

        return {
          success: false,
          reel: await getReel(reelId),
          error: clipError?.description || "Clip collection timed out",
          userMessage,
          previewAvailable: false,
          clipError,
        };
      }

      // Hard failure - segment validation failed; mark as needs_attention so user can skip/retry
      console.warn(`[Reels] Clip validation failed for ${reelId}:`, clipError?.description);

      await supabase
        .from("reels")
        .update({
          status: "needs_attention",
          assembly_step: "collecting_clips",
          render_error: errorPayload || userMessage,
          updated_at: now(),
        })
        .eq("id", reelId);

      return {
        success: false,
        reel: await getReel(reelId),
        error: clipError?.description || "Clip validation failed",
        userMessage,
        previewAvailable: false,
        clipError,
      };
    }
    
    const clips = validationResult.clips;
    
    const totalDurationMs = clips.reduce((sum, c) => sum + c.durationMs, 0);
    
    await completeAssemblyStep(reelId);
    
    // STEP 2: Finalizing manifest (SUCCESS CRITERIA)
    await updateAssemblyStep(reelId, "finalizing_manifest", { completesPrevious: true });
    
    const manifest: ReelManifest = {
      clips,
      totalDurationMs,
      aspectRatio: currentReel.aspect_ratio,
      createdAt: now(),
    };
    
    // Save manifest - this is the critical success moment
    await supabase
      .from("reels")
      .update({
        manifest: JSON.parse(JSON.stringify(manifest)),
        total_duration_ms: totalDurationMs,
        duration_seconds: Math.round(totalDurationMs / 1000),
        playback_mode: "manifest", // Start with manifest mode until preview ready
        preview_status: "pending", // Preview not yet generated
        updated_at: now(),
      })
      .eq("id", reelId);
    
    // Validate manifest was saved
    const manifestReel = await getReel(reelId);
    if (!manifestReel?.manifest) {
      throw new Error("Manifest is required but failed to save");
    }
    if (!manifestReel.total_duration_ms || manifestReel.total_duration_ms <= 0) {
      throw new Error("Total duration is required but invalid");
    }
    
    await completeAssemblyStep(reelId);
    
    // TERMINAL STATE: Ready (manifest complete - editor is now usable!)
    await updateAssemblyStep(reelId, "ready", { completesPrevious: true });
    
    const { data: readyReel, error: readyError } = await supabase
      .from("reels")
      .update({
        status: "draft", // draft = ready for editing
        assembly_step: "ready",
        render_error: null,
        updated_at: now(),
      })
      .eq("id", reelId)
      .select()
      .single();
    
    if (readyError) throw readyError;
    
    console.log(`[Reels] Assembly complete for ${reelId} - reel is READY (manifest mode)`);
    
    // Start preview generation as background job (non-blocking)
    startPreviewGeneration(reelId, currentReel.session_id).catch((err) => {
      console.warn(`[Reels] Background preview generation failed:`, err);
    });
    
    return {
      success: true,
      reel: toReel(readyReel),
      previewAvailable: false, // Preview will be generated in background
    };
    
  } catch (error) {
    // TERMINAL STATE: Failed
    console.error(`[Reels] Assembly failed for ${reelId}:`, error);
    
    // Extract error messages
    const devMessage = error instanceof Error ? error.message : "Assembly failed unexpectedly";
    const userMessage = error instanceof AssemblyError 
      ? error.userMessage 
      : "Something went wrong while creating your reel.";
    
    try {
      await updateAssemblyStep(reelId, "failed");
      
      // Store user-friendly message in render_error for UI display
      const { data: failedReel } = await supabase
        .from("reels")
        .update({
          status: "failed",
          assembly_step: "failed",
          render_error: userMessage,
          updated_at: now(),
        })
        .eq("id", reelId)
        .select()
        .single();
      
      return {
        success: false,
        reel: failedReel ? toReel(failedReel) : null,
        error: devMessage,
        userMessage,
        previewAvailable: false,
      };
    } catch (updateError) {
      console.error(`[Reels] Failed to update failure state:`, updateError);
      return {
        success: false,
        reel: null,
        error: devMessage,
        userMessage,
        previewAvailable: false,
      };
    }
  }
}

/**
 * Start preview generation as a background job
 * This runs AFTER the reel is marked ready and doesn't block editing
 */
async function startPreviewGeneration(reelId: string, sessionId: string | null): Promise<void> {
  const now = () => new Date().toISOString();
  
  console.log(`[Reels] Starting background preview generation for ${reelId}`);
  
  // Mark preview as rendering
  await supabase
    .from("reels")
    .update({
      preview_status: "rendering",
      updated_at: now(),
    })
    .eq("id", reelId);
  
  try {
    // For MVP: Use session video as preview
    if (sessionId) {
      const { data: session } = await supabase
        .from("capture_sessions")
        .select("video_url")
        .eq("id", sessionId)
        .maybeSingle();
      
      if (session?.video_url) {
        await supabase
          .from("reels")
          .update({
            preview_ref: session.video_url,
            preview_url: session.video_url,
            playback_mode: "preview",
            preview_status: "ready",
            updated_at: now(),
          })
          .eq("id", reelId);
        
        console.log(`[Reels] Preview ready for ${reelId}`);
        return;
      }
    }
    
    // No session video available - mark as failed but don't error
    await supabase
      .from("reels")
      .update({
        preview_status: "failed",
        updated_at: now(),
      })
      .eq("id", reelId);
    
    console.log(`[Reels] Preview generation skipped for ${reelId} - no session video`);
    
  } catch (error) {
    console.warn(`[Reels] Preview generation failed for ${reelId}:`, error);
    
    await supabase
      .from("reels")
      .update({
        preview_status: "failed",
        updated_at: now(),
      })
      .eq("id", reelId);
  }
}

/**
 * Manually retry preview generation for a reel
 */
export async function retryPreviewGeneration(reelId: string): Promise<boolean> {
  const reel = await getReel(reelId);
  if (!reel) return false;
  
  try {
    await startPreviewGeneration(reelId, reel.session_id);
    return true;
  } catch (error) {
    console.error(`[Reels] Preview retry failed:`, error);
    return false;
  }
}
