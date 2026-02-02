/**
 * Asset Readiness Gate
 * 
 * Checks if a session's source video is ready for reel assembly.
 * Implements bounded polling with exponential backoff.
 * 
 * Distinguishes between:
 * - videoPending: processing or sync in progress (recoverable with wait)
 * - videoMissingPermanent: recording never exists / failed capture (not recoverable)
 */

import { supabase } from "@/integrations/supabase/client";

// Configuration
const POLL_INITIAL_DELAY_MS = 1_000; // Start with 1 second
const POLL_MAX_DELAY_MS = 5_000; // Max 5 seconds between polls
const POLL_TIMEOUT_MS = 30_000; // Max 30 seconds total wait
const BACKOFF_MULTIPLIER = 1.5;

// Extended poll for background waiting (when user leaves and wants notification)
const BACKGROUND_POLL_INTERVAL_MS = 10_000; // 10 seconds between checks
const BACKGROUND_POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes max wait

export type AssetReadinessStatus = 
  | "ready"           // Video URL exists and is accessible
  | "processing"      // Still being processed (recoverable)
  | "uploading"       // Still being uploaded (recoverable)
  | "not_found"       // Session doesn't exist (permanent)
  | "no_video"        // Session exists but no video URL (permanent)
  | "failed"          // Processing failed (permanent)
  | "timeout"         // Polling timed out
  | "error";          // Unknown error

/**
 * Whether the status is potentially recoverable with waiting
 */
export function isRecoverableStatus(status: AssetReadinessStatus): boolean {
  return status === "processing" || status === "uploading";
}

/**
 * Whether the status is permanently unrecoverable
 */
export function isPermanentFailure(status: AssetReadinessStatus): boolean {
  return status === "not_found" || status === "no_video" || status === "failed";
}

export interface AssetReadinessResult {
  status: AssetReadinessStatus;
  videoUrl: string | null;
  durationSeconds: number | null;
  message: string;
  /** Whether waiting might resolve this issue */
  isRecoverable: boolean;
}

/**
 * Check if a session's video asset is ready for use
 * 
 * @param sessionId - The session to check
 * @returns Asset readiness result with status and video URL if ready
 */
export async function checkAssetReadiness(
  sessionId: string
): Promise<AssetReadinessResult> {
  try {
    const { data: session, error } = await supabase
      .from("capture_sessions")
      .select("id, video_url, duration_seconds, status")
      .eq("id", sessionId)
      .maybeSingle();

    if (error) {
      console.error("[AssetReadiness] Query error:", error);
      return {
        status: "error",
        videoUrl: null,
        durationSeconds: null,
        message: "Failed to check session status",
        isRecoverable: false,
      };
    }

    if (!session) {
      return {
        status: "not_found",
        videoUrl: null,
        durationSeconds: null,
        message: "Session not found",
        isRecoverable: false,
      };
    }

    // Check if video URL exists
    if (!session.video_url) {
      // Check session status to determine if it's still processing
      const isProcessing = session.status === "processing";
      const isUploading = session.status === "uploading";
      const isFailed = session.status === "failed";
      
      if (isProcessing) {
        return {
          status: "processing",
          videoUrl: null,
          durationSeconds: session.duration_seconds,
          message: "Video is still being processed",
          isRecoverable: true,
        };
      }
      
      if (isUploading) {
        return {
          status: "uploading",
          videoUrl: null,
          durationSeconds: session.duration_seconds,
          message: "Video is still being uploaded",
          isRecoverable: true,
        };
      }
      
      if (isFailed) {
        return {
          status: "failed",
          videoUrl: null,
          durationSeconds: session.duration_seconds,
          message: "Session processing failed",
          isRecoverable: false,
        };
      }
      
      // Status is "ready" or something else but no video URL - permanent failure
      return {
        status: "no_video",
        videoUrl: null,
        durationSeconds: session.duration_seconds,
        message: "No video available for this session",
        isRecoverable: false,
      };
    }

    // Video URL exists - asset is ready
    return {
      status: "ready",
      videoUrl: session.video_url,
      durationSeconds: session.duration_seconds,
      message: "Video is ready",
      isRecoverable: false, // N/A for ready status
    };
  } catch (error) {
    console.error("[AssetReadiness] Unexpected error:", error);
    return {
      status: "error",
      videoUrl: null,
      durationSeconds: null,
      message: error instanceof Error ? error.message : "Unknown error",
      isRecoverable: false,
    };
  }
}

