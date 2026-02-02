/**
 * Centralized Reel Creation Eligibility
 * 
 * SINGLE SOURCE OF TRUTH for determining if a session can have reels created.
 * 
 * This function MUST be the ONLY gate used by:
 * - Create Reel button enable/disable state
 * - Create Reel API/action handler
 * - Any toast error messaging
 * 
 * Design goals:
 * - Performance-safe: No heavy work, no network calls
 * - Sync-first: Uses pre-fetched session data
 * - Consistent: UI and action handler always agree
 */

import type { ReelSource, ReelSourceStatus } from "./reelSource";

// ==================== Types ====================

/**
 * Reason codes for ineligibility
 */
export type ReelIneligibilityReason = 
  | "video_missing"      // No recording ever captured
  | "video_processing"   // Recording still being processed
  | "video_failed"       // Processing failed
  | "video_uploading"    // Still uploading
  | "unknown";           // Unknown state

/**
 * Result of eligibility check
 */
export interface ReelEligibilityResult {
  /** Whether reel creation is allowed */
  ok: boolean;
  /** Reason code if not eligible */
  reasonCode?: ReelIneligibilityReason;
  /** Additional details for debugging */
  details?: {
    hasScreenVideo: boolean;
    screenVideoStatus: string | null;
    reelSourceStatus: ReelSourceStatus | null;
    hasVideoUrl: boolean;
    isLegacy: boolean;
  };
}

/**
 * Session data needed for eligibility check
 * This is the minimal shape required - callers can pass more
 */
export interface SessionEligibilityInput {
  /** Screen video information from Session Media */
  screenVideo?: {
    present: boolean;
    status: "ready" | "processing" | "uploading" | "failed" | "missing" | null;
    url?: string | null;
  };
  /** ReelSource status from session metadata */
  reelSourceStatus?: ReelSourceStatus | null;
  /** Direct video_url from session (legacy fallback) */
  videoUrl?: string | null;
  /** Session status */
  sessionStatus?: string | null;
}

// ==================== Core Eligibility Function ====================

/**
 * Check if a session is eligible for reel creation
 * 
 * IMPORTANT: This is a SYNC function using pre-fetched data.
 * It does NOT make network calls.
 * 
 * Eligibility criteria (ok = true if ANY is true):
 * A) session.screenVideo.present === true AND session.screenVideo.status === "ready"
 * B) session.reelSourceStatus === "ready"
 * C) session has a playable screenVideo URL/ref (fallback for legacy)
 * 
 * @param session - Pre-fetched session data
 * @returns Eligibility result with reason code if ineligible
 */
export function canCreateReel(session: SessionEligibilityInput): ReelEligibilityResult {
  const details = {
    hasScreenVideo: session.screenVideo?.present ?? false,
    screenVideoStatus: session.screenVideo?.status ?? null,
    reelSourceStatus: session.reelSourceStatus ?? null,
    hasVideoUrl: !!session.videoUrl,
    isLegacy: false,
  };

  // ============ CRITERION A: Screen video is present and ready ============
  if (session.screenVideo?.present && session.screenVideo?.status === "ready") {
    return {
      ok: true,
      details,
    };
  }

  // ============ CRITERION B: ReelSource is ready ============
  if (session.reelSourceStatus === "ready") {
    return {
      ok: true,
      details,
    };
  }

  // ============ CRITERION C: Legacy fallback - has playable video URL ============
  // This handles older sessions that have video_url but no ReelSource yet
  if (session.videoUrl) {
    // Mark as legacy session with video
    details.isLegacy = true;
    return {
      ok: true,
      details,
    };
  }

  // ============ NOT ELIGIBLE - Determine reason ============

  // Check if processing
  if (
    session.screenVideo?.status === "processing" ||
    session.reelSourceStatus === "preparing" ||
    session.sessionStatus === "processing"
  ) {
    return {
      ok: false,
      reasonCode: "video_processing",
      details,
    };
  }

  // Check if uploading
  if (
    session.screenVideo?.status === "uploading" ||
    session.sessionStatus === "uploading"
  ) {
    return {
      ok: false,
      reasonCode: "video_uploading",
      details,
    };
  }

  // Check if failed
  if (
    session.screenVideo?.status === "failed" ||
    session.reelSourceStatus === "failed" ||
    session.sessionStatus === "failed"
  ) {
    return {
      ok: false,
      reasonCode: "video_failed",
      details,
    };
  }

  // Check if truly missing
  if (
    session.screenVideo?.status === "missing" ||
    session.reelSourceStatus === "missing" ||
    (!session.screenVideo?.present && !session.videoUrl)
  ) {
    return {
      ok: false,
      reasonCode: "video_missing",
      details,
    };
  }

  // Unknown state
  return {
    ok: false,
    reasonCode: "unknown",
    details,
  };
}

// ==================== User-Friendly Messages ====================

/**
 * Get user-friendly message for an ineligibility reason
 */
export function getReelIneligibilityMessage(reasonCode: ReelIneligibilityReason): string {
  switch (reasonCode) {
    case "video_missing":
      return "No recording available for this session";
    case "video_processing":
      return "Session video is still processing";
    case "video_uploading":
      return "Session video is still uploading";
    case "video_failed":
      return "Session video processing failed";
    case "unknown":
    default:
      return "Unable to create reel for this session";
  }
}

/**
 * Get tooltip text for disabled Create Reel button
 */
export function getCreateReelDisabledTooltip(reasonCode: ReelIneligibilityReason): string {
  switch (reasonCode) {
    case "video_missing":
      return "No recording available";
    case "video_processing":
      return "Video still processing…";
    case "video_uploading":
      return "Video still uploading…";
    case "video_failed":
      return "Video processing failed";
    case "unknown":
    default:
      return "Unable to create reel";
  }
}

// ==================== Helper for extracting data from session ============

/**
 * Extract eligibility input from a raw session object
 * Use this to normalize various session shapes
 */
export function extractEligibilityInput(session: {
  video_url?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
}): SessionEligibilityInput {
  // Extract ReelSource status from metadata
  let reelSourceStatus: ReelSourceStatus | null = null;
  if (session.metadata && typeof session.metadata === "object") {
    const reelSource = session.metadata.reelSource as ReelSource | undefined;
    if (reelSource && typeof reelSource === "object" && reelSource.status) {
      reelSourceStatus = reelSource.status;
    }
  }

  // Build screen video info from session
  // Note: In a full implementation, this would come from video_assets table
  // For now, derive from session status and video_url
  const hasVideoUrl = !!session.video_url;
  let screenVideoStatus: SessionEligibilityInput["screenVideo"] = undefined;

  if (hasVideoUrl) {
    screenVideoStatus = {
      present: true,
      status: "ready",
      url: session.video_url,
    };
  } else if (session.status === "processing") {
    screenVideoStatus = {
      present: true, // Assumed to exist but not ready
      status: "processing",
      url: null,
    };
  } else if (session.status === "uploading") {
    screenVideoStatus = {
      present: true,
      status: "uploading",
      url: null,
    };
  } else if (session.status === "failed") {
    screenVideoStatus = {
      present: false,
      status: "failed",
      url: null,
    };
  } else {
    screenVideoStatus = {
      present: false,
      status: "missing",
      url: null,
    };
  }

  return {
    screenVideo: screenVideoStatus,
    reelSourceStatus,
    videoUrl: session.video_url,
    sessionStatus: session.status,
  };
}
