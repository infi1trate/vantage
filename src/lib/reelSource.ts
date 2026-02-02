/**
 * ReelSource Entity
 * 
 * A versioned compatibility layer between sessions and the reel pipeline.
 * 
 * PURPOSE:
 * - Older sessions may have playable videos but lack metadata required by reel assembly
 * - ReelSource abstracts the video source with version-aware guarantees
 * - Reel pipeline depends on ReelSource, not raw session video_url
 * 
 * VERSIONS:
 * - v1: Legacy sessions (pre-ReelSource) - basic video, limited metadata
 * - v2: New recordings with full metadata (created automatically on recording stop)
 * 
 * LIFECYCLE:
 * - New recordings: ReelSource created as "preparing" → "ready" when video finalizes
 * - Legacy sessions: ReelSource starts as "missing", can be upgraded via migration
 * - Playback can work without ReelSource; only reel assembly requires it
 */

import { supabase } from "@/integrations/supabase/client";

// ==================== Types ====================

/** ReelSource versions for feature detection */
export type ReelSourceVersion = "v1" | "v2";

/** 
 * ReelSource status lifecycle
 * 
 * - missing: No ReelSource exists (legacy session or failed capture)
 * - preparing: ReelSource created, waiting for video finalization
 * - ready: Video available with all required metadata
 * - failed: Processing attempted but failed (can retry)
 */
export type ReelSourceStatus = "missing" | "preparing" | "ready" | "failed";

/**
 * ReelSource entity - stored in session metadata as `reelSource`
 */
export interface ReelSource {
  /** Current status of the source video */
  status: ReelSourceStatus;
  /** Version for feature detection */
  version: ReelSourceVersion;
  /** Reference to the video_assets row (if exists) */
  sourceVideoAssetId: string | null;
  /** Duration in milliseconds (required for timeline calculations) */
  durationMs: number | null;
  /** Timebase reference - currently always "videoTime" */
  timebase: "videoTime";
  /** Whether the video supports seeking (required for clip extraction) */
  seekable: boolean;
  /** Error message if status is "failed" */
  lastError?: string;
  /** When the ReelSource was created */
  createdAt: string;
  /** When the ReelSource was last updated */
  updatedAt: string;
}

/**
 * Result of ReelSource readiness check
 */
export interface ReelSourceReadinessResult {
  /** Whether the ReelSource is ready for reel assembly */
  isReady: boolean;
  /** The ReelSource data (if available) */
  reelSource: ReelSource | null;
  /** User-friendly message describing the status */
  message: string;
  /** Whether waiting might resolve this issue */
  isRecoverable: boolean;
  /** Whether this is a legacy session without ReelSource */
  isLegacy: boolean;
  /** The session's video_url (for fallback playback) */
  videoUrl: string | null;
}

// ==================== Constants ====================

/** Current version for new ReelSources */
export const CURRENT_REEL_SOURCE_VERSION: ReelSourceVersion = "v2";

/** Default timebase for all ReelSources */
const DEFAULT_TIMEBASE = "videoTime" as const;

// ==================== Factory Functions ====================

/**
 * Create a new ReelSource in "preparing" status
 * Called immediately when recording stops
 */