/**
 * Poll for asset readiness with exponential backoff
 * 
 * @param sessionId - The session to check
 * @param onProgress - Optional callback for progress updates
 * @returns Final readiness result after polling completes or times out
 */
export async function waitForAssetReadiness(
  sessionId: string,
  onProgress?: (progress: {
    elapsedMs: number;
    maxMs: number;
    attempt: number;
    lastStatus: AssetReadinessStatus;
  }) => void
): Promise<AssetReadinessResult> {
  const startTime = Date.now();
  let delay = POLL_INITIAL_DELAY_MS;
  let attempt = 0;

  while (true) {
    attempt++;
    const elapsedMs = Date.now() - startTime;

    // Check for timeout
    if (elapsedMs >= POLL_TIMEOUT_MS) {
      console.log(`[AssetReadiness] Polling timed out after ${elapsedMs}ms (${attempt} attempts)`);
      return {
        status: "timeout",
        videoUrl: null,
        durationSeconds: null,
        message: "Timed out waiting for video to be ready",
        isRecoverable: true, // User can try again later
      };
    }

    // Check readiness
    const result = await checkAssetReadiness(sessionId);

    // Report progress
    onProgress?.({
      elapsedMs,
      maxMs: POLL_TIMEOUT_MS,
      attempt,
      lastStatus: result.status,
    });

    // If ready or permanent failure, return immediately
    if (
      result.status === "ready" ||
      isPermanentFailure(result.status) ||
      result.status === "error"
    ) {
      console.log(`[AssetReadiness] Final status: ${result.status} after ${attempt} attempts`);
      return result;
    }

    // Still processing - wait with backoff
    console.log(`[AssetReadiness] Status: ${result.status}, waiting ${delay}ms before retry`);
    await sleep(delay);

    // Increase delay with backoff
    delay = Math.min(delay * BACKOFF_MULTIPLIER, POLL_MAX_DELAY_MS);
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get user-friendly message for asset readiness status
 */
export function getAssetStatusMessage(status: AssetReadinessStatus): string {
  switch (status) {
    case "ready":
      return "Video is ready";
    case "processing":
      return "Finishing session processing… Reel will assemble when ready.";
    case "uploading":
      return "Video is still uploading…";
    case "not_found":
      return "Session not found";
    case "no_video":
      return "This session has no gameplay video.";
    case "failed":
      return "Session processing failed.";
    case "timeout":
      return "Session processing is taking longer than expected";
    case "error":
      return "Failed to check video status";
    default:
      return "Unknown status";
  }
}

/**
 * Background asset watcher for "Leave and notify me" flow
 * 
 * Keeps polling in the background (longer timeout) and calls onReady when video becomes available.
 * Returns a cancel function.
 */
export function watchForAssetReadiness(
  sessionId: string,
  callbacks: {
    onReady: (result: AssetReadinessResult) => void;
    onPermanentFailure: (result: AssetReadinessResult) => void;
    onProgress?: (elapsedMs: number, status: AssetReadinessStatus) => void;
  }
): () => void {
  let cancelled = false;
  const startTime = Date.now();
  
  const poll = async () => {
    if (cancelled) return;
    
    const elapsedMs = Date.now() - startTime;
    
    // Check for timeout
    if (elapsedMs >= BACKGROUND_POLL_TIMEOUT_MS) {
      console.log(`[AssetReadiness] Background watch timed out after ${elapsedMs}ms`);
      callbacks.onPermanentFailure({
        status: "timeout",
        videoUrl: null,
        durationSeconds: null,
        message: "Session processing took too long",
        isRecoverable: false,
      });
      return;
    }
    
    try {
      const result = await checkAssetReadiness(sessionId);
      
      callbacks.onProgress?.(elapsedMs, result.status);
      
      if (result.status === "ready") {
        console.log("[AssetReadiness] Background watch: video ready!");
        callbacks.onReady(result);
        return;
      }
      
      if (isPermanentFailure(result.status)) {
        console.log("[AssetReadiness] Background watch: permanent failure:", result.status);
        callbacks.onPermanentFailure(result);
        return;
      }
      
      // Continue polling
      if (!cancelled) {
        setTimeout(poll, BACKGROUND_POLL_INTERVAL_MS);
      }
    } catch (error) {
      console.error("[AssetReadiness] Background watch error:", error);
      // Continue polling despite errors
      if (!cancelled) {
        setTimeout(poll, BACKGROUND_POLL_INTERVAL_MS);
      }
    }
  };
  
  // Start polling
  poll();
  
  // Return cancel function
  return () => {
    cancelled = true;
  };
}
