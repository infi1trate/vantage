/**
 * Asset Readiness Gate
 * 
 * Checks if a session's source video is ready for reel assembly.
 * Implements bounded polling with exponential backoff.
 */

import { supabase } from "@/integrations/supabase/client";

// Configuration
const POLL_INITIAL_DELAY_MS = 1_000; // Start with 1 second
const POLL_MAX_DELAY_MS = 5_000; // Max 5 seconds between polls
const POLL_TIMEOUT_MS = 30_000; // Max 30 seconds total wait
const BACKOFF_MULTIPLIER = 1.5;

export type AssetReadinessStatus = 
  | "ready"           // Video URL exists and is accessible
  | "processing"      // Still being processed
  | "not_found"       // Session doesn't exist
  | "no_video"        // Session exists but no video URL
  | "timeout"         // Polling timed out
  | "error";          // Unknown error

export interface AssetReadinessResult {
  status: AssetReadinessStatus;
  videoUrl: string | null;
  durationSeconds: number | null;
  message: string;
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
      };
    }

    if (!session) {
      return {
        status: "not_found",
        videoUrl: null,
        durationSeconds: null,
        message: "Session not found",
      };
    }

    // Check if video URL exists
    if (!session.video_url) {
      // Check session status to determine if it's still processing
      const isProcessing = session.status === "processing" || session.status === "uploading";
      
      return {
        status: isProcessing ? "processing" : "no_video",
        videoUrl: null,
        durationSeconds: session.duration_seconds,
        message: isProcessing 
          ? "Video is still being processed"
          : "No video available for this session",
      };
    }

    // Video URL exists - asset is ready
    return {
      status: "ready",
      videoUrl: session.video_url,
      durationSeconds: session.duration_seconds,
      message: "Video is ready",
    };
  } catch (error) {
    console.error("[AssetReadiness] Unexpected error:", error);
    return {
      status: "error",
      videoUrl: null,
      durationSeconds: null,
      message: error instanceof Error ? error.message : "Unknown error",
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
      result.status === "not_found" ||
      result.status === "error"
    ) {
      console.log(`[AssetReadiness] Final status: ${result.status} after ${attempt} attempts`);
      return result;
    }

    // If no_video but not processing, it's a permanent state
    if (result.status === "no_video") {
      console.log(`[AssetReadiness] No video for session ${sessionId} - not in processing`);
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
    case "not_found":
      return "Session not found";
    case "no_video":
      return "No video available for this session";
    case "timeout":
      return "Session processing is taking longer than expected";
    case "error":
      return "Failed to check video status";
    default:
      return "Unknown status";
  }
}