export function createPreparingReelSource(
  videoAssetId: string | null,
  durationMs: number | null
): ReelSource {
  const now = new Date().toISOString();
  return {
    status: "preparing",
    version: CURRENT_REEL_SOURCE_VERSION,
    sourceVideoAssetId: videoAssetId,
    durationMs,
    timebase: DEFAULT_TIMEBASE,
    seekable: false, // Set to true when video is confirmed seekable
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a "ready" ReelSource
 * Called when video processing completes successfully
 */
export function createReadyReelSource(
  videoAssetId: string,
  durationMs: number
): ReelSource {
  const now = new Date().toISOString();
  return {
    status: "ready",
    version: CURRENT_REEL_SOURCE_VERSION,
    sourceVideoAssetId: videoAssetId,
    durationMs,
    timebase: DEFAULT_TIMEBASE,
    seekable: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a "failed" ReelSource
 * Called when video processing fails
 */
export function createFailedReelSource(
  videoAssetId: string | null,
  durationMs: number | null,
  errorMessage: string
): ReelSource {
  const now = new Date().toISOString();
  return {
    status: "failed",
    version: CURRENT_REEL_SOURCE_VERSION,
    sourceVideoAssetId: videoAssetId,
    durationMs,
    timebase: DEFAULT_TIMEBASE,
    seekable: false,
    lastError: errorMessage,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a "missing" ReelSource placeholder
 * Used for legacy sessions or when no recording exists
 */
export function createMissingReelSource(): ReelSource {
  const now = new Date().toISOString();
  return {
    status: "missing",
    version: "v1", // Legacy version
    sourceVideoAssetId: null,
    durationMs: null,
    timebase: DEFAULT_TIMEBASE,
    seekable: false,
    createdAt: now,
    updatedAt: now,
  };
}

// ==================== Session Metadata Helpers ====================

/**
 * Extract ReelSource from session metadata
 * Returns null if no ReelSource exists (legacy session)
 */
export function getReelSourceFromMetadata(
  metadata: Record<string, unknown> | null
): ReelSource | null {
  if (!metadata || typeof metadata !== "object") return null;
  
  const reelSource = metadata.reelSource as ReelSource | undefined;
  if (!reelSource || typeof reelSource !== "object") return null;
  
  // Validate required fields
  if (!reelSource.status || !reelSource.version) return null;
  
  return reelSource;
}

/**
 * Create updated metadata with ReelSource
 */
export function setReelSourceInMetadata(
  existingMetadata: Record<string, unknown> | null,
  reelSource: ReelSource
): Record<string, unknown> {
  return {
    ...(existingMetadata || {}),
    reelSource: {
      ...reelSource,
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Update ReelSource status in metadata
 */
export function updateReelSourceStatus(
  existingMetadata: Record<string, unknown> | null,
  status: ReelSourceStatus,
  updates?: Partial<ReelSource>
): Record<string, unknown> {
  const currentReelSource = getReelSourceFromMetadata(existingMetadata);
  
  if (!currentReelSource) {
    // Create new ReelSource if none exists
    const newReelSource = createMissingReelSource();
    newReelSource.status = status;
    Object.assign(newReelSource, updates);
    return setReelSourceInMetadata(existingMetadata, newReelSource);
  }
  
  return setReelSourceInMetadata(existingMetadata, {
    ...currentReelSource,
    status,
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

// ==================== Database Operations ====================

/**
 * Save ReelSource to session metadata
 */
export async function saveReelSource(
  sessionId: string,
  reelSource: ReelSource
): Promise<void> {
  // Get current session metadata
  const { data: session, error: fetchError } = await supabase
    .from("capture_sessions")
    .select("metadata")
    .eq("id", sessionId)
    .single();
  
  if (fetchError) {
    console.error("[ReelSource] Failed to fetch session:", fetchError);
    throw fetchError;
  }
  
  const existingMetadata = (session?.metadata as Record<string, unknown>) || {};
  const updatedMetadata = setReelSourceInMetadata(existingMetadata, reelSource);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await supabase
    .from("capture_sessions")
    .update({
      metadata: updatedMetadata as any,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
  
  if (updateError) {
    console.error("[ReelSource] Failed to save:", updateError);
    throw updateError;
  }
  
  console.log(`[ReelSource] Saved for session ${sessionId}: status=${reelSource.status}`);
}

/**
 * Get ReelSource for a session
 * Returns null for legacy sessions without ReelSource
 */
export async function getReelSource(
  sessionId: string
): Promise<ReelSource | null> {
  const { data: session, error } = await supabase
    .from("capture_sessions")
    .select("metadata")
    .eq("id", sessionId)
    .single();
  
  if (error) {
    console.error("[ReelSource] Failed to get session:", error);
    return null;
  }
  
  return getReelSourceFromMetadata(session?.metadata as Record<string, unknown>);
}

/**
 * Update ReelSource status for a session
 */
export async function updateSessionReelSourceStatus(
  sessionId: string,
  status: ReelSourceStatus,
  updates?: Partial<ReelSource>
): Promise<void> {
  const { data: session, error: fetchError } = await supabase
    .from("capture_sessions")
    .select("metadata")
    .eq("id", sessionId)
    .single();
  
  if (fetchError) {
    console.error("[ReelSource] Failed to fetch session:", fetchError);
    throw fetchError;
  }
  
  const existingMetadata = (session?.metadata as Record<string, unknown>) || {};
  const updatedMetadata = updateReelSourceStatus(existingMetadata, status, updates);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await supabase
    .from("capture_sessions")
    .update({
      metadata: updatedMetadata as any,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
  
  if (updateError) {
    console.error("[ReelSource] Failed to update status:", updateError);
    throw updateError;
  }
  
  console.log(`[ReelSource] Updated session ${sessionId} to status=${status}`);
}

// ==================== Readiness Check ====================

/**
 * Check if a session's ReelSource is ready for reel assembly
 * 
 * This is the primary check used by the reel pipeline.
 * Falls back to legacy video_url check for sessions without ReelSource.
 */
export async function checkReelSourceReadiness(
  sessionId: string
): Promise<ReelSourceReadinessResult> {
  try {
    const { data: session, error } = await supabase
      .from("capture_sessions")
      .select("id, metadata, video_url, duration_seconds, status")
      .eq("id", sessionId)
      .single();
    
    if (error || !session) {
      return {
        isReady: false,
        reelSource: null,
        message: "Session not found",
        isRecoverable: false,
        isLegacy: false,
        videoUrl: null,
      };
    }
    
    const reelSource = getReelSourceFromMetadata(
      session.metadata as Record<string, unknown>
    );
    
    // === NEW SESSION (has ReelSource) ===
    if (reelSource) {
      switch (reelSource.status) {
        case "ready":
          return {
            isReady: true,
            reelSource,
            message: "Source video ready",
            isRecoverable: false,
            isLegacy: false,
            videoUrl: session.video_url,
          };
        
        case "preparing":
          return {
            isReady: false,
            reelSource,
            message: "Source video is still processing",
            isRecoverable: true,
            isLegacy: false,
            videoUrl: session.video_url,
          };
        
        case "failed":
          return {
            isReady: false,
            reelSource,
            message: reelSource.lastError || "Source video processing failed",
            isRecoverable: true, // Can retry
            isLegacy: false,
            videoUrl: session.video_url,
          };
        
        case "missing":
          return {
            isReady: false,
            reelSource,
            message: "No source video available",
            isRecoverable: false,
            isLegacy: false,
            videoUrl: session.video_url,
          };
      }
    }
    
    // === LEGACY SESSION (no ReelSource) ===
    // Fall back to raw video_url check for backwards compatibility
    // Playback can still work, but reels have limited functionality
    
    if (session.video_url) {
      // Legacy session with video - can be used for basic reels
      return {
        isReady: true,
        reelSource: null,
        message: "Legacy session with video",
        isRecoverable: false,
        isLegacy: true,
        videoUrl: session.video_url,
      };
    }
    
    // Legacy session still processing
    if (session.status === "processing") {
      return {
        isReady: false,
        reelSource: null,
        message: "Session video still processing",
        isRecoverable: true,
        isLegacy: true,
        videoUrl: null,
      };
    }
    
    // Legacy session with no video
    return {
      isReady: false,
      reelSource: null,
      message: "No video available for this session",
      isRecoverable: false,
      isLegacy: true,
      videoUrl: null,
    };
  } catch (err) {
    console.error("[ReelSource] Readiness check error:", err);
    return {
      isReady: false,
      reelSource: null,
      message: err instanceof Error ? err.message : "Unknown error",
      isRecoverable: false,
      isLegacy: false,
      videoUrl: null,
    };
  }
}

/**
 * Get user-friendly message for ReelSource status
 */
export function getReelSourceStatusMessage(
  reelSource: ReelSource | null,
  isLegacy: boolean
): string {
  if (isLegacy) {
    return "Legacy session (limited reel features)";
  }
  
  if (!reelSource) {
    return "No source information available";
  }
  
  switch (reelSource.status) {
    case "ready":
      return "Source video ready";
    case "preparing":
      return "Source video is still processing…";
    case "failed":
      return `Processing failed: ${reelSource.lastError || "Unknown error"}`;
    case "missing":
      return "No source video available";
  }
}

/**
 * Check if ReelSource version supports a feature
 */
export function supportsFeature(
  reelSource: ReelSource | null,
  feature: "seeking" | "effects" | "transitions"
): boolean {
  if (!reelSource) return false;
  
  // v1 (legacy) has limited feature support
  if (reelSource.version === "v1") {
    return feature === "seeking" && reelSource.seekable;
  }
  
  // v2 supports all features when ready
  if (reelSource.version === "v2" && reelSource.status === "ready") {
    return true;
  }
  
  return false;
}
