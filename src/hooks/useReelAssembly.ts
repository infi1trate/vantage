/**
 * Reel Assembly Hook
 * 
 * Manages the reel assembly lifecycle with:
 * - Real-time subscription to reel status changes
 * - 45-second timeout fail-safe
 * - Retry mechanism for failed assembly
 * - Telemetry logging for duration, failures, and retries
 * - Integration with global render queue for cross-app visibility
 * - Single source of truth: assembly_attempt_id prevents stale updates
 * 
 * CRITICAL: Progress is derived from actual assembly_step, NOT simulated.
 * 
 * States:
 * - idle: No assembly running
 * - assembling: Assembly in progress
 * - ready: Assembly complete, preview available
 * - failed: Assembly failed with error
 * - needs_attention: Timeout reached but recoverable
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ReelStatus, AssemblyStep, updateReel, getReel, retryAssembly, isJobActive, cancelAssemblyJob, isAttemptActive, LastError, buildSegmentProgress, SegmentProgressInfo, SegmentStatusType, executeAssembly, MomentSegmentInput } from "@/lib/reels";
import { resolveAllSegments, toMomentSegmentInputs } from "@/lib/segmentResolver";
import { waitForAssetReadiness, checkAssetReadiness, getAssetStatusMessage, AssetReadinessStatus, watchForAssetReadiness, isPermanentFailure } from "@/lib/assetReadiness";
import { checkReelSourceReadiness, getReelSourceStatusMessage, startLegacyBackfill, ensureReelSourceReady } from "@/lib/reelSource";
import { useQueryClient } from "@tanstack/react-query";
import {
  createRenderJob,
  updateRenderJob,
  getReelAssemblyJob,
  resetRenderJobForRetry,
  RenderJob,
  RenderJobCtaAction,
} from "@/lib/renderQueue";
import { getErrorCategory, getReasonLabel, ClipValidationError, parseClipValidationError } from "@/lib/reels";

export type AssemblyState = "idle" | "preparing_legacy" | "waiting_for_source" | "assembling" | "ready" | "failed" | "needs_attention";

const ASSEMBLY_TIMEOUT_MS = 45_000; // 45 seconds max
const POLL_INTERVAL_MS = 2_000; // Poll every 2s as backup
const MAX_RETRY_ATTEMPTS = 3;
const MAX_AUTO_RETRIES = 1; // Only 1 auto-retry before transitioning to needs_attention

/**
 * Step-based progress configuration (MANIFEST-FIRST)
 * 
 * Assembly success = collecting_clips → finalizing_manifest → ready
 * Preview is a SEPARATE background job and doesn't block "ready"
 */
const STEP_PROGRESS_RANGES: Record<AssemblyStep, { min: number; max: number; stage: number }> = {
  collecting_clips: { min: 0, max: 50, stage: 0 },      // Collect clips (half the work)
  finalizing_manifest: { min: 50, max: 95, stage: 1 },  // Write manifest (almost done)
  ready: { min: 100, max: 100, stage: 1 },              // SUCCESS
  failed: { min: 0, max: 0, stage: 0 },
};

/**
 * Status of each segment during collection
 */
export type SegmentStatus = "pending" | "resolving" | "resolved" | "failed" | "skipped";

/**
 * Moment type for display (derived from annotation_type)
 */
export type MomentType = "Kill" | "Death" | "Highlight" | "Objective" | "Marker" | "Note";

/**
 * Full segment progress with instrumentation
 * This tells us exactly which clip is hanging or failing
 */
export interface SegmentProgress {
  /** 0-based index of the segment */
  segmentIndex: number;
  /** Moment ID that this segment references */
  momentId: string;
  /** Type of moment (Kill, Death, Highlight, etc.) */
  momentType: MomentType;
  /** Human-readable label (e.g., "Kill at 3:14") */
  label: string;
  /** Formatted timestamp (e.g., "3:14") */
  momentTimestamp: string;
  /** Raw timestamp in seconds */
  timestampSeconds: number;
  /** Intended clip range in milliseconds */
  intendedRangeMs: {
    startMs: number;
    endMs: number;
  };
  /** Reference to source video (session ID or video URL) */
  sourceRef: string | null;
  /** Current status of this segment */
  status: SegmentStatus;
  /** Error reason if status is "failed" */
  errorReason?: string;
}

export interface AssemblyProgress {
  /** Current progress percentage (0-100) */
  percent: number;
  /** Current stage index (0-2) */
  stage: number;
  /** Current assembly step from database */
  step: AssemblyStep | null;
  /** When the current step started */
  stepStartedAt: string | null;
  /** For collecting_clips: which segment is currently being resolved */
  currentSegmentIndex?: number;
  /** For collecting_clips: total number of segments */
  totalSegments?: number;
  /** For collecting_clips: status of each segment */
  segments?: SegmentProgress[];
}

export interface ReelAssemblyState {
  /** Current assembly state */
  state: AssemblyState;
  
  /** Error message if failed */
  error: string | null;
  
  /** Whether assembly is in progress */
  isAssembling: boolean;
  
  /** Whether assembly is complete and ready */
  isReady: boolean;
  
  /** Whether we can retry */
  canRetry: boolean;
  
  /** Number of retry attempts */
  retryCount: number;
  
  /** Maximum retry attempts allowed */
  maxRetries: number;
  
  /** Retry assembly function */
  retry: () => Promise<void>;
  
  /** Step-based progress (truthful, not simulated) */
  progress: AssemblyProgress;
  
  /** Current attempt ID for this assembly run */
  attemptId: string | null;
}

/**
 * Format timestamp for queue display (compact: "0:39")
 */
function formatTimestampForQueue(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Lightweight telemetry logger for assembly events
 */
function logAssemblyTelemetry(
  event: "start" | "success" | "failure" | "retry" | "timeout",
  reelId: string,
  data?: {
    durationMs?: number;
    reason?: string;
    retryCount?: number;
    attemptId?: string;
  }
) {
  const timestamp = new Date().toISOString();
  const logData = {
    event: `reel_assembly_${event}`,
    reelId,
    timestamp,
    ...data,
  };
  
  // Log to console in structured format
  console.log(`[ReelAssembly:Telemetry]`, JSON.stringify(logData));
}

/**
 * Create a structured LastError object for storage
 */
function createLastError(
  message: string,
  step: AssemblyStep | "unknown",
  code: LastError["code"],
  options?: {
    segmentIndex?: number;
    momentId?: string;
    error?: Error;
  }
): LastError {
  const lastError: LastError = {
    message,
    step,
    code,
    timestamp: new Date().toISOString(),
    segmentIndex: options?.segmentIndex,
    momentId: options?.momentId,
  };
  
  // Only include stack in development
  if (process.env.NODE_ENV === "development" && options?.error?.stack) {
    lastError.stack = options.error.stack;
  }
  
  return lastError;
}

/**
 * Map label/annotation_type to MomentType for display
 */
function getMomentTypeFromLabel(label: string | undefined): MomentType {
  const lowerLabel = (label || "").toLowerCase();
  if (lowerLabel.includes("kill")) return "Kill";
  if (lowerLabel.includes("death")) return "Death";
  if (lowerLabel.includes("highlight")) return "Highlight";
  if (lowerLabel.includes("objective")) return "Objective";
  if (lowerLabel.includes("note")) return "Note";
  return "Marker";
}

/**
 * Format seconds as MM:SS for display
 */
function formatMomentTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Calculate progress from assembly step
 * Smoothly interpolates within the step's range based on elapsed time
 */
function calculateStepProgress(
  step: AssemblyStep | null,
  stepStartedAt: string | null,
  maxStepDurationMs: number = 15_000
): AssemblyProgress {
  if (!step || step === "failed") {
    return { percent: 0, stage: 0, step, stepStartedAt };
  }
  
  if (step === "ready") {
    return { percent: 100, stage: 2, step, stepStartedAt };
  }
  
  const range = STEP_PROGRESS_RANGES[step];
  if (!range) {
    return { percent: 0, stage: 0, step, stepStartedAt };
  }
  
  // Calculate progress within the step's range based on elapsed time
  let progressWithinStep = 0;
  if (stepStartedAt) {
    const elapsed = Date.now() - new Date(stepStartedAt).getTime();
    // Smooth ease-out within the step, capped at 95% of the range
    const t = Math.min(elapsed / maxStepDurationMs, 1);
    const eased = 1 - Math.pow(1 - t, 2);
    progressWithinStep = eased * 0.95; // Never reach max within the step
  }
  
  const percent = Math.round(range.min + progressWithinStep * (range.max - range.min));
  
  return {
    percent: Math.min(percent, range.max - 1), // Always leave room for next step
    stage: range.stage,
    step,
    stepStartedAt,
  };
}

/**
 * Subscribe to reel status changes and handle assembly lifecycle
 */
export function useReelAssembly(
  reelId: string | undefined,
  initialStatus: ReelStatus | undefined,
  reelMetadata?: {
    sessionId?: string;
    sessionTitle?: string;
    reelTitle?: string;
    aspectRatio?: string;
    clipCount?: number;
    /** Initial assembly step from reel data */
    assemblyStep?: AssemblyStep | null;
    /** Initial step started time */
    stepStartedAt?: string | null;
    /** Initial attempt ID */
    assemblyAttemptId?: string | null;
  }
): ReelAssemblyState {
  const queryClient = useQueryClient();
  
  // Derive initial state from status
  const getStateFromStatus = useCallback((status: ReelStatus | undefined): AssemblyState => {
    if (!status) return "idle";
    if (status === "compiling") return "assembling";
    if (status === "failed") return "failed";
    if (status === "needs_attention") return "needs_attention";
    return "ready"; // draft, ready, rendering all mean assembly is done
  }, []);
  
  const [state, setState] = useState<AssemblyState>(() => getStateFromStatus(initialStatus));
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Track the current attempt ID to filter stale updates
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(
    reelMetadata?.assemblyAttemptId || null
  );
  
  // Step-based progress state (truthful, from database)
  const [currentStep, setCurrentStep] = useState<AssemblyStep | null>(
    reelMetadata?.assemblyStep || null
  );
  const [stepStartedAt, setStepStartedAt] = useState<string | null>(
    reelMetadata?.stepStartedAt || null
  );
  
  // Segment-level progress tracking for collecting_clips
  const [segments, setSegments] = useState<SegmentProgress[]>([]);
  
  // Smooth progress animation within current step
  const [displayProgress, setDisplayProgress] = useState<number>(0);
  
  const timeoutRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const assemblyStartRef = useRef<number | null>(null);
  const progressAnimationRef = useRef<number | null>(null);
  const renderJobIdRef = useRef<string | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  
  // Clear all timers
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (progressAnimationRef.current) {
      clearInterval(progressAnimationRef.current);
      progressAnimationRef.current = null;
    }
  }, []);
  
  // Calculate current progress from step, including segment-based progress
  const progress = useMemo((): AssemblyProgress => {
    const baseProgress = calculateStepProgress(currentStep, stepStartedAt);
    
    // Enhance with segment data for collecting_clips
    if (currentStep === "collecting_clips" && segments.length > 0) {
      const resolvedCount = segments.filter(s => s.status === "resolved" || s.status === "skipped").length;
      const resolvingIndex = segments.findIndex(s => s.status === "resolving");
      const currentIndex = resolvingIndex >= 0 ? resolvingIndex + 1 : resolvedCount + 1;
      
      // Calculate segment-based percent (0-50% range for collecting_clips)
      const segmentPercent = segments.length > 0 
        ? Math.round((resolvedCount / segments.length) * 50) 
        : 0;
      
      return {
        ...baseProgress,
        percent: segmentPercent,
        currentSegmentIndex: Math.min(currentIndex, segments.length),
        totalSegments: segments.length,
        segments,
      };
    }
    
    return baseProgress;
  }, [currentStep, stepStartedAt, segments]);
  
  // Smooth animation of display progress toward target
  useEffect(() => {
    if (state !== "assembling") {
      // Not assembling - snap to target
      setDisplayProgress(progress.percent);
      return;
    }
    
    // Animate toward target progress
    const animate = () => {
      setDisplayProgress(prev => {
        const target = progress.percent;
        if (prev >= target) return prev; // Never go backwards, never exceed target
        
        // Smooth approach to target
        const diff = target - prev;
        const step = Math.max(0.5, diff * 0.1);
        return Math.min(prev + step, target);
      });
    };
    
    progressAnimationRef.current = window.setInterval(animate, 100);
    
    return () => {
      if (progressAnimationRef.current) {
        clearInterval(progressAnimationRef.current);
        progressAnimationRef.current = null;
      }
    };
  }, [state, progress.percent]);
  
  // Create or get the render queue job for this reel
  const ensureRenderJob = useCallback(() => {
    if (!reelId) return null;
    
    let job = getReelAssemblyJob(reelId);
    
    if (!job && reelMetadata?.sessionId) {
      job = createRenderJob({
        type: "reel_assembly",
        sessionId: reelMetadata.sessionId,
        sessionTitle: reelMetadata.sessionTitle || "Session",
        reelId,
        reelTitle: reelMetadata.reelTitle || "Untitled Reel",
        aspectRatio: reelMetadata.aspectRatio,
        clipCount: reelMetadata.clipCount,
      });
      console.log("[ReelAssembly] Created render job:", job.id);
    }
    
    if (job) {
      renderJobIdRef.current = job.id;
    }
    
    return job;
  }, [reelId, reelMetadata]);
  
  // Update render job with current step progress
  const updateJobProgress = useCallback((stage: number, progressPercent: number) => {
    if (!renderJobIdRef.current) return;
    
    updateRenderJob(renderJobIdRef.current, {
      status: "processing",
      currentStageIndex: stage,
      overallProgress: progressPercent,
      startedAt: new Date().toISOString(),
    });
  }, []);
  
  // Complete render job with success info
  const completeJob = useCallback(() => {
    if (!renderJobIdRef.current) return;
    
    updateRenderJob(renderJobIdRef.current, {
      status: "completed",
      overallProgress: 100,
      currentStageIndex: 2,
      shortReason: "Ready to export",
      primaryCtaLabel: "Open",
      primaryCtaAction: "open",
      errorCategory: undefined,
      updatedAt: new Date().toISOString(),
    });
    renderJobIdRef.current = null;
  }, []);
  
  // Fail render job with structured error info
  const failJob = useCallback((errorMessage: string, clipError?: ClipValidationError | null) => {
    if (!renderJobIdRef.current) return;
    
    // Derive short reason from clip error if available
    let shortReason = "Assembly failed";
    let errorCat: "video_not_ready" | "invalid_range" | "missing_source" | "asset_not_ready" | "timeout" | "other" = "other";
    
    if (clipError) {
      errorCat = getErrorCategory(clipError.reason);
      shortReason = `Can't access ${clipError.momentLabel} (${formatTimestampForQueue(clipError.timestampSeconds)})`;
    }
    
    updateRenderJob(renderJobIdRef.current, {
      status: "failed",
      errorMessage,
      shortReason,
      primaryCtaLabel: "Retry",
      primaryCtaAction: "retry",
      errorCategory: errorCat,
      updatedAt: new Date().toISOString(),
    });
  }, []);
  
  // Mark job as needing attention with structured error info
  const markJobNeedsAttention = useCallback((errorMessage: string, clipError?: ClipValidationError | null) => {
    if (!renderJobIdRef.current) return;
    
    // Derive short reason from clip error or use generic timeout message
    let shortReason = "Taking longer than expected";
    let primaryCtaAction: RenderJobCtaAction = "fix";
    let errorCat: "video_not_ready" | "invalid_range" | "missing_source" | "asset_not_ready" | "timeout" | "other" = "timeout";
    
    if (clipError) {
      errorCat = getErrorCategory(clipError.reason);
      const reasonLabel = getReasonLabel(clipError.reason);
      shortReason = `${clipError.momentLabel} (${formatTimestampForQueue(clipError.timestampSeconds)}): ${reasonLabel}`;
    }
    
    updateRenderJob(renderJobIdRef.current, {
      status: "needs_attention",
      errorMessage,
      shortReason,
      primaryCtaLabel: "Fix",
      primaryCtaAction,
      errorCategory: errorCat,
      updatedAt: new Date().toISOString(),
    });
  }, []);
  
  // Mark job as waiting for source video
  const markJobWaiting = useCallback((reason?: string) => {
    if (!renderJobIdRef.current) return;
    
    updateRenderJob(renderJobIdRef.current, {
      status: "waiting",
      shortReason: reason || "Waiting for session video…",
      updatedAt: new Date().toISOString(),
    });
  }, []);
  
  // Mark job as permanent failure (no_video)
  const markJobPermanentFailure = useCallback((reason: string) => {
    if (!renderJobIdRef.current) return;
    
    updateRenderJob(renderJobIdRef.current, {
      status: "needs_attention",
      errorMessage: reason,
      shortReason: "This session has no gameplay video.",
      primaryCtaLabel: "View Session",
      primaryCtaAction: "fix",
      errorCategory: "missing_source",
      updatedAt: new Date().toISOString(),
    });
  }, []);
  
  // Handle status/step update from any source
  const handleReelUpdate = useCallback((
    newStatus: ReelStatus,
    newStep: AssemblyStep | null,
    newStepStartedAt: string | null,
    attemptId: string | null
  ) => {
    if (!mountedRef.current || !reelId) return;
    
    // CRITICAL: Ignore updates from stale attempts
    if (currentAttemptId && attemptId && attemptId !== currentAttemptId) {
      console.log("[ReelAssembly] Ignoring stale attempt update:", attemptId, "current:", currentAttemptId);
      return;
    }
    
    console.log("[ReelAssembly] Update:", { status: newStatus, step: newStep, attemptId });
    
    // Update step tracking
    setCurrentStep(newStep);
    setStepStartedAt(newStepStartedAt);
    
    // Update render job with step-based progress
    if (newStep && STEP_PROGRESS_RANGES[newStep]) {
      const range = STEP_PROGRESS_RANGES[newStep];
      updateJobProgress(range.stage, range.min);
    }
    
    if (newStatus === "compiling") {
      setState("assembling");
      setError(null);
      if (!assemblyStartRef.current) {
        assemblyStartRef.current = Date.now();
        logAssemblyTelemetry("start", reelId, { attemptId: attemptId || undefined });
        ensureRenderJob();
      }
    } else if (newStatus === "failed") {
      setState("failed");
      clearTimers();
      failJob("Reel assembly failed. Please try again.");
      const durationMs = assemblyStartRef.current 
        ? Date.now() - assemblyStartRef.current 
        : undefined;
      logAssemblyTelemetry("failure", reelId, { 
        durationMs,
        reason: "status_changed_to_failed",
        retryCount,
        attemptId: attemptId || undefined,
      });
      assemblyStartRef.current = null;
    } else if (newStatus === "needs_attention") {
      // Stalled or recoverable failure - show in global queue
      setState("needs_attention");
      clearTimers();
      markJobNeedsAttention("This reel needs attention. Open the editor to fix it.");
      const durationMs = assemblyStartRef.current 
        ? Date.now() - assemblyStartRef.current 
        : undefined;
      logAssemblyTelemetry("timeout", reelId, { 
        durationMs,
        reason: "status_needs_attention",
        retryCount,
        attemptId: attemptId || undefined,
      });
      assemblyStartRef.current = null;
    } else {
      // draft, ready, rendering = assembly complete
      setState("ready");
      setError(null);
      clearTimers();
      completeJob();
      const durationMs = assemblyStartRef.current 
        ? Date.now() - assemblyStartRef.current 
        : undefined;
      if (durationMs) {
        logAssemblyTelemetry("success", reelId, { durationMs, retryCount, attemptId: attemptId || undefined });
      }
      assemblyStartRef.current = null;
    }
    
    queryClient.invalidateQueries({ queryKey: ["reel", reelId] });
  }, [reelId, queryClient, clearTimers, retryCount, ensureRenderJob, updateJobProgress, completeJob, failJob, markJobNeedsAttention, currentAttemptId]);
  
  // Fail the assembly with timeout
  const failWithTimeout = useCallback(async () => {
    if (!reelId || !mountedRef.current) return;
    
    const durationMs = assemblyStartRef.current 
      ? Date.now() - assemblyStartRef.current 
      : ASSEMBLY_TIMEOUT_MS;
    
    logAssemblyTelemetry("timeout", reelId, { 
      durationMs, 
      reason: "timeout_45s",
      retryCount,
      attemptId: currentAttemptId || undefined,
    });
    
    console.warn("[ReelAssembly] Assembly timed out after 45s");
    
    markJobNeedsAttention("This is taking longer than expected.");
    
    try {
      await supabase
        .from("reels")
        .update({ 
          render_error: "This is taking longer than expected.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", reelId);
      
      if (mountedRef.current) {
        setState("needs_attention");
        setError("This is taking longer than expected.");
        clearTimers();
        assemblyStartRef.current = null;
        queryClient.invalidateQueries({ queryKey: ["reel", reelId] });
      }
    } catch (err) {
      console.error("[ReelAssembly] Failed to update timeout status:", err);
    }
  }, [reelId, queryClient, clearTimers, retryCount, markJobNeedsAttention, currentAttemptId]);
  
  // Poll for status as a backup mechanism
  const pollStatus = useCallback(async () => {
    if (!reelId || !mountedRef.current) return;
    
    try {
      const reel = await getReel(reelId);
      if (reel && mountedRef.current) {
        handleReelUpdate(
          reel.status as ReelStatus,
          reel.assembly_step,
          reel.step_started_at,
          reel.assembly_attempt_id
        );
      }
    } catch (err) {
      console.error("[ReelAssembly] Poll error:", err);
    }
  }, [reelId, handleReelUpdate]);
  
  // Setup real-time subscription and timeout
  useEffect(() => {
    if (!reelId) return;
    
    mountedRef.current = true;
    
    // Subscribe to real-time changes on this specific reel
    const channel = supabase
      .channel(`reel-${reelId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reels",
          filter: `id=eq.${reelId}`,
        },
        (payload) => {
          console.log("[ReelAssembly] Real-time update:", payload);
          const newData = payload.new as {
            status: ReelStatus;
            assembly_step: AssemblyStep | null;
            step_started_at: string | null;
            assembly_attempt_id: string | null;
          };
          handleReelUpdate(
            newData.status,
            newData.assembly_step,
            newData.step_started_at,
            newData.assembly_attempt_id
          );
        }
      )
      .subscribe((status) => {
        console.log("[ReelAssembly] Subscription status:", status);
      });
    
    // Setup timeout if currently assembling
    if (state === "assembling") {
      console.log("[ReelAssembly] Starting 45s timeout");
      if (!assemblyStartRef.current) {
        assemblyStartRef.current = Date.now();
      }
      
      ensureRenderJob();
      
      timeoutRef.current = window.setTimeout(failWithTimeout, ASSEMBLY_TIMEOUT_MS);
      pollRef.current = window.setInterval(pollStatus, POLL_INTERVAL_MS);
    }
    
    return () => {
      mountedRef.current = false;
      clearTimers();
      supabase.removeChannel(channel);
    };
  }, [reelId, state, handleReelUpdate, failWithTimeout, pollStatus, clearTimers, ensureRenderJob]);
  
  // Sync state when initialStatus changes
  useEffect(() => {
    const newState = getStateFromStatus(initialStatus);
    if (newState !== state && initialStatus) {
      console.log("[ReelAssembly] Syncing state from prop:", initialStatus, "->", newState);
      setState(newState);
      
      if (newState !== "assembling") {
        clearTimers();
      }
      
      if (initialStatus === "failed") {
        getReel(reelId!).then((reel) => {
          if (reel?.render_error && mountedRef.current) {
            setError(reel.render_error);
          }
        });
      }
    }
  }, [initialStatus, reelId, state, getStateFromStatus, clearTimers]);
  
  // Sync attempt ID from metadata
  useEffect(() => {
    if (reelMetadata?.assemblyAttemptId && reelMetadata.assemblyAttemptId !== currentAttemptId) {
      setCurrentAttemptId(reelMetadata.assemblyAttemptId);
    }
    if (reelMetadata?.assemblyStep !== undefined) {
      setCurrentStep(reelMetadata.assemblyStep);
    }
    if (reelMetadata?.stepStartedAt !== undefined) {
      setStepStartedAt(reelMetadata.stepStartedAt);
    }
  }, [reelMetadata?.assemblyAttemptId, reelMetadata?.assemblyStep, reelMetadata?.stepStartedAt, currentAttemptId]);
  
  // Auto-trigger assembly for new reels in "compiling" status
  // This runs assembly with proper per-segment (5s) and global (20s) timeouts
  const hasTriggeredRef = useRef(false);
  useEffect(() => {
    if (
      !reelId || 
      hasTriggeredRef.current ||
      initialStatus !== "compiling" ||
      state !== "assembling"
    ) {
      return;
    }
    
    // Mark as triggered to prevent re-runs
    hasTriggeredRef.current = true;
    
    console.log("[ReelAssembly] Auto-triggering assembly for new reel:", reelId);
    
    // Execute assembly in background
    (async () => {
      try {
        const reel = await getReel(reelId);
        if (!reel || reel.status !== "compiling") {
          console.log("[ReelAssembly] Reel no longer in compiling status, skipping");
          return;
        }
        
        const momentIds = reel.source_moment_ids || [];
        if (momentIds.length === 0) {
          console.error("[ReelAssembly] No moment IDs for assembly");
          return;
        }
        
        const sessionId = reel.session_id;
        if (!sessionId) {
          console.error("[ReelAssembly] No session ID for assembly");
          setError("No session associated with this reel");
          setState("needs_attention");
          return;
        }
        
        // ============ REEL SOURCE READINESS GATE ============
        // Check if ReelSource is ready before collecting clips
        // ReelSource is the versioned compatibility layer for session video
        // Distinguish between recoverable (preparing) vs permanent (missing) failures
        console.log("[ReelAssembly] Checking ReelSource readiness for session:", sessionId);
        
        // First check ReelSource (preferred) - provides version-aware guarantees
        let reelSourceResult = await checkReelSourceReadiness(sessionId);
        
        // Log legacy vs new session detection
        if (reelSourceResult.isLegacy) {
          console.log("[ReelAssembly] Legacy session detected, may need backfill");
          
          // === LEGACY SESSION: Check if backfill is needed ===
          // If the session has video but no proper ReelSource metadata,
          // trigger on-demand backfill before proceeding
          if (reelSourceResult.isReady && reelSourceResult.videoUrl) {
            console.log("[ReelAssembly] Legacy session with video - triggering backfill");
            
            // Transition to preparing_legacy state for UI feedback
            setState("preparing_legacy");
            ensureRenderJob();
            markJobWaiting("Preparing recording for reels…");
            
            // Trigger backfill (this creates/updates ReelSource metadata)
            const backfillResult = await startLegacyBackfill(sessionId);
            
            if (!backfillResult.success) {
              // Backfill failed - transition to needs_attention
              const errorMessage = backfillResult.message || "Failed to prepare legacy recording";
              console.warn("[ReelAssembly] Legacy backfill failed:", errorMessage);
              
              setError(errorMessage);
              setState("needs_attention");
              
              await supabase
                .from("reels")
                .update({
                  status: "needs_attention",
                  render_error: JSON.stringify({
                    reason: "asset_not_ready",
                    description: errorMessage,
                    isRecoverable: true, // Can retry backfill
                    isLegacy: true,
                  }),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", reelId);
              
              markJobNeedsAttention(errorMessage);
              clearTimers();
              queryClient.invalidateQueries({ queryKey: ["reel", reelId] });
              return;
            }
            
            // Backfill succeeded - continue with assembly
            console.log("[ReelAssembly] Legacy backfill completed, continuing assembly");
            setState("assembling");
            
            // Re-check readiness after backfill to get updated ReelSource
            reelSourceResult = await checkReelSourceReadiness(sessionId);
          }
        } else if (reelSourceResult.reelSource) {
          console.log(`[ReelAssembly] ReelSource v${reelSourceResult.reelSource.version}, status: ${reelSourceResult.reelSource.status}`);
        }
        
        if (!reelSourceResult.isReady) {
          console.log("[ReelAssembly] Source not ready:", reelSourceResult.message, "recoverable:", reelSourceResult.isRecoverable);
          
          if (reelSourceResult.isRecoverable) {
            // ===== RECOVERABLE: Video is processing/uploading =====
            // Update reel status and transition to waiting state
            await supabase
              .from("reels")
              .update({
                status: "waiting_for_source",
                updated_at: new Date().toISOString(),
              })
              .eq("id", reelId);
            
            setState("waiting_for_source");
            
            // Update queue job to show waiting status
            ensureRenderJob();
            markJobWaiting("Waiting for session video…");
            
            // Poll for readiness with bounded wait (30s max)
            const readinessResult = await waitForAssetReadiness(sessionId, (progress) => {
              console.log(`[ReelAssembly] Waiting for source: ${progress.elapsedMs}ms/${progress.maxMs}ms (attempt ${progress.attempt})`);
            });
            
            if (readinessResult.status !== "ready") {
              // Timeout - keep waiting in background, user can "Leave and notify me"
              const errorMessage = getAssetStatusMessage(readinessResult.status);
              console.warn("[ReelAssembly] Asset readiness timeout, transitioning to needs_attention:", readinessResult);
              
              setError(errorMessage);
              setState("needs_attention");
              
              await supabase
                .from("reels")
                .update({
                  status: "needs_attention",
                  render_error: JSON.stringify({
                    reason: "asset_not_ready",
                    description: errorMessage,
                    assetStatus: readinessResult.status,
                    isRecoverable: readinessResult.isRecoverable,
                  }),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", reelId);
              
              markJobNeedsAttention(errorMessage);
              clearTimers();
              queryClient.invalidateQueries({ queryKey: ["reel", reelId] });
              return;
            }
            
            // Asset is now ready - continue with assembly
            console.log("[ReelAssembly] Asset became ready, continuing assembly");
            
            // Update status back to compiling
            await supabase
              .from("reels")
              .update({
                status: "compiling",
                updated_at: new Date().toISOString(),
              })
              .eq("id", reelId);
            
            setState("assembling");
            updateJobProgress(0, 0);
          } else {
            // ===== PERMANENT FAILURE: no_video, not_found, failed =====
            // Do NOT keep waiting - immediately mark as needs_attention
            const reelSourceStatus = reelSourceResult.reelSource?.status || "missing";
            const errorMessage = reelSourceResult.message || "This session has no gameplay video.";
            console.warn("[ReelAssembly] Permanent failure - video missing:", reelSourceStatus);
            
            setError(errorMessage);
            setState("needs_attention");
            
            await supabase
              .from("reels")
              .update({
                status: "needs_attention",
                render_error: JSON.stringify({
                  reason: "asset_not_ready",
                  description: errorMessage,
                  assetStatus: reelSourceStatus,
                  isRecoverable: false,
                  isLegacy: reelSourceResult.isLegacy,
                }),
                updated_at: new Date().toISOString(),
              })
              .eq("id", reelId);
            
            ensureRenderJob();
            markJobPermanentFailure(errorMessage);
            
            clearTimers();
            queryClient.invalidateQueries({ queryKey: ["reel", reelId] });
            return;
        }
        }
        
        console.log("[ReelAssembly] Resolving segments using single source of truth resolver");
        
        // Build initial pending state for UI
        const initialSegments: SegmentProgress[] = momentIds.map((momentId, idx) => ({
          segmentIndex: idx,
          momentId,
          momentType: "Marker" as MomentType,
          label: `Clip ${idx + 1}`,
          momentTimestamp: "0:00",
          timestampSeconds: 0,
          intendedRangeMs: { startMs: 0, endMs: 5000 },
          sourceRef: sessionId,
          status: "pending" as const,
        }));
        setSegments(initialSegments);
        
        // Use the segment resolver as single source of truth
        // This handles all moment → segment conversion with proper defaults and validation
        const { segments: resolvedSegments, errors: resolutionErrors } = await resolveAllSegments(
          sessionId,
          momentIds,
          5_000 // 5 second timeout per segment
        );
        
        // Update segment state with results
        const updatedSegments: SegmentProgress[] = momentIds.map((momentId, idx) => {
          const resolved = resolvedSegments.find(s => s.momentId === momentId);
          const error = resolutionErrors.find(e => e.momentId === momentId);
          
          if (resolved) {
            return {
              segmentIndex: idx,
              momentId,
              momentType: resolved.momentType as MomentType,
              label: resolved.label,
              momentTimestamp: resolved.momentTimestamp,
              timestampSeconds: resolved.timestampSeconds,
              intendedRangeMs: { startMs: resolved.startMs, endMs: resolved.endMs },
              sourceRef: resolved.sourceVideoRef,
              status: "resolved" as const,
            };
          } else if (error) {
            return {
              segmentIndex: idx,
              momentId,
              momentType: error.momentType as MomentType,
              label: `${error.momentType} at ${error.momentTimestamp}`,
              momentTimestamp: error.momentTimestamp,
              timestampSeconds: error.timestampSeconds,
              intendedRangeMs: { startMs: 0, endMs: 0 },
              sourceRef: null,
              status: "failed" as const,
              errorReason: error.description,
            };
          }
          return initialSegments[idx];
        });
        setSegments(updatedSegments);
        
        // Check for failures
        if (resolutionErrors.length > 0) {
          const firstError = resolutionErrors[0];
          const errorMessage = `Can't access: ${firstError.momentType} at ${firstError.momentTimestamp}`;
          console.warn("[ReelAssembly] Segment resolution failed:", errorMessage);
          
          setError(errorMessage);
          setState("needs_attention");
          if (renderJobIdRef.current) {
            markJobNeedsAttention(errorMessage);
          }
          
          // Update reel with error
          await supabase
            .from("reels")
            .update({
              status: "needs_attention",
              render_error: JSON.stringify({
                failingMomentId: firstError.momentId,
                failingMomentLabel: firstError.momentType,
                failingMomentTimestamp: firstError.timestampSeconds,
                reason: firstError.reason,
                description: firstError.description,
              }),
              updated_at: new Date().toISOString(),
            })
            .eq("id", reelId);
          
          clearTimers();
          queryClient.invalidateQueries({ queryKey: ["reel", reelId] });
          return;
        }
        
        // Convert resolved segments to MomentSegmentInput format
        const moments = toMomentSegmentInputs(resolvedSegments);
        
        console.log("[ReelAssembly] Starting assembly with", moments.length, "resolved segments");
        
        // Execute assembly with the resolved segments
        const result = await executeAssembly(reelId, moments);
        
        if (!result.success) {
          const errorMessage = result.userMessage || result.error || "Assembly failed";
          setError(errorMessage);
          setState("needs_attention");
          if (renderJobIdRef.current) {
            markJobNeedsAttention(errorMessage);
          }
          clearTimers();
        }
        
        queryClient.invalidateQueries({ queryKey: ["reel", reelId] });
      } catch (err) {
        console.error("[ReelAssembly] Auto-trigger assembly failed:", err);
        const errorMessage = err instanceof Error ? err.message : "Assembly failed";
        setError(errorMessage);
        setState("needs_attention");
      }
    })();
  }, [reelId, initialStatus, state, queryClient, clearTimers, markJobNeedsAttention]);
  
  // Retry assembly - with strict auto-retry limits
  // isAutoRetry flag distinguishes user-initiated retries from automatic ones
  const retry = useCallback(async (isAutoRetry = false) => {
    if (!reelId) return;
    
    const newRetryCount = retryCount + 1;
    
    // Check if we've exceeded max retries
    if (newRetryCount > MAX_RETRY_ATTEMPTS) {
      console.warn("[ReelAssembly] Max retries exceeded");
      
      // Create structured error
      const lastError = createLastError(
        "Maximum retry attempts reached. Please try again later.",
        currentStep || "unknown",
        "max_retries_exceeded"
      );
      
      // Store structured error and transition to needs_attention (NOT failed)
      await supabase
        .from("reels")
        .update({
          status: "needs_attention",
          render_error: JSON.stringify(lastError),
          updated_at: new Date().toISOString(),
        })
        .eq("id", reelId);
      
      setError(lastError.message);
      setState("needs_attention");
      markJobNeedsAttention("We hit an issue assembling your reel. Open the editor to retry.");
      queryClient.invalidateQueries({ queryKey: ["reel", reelId] });
      return;
    }
    
    // Auto-retry limit: if this is an auto-retry and we've already done MAX_AUTO_RETRIES,
    // transition to needs_attention instead of continuing to retry silently
    if (isAutoRetry && newRetryCount > MAX_AUTO_RETRIES) {
      console.warn("[ReelAssembly] Auto-retry limit reached, transitioning to needs_attention");
      
      const lastError = createLastError(
        "We hit an issue assembling one clip.",
        currentStep || "collecting_clips",
        "unknown_error"
      );
      
      await supabase
        .from("reels")
        .update({
          status: "needs_attention",
          render_error: JSON.stringify(lastError),
          updated_at: new Date().toISOString(),
        })
        .eq("id", reelId);
      
      setError(lastError.message);
      setState("needs_attention");
      markJobNeedsAttention("We hit an issue assembling one clip. Open the editor to fix it.");
      clearTimers();
      queryClient.invalidateQueries({ queryKey: ["reel", reelId] });
      return;
    }
    
    console.log("[ReelAssembly] Retrying assembly, attempt:", newRetryCount, isAutoRetry ? "(auto)" : "(user)");
    
    // Cancel any existing assembly job first
    if (activeJobIdRef.current) {
      console.log("[ReelAssembly] Cancelling existing job:", activeJobIdRef.current);
      await cancelAssemblyJob(reelId);
    }
    
    clearTimers();
    
    setRetryCount(newRetryCount);
    setState("assembling");
    setError(null);
    assemblyStartRef.current = Date.now();
    
    try {
      const { reel, jobId, attemptId } = await retryAssembly(reelId);
      
      // Update to new attempt ID - this will filter out any stale updates
      setCurrentAttemptId(attemptId);
      activeJobIdRef.current = jobId;
      
      // Reset step tracking
      setCurrentStep("collecting_clips");
      setStepStartedAt(reel.step_started_at);
      setDisplayProgress(0);
      
      logAssemblyTelemetry("retry", reelId, { retryCount: newRetryCount, attemptId });
      
      console.log("[ReelAssembly] Retry initiated with job:", jobId, "attemptId:", attemptId);
      
      // Reset the existing render job
      if (renderJobIdRef.current) {
        const resetJob = resetRenderJobForRetry(renderJobIdRef.current);
        if (!resetJob) {
          console.log("[ReelAssembly] Creating new render job for retry");
          ensureRenderJob();
        }
      } else {
        ensureRenderJob();
      }
      
      // Build moment inputs from source_moment_ids for executeAssembly
      // This will run the actual assembly with per-segment and global timeouts
      const currentReelData = await getReel(reelId);
      const momentIds = currentReelData?.source_moment_ids || [];
      const sessionId = currentReelData?.session_id;
      
      if (momentIds.length === 0) {
        throw new Error("No clips selected for assembly");
      }
      
      if (!sessionId) {
        throw new Error("No session associated with this reel");
      }
      
      // Use segment resolver as single source of truth
      console.log("[ReelAssembly] Resolving segments for retry using resolver");
      const { segments: resolvedSegments, errors: resolutionErrors } = await resolveAllSegments(
        sessionId,
        momentIds,
        5_000 // 5 second timeout per segment
      );
      
      // Update segment state with results
      const updatedSegments: SegmentProgress[] = momentIds.map((momentId, idx) => {
        const resolved = resolvedSegments.find(s => s.momentId === momentId);
        const error = resolutionErrors.find(e => e.momentId === momentId);
        
        if (resolved) {
          return {
            segmentIndex: idx,
            momentId,
            momentType: resolved.momentType as MomentType,
            label: resolved.label,
            momentTimestamp: resolved.momentTimestamp,
            timestampSeconds: resolved.timestampSeconds,
            intendedRangeMs: { startMs: resolved.startMs, endMs: resolved.endMs },
            sourceRef: resolved.sourceVideoRef,
            status: "resolved" as const,
          };
        } else if (error) {
          return {
            segmentIndex: idx,
            momentId,
            momentType: error.momentType as MomentType,
            label: `${error.momentType} at ${error.momentTimestamp}`,
            momentTimestamp: error.momentTimestamp,
            timestampSeconds: error.timestampSeconds,
            intendedRangeMs: { startMs: 0, endMs: 0 },
            sourceRef: null,
            status: "failed" as const,
            errorReason: error.description,
          };
        }
        return {
          segmentIndex: idx,
          momentId,
          momentType: "Marker" as MomentType,
          label: `Clip ${idx + 1}`,
          momentTimestamp: "0:00",
          timestampSeconds: 0,
          intendedRangeMs: { startMs: 0, endMs: 0 },
          sourceRef: null,
          status: "pending" as const,
        };
      });
      setSegments(updatedSegments);
      
      // Check for failures in resolution
      if (resolutionErrors.length > 0) {
        const firstError = resolutionErrors[0];
        const errorMessage = `Can't access: ${firstError.momentType} at ${firstError.momentTimestamp}`;
        console.warn("[ReelAssembly] Segment resolution failed on retry:", errorMessage);
        
        // Convert SegmentResolutionError to ClipValidationError-like shape
        const clipErrorLike: ClipValidationError = {
          index: 0,
          momentId: firstError.momentId,
          momentLabel: firstError.momentType,
          timestampSeconds: firstError.timestampSeconds,
          reason: firstError.reason === "no_video_available" ? "missing_source_video" 
                : firstError.reason === "exceeds_video_duration" ? "invalid_range"
                : firstError.reason as ClipValidationError["reason"],
          description: firstError.description,
        };
        
        setError(errorMessage);
        setState("needs_attention");
        markJobNeedsAttention(errorMessage, clipErrorLike);
        
        await supabase
          .from("reels")
          .update({
            status: "needs_attention",
            render_error: JSON.stringify({
              failingMomentId: firstError.momentId,
              failingMomentLabel: firstError.momentType,
              failingMomentTimestamp: firstError.timestampSeconds,
              reason: firstError.reason,
              description: firstError.description,
            }),
            updated_at: new Date().toISOString(),
          })
          .eq("id", reelId);
        
        clearTimers();
        assemblyStartRef.current = null;
        queryClient.invalidateQueries({ queryKey: ["reel", reelId] });
        return;
      }
      
      // Convert resolved segments to MomentSegmentInput format
      const moments = toMomentSegmentInputs(resolvedSegments);
      
      console.log("[ReelAssembly] Executing assembly with", moments.length, "resolved moments");
      
      // Execute assembly with per-segment (5s) and global (20s) timeouts
      // This will properly validate each segment and fail fast on issues
      const result = await executeAssembly(reelId, moments);
      
      // Before completing, verify this attempt is still active
      const stillActive = await isAttemptActive(reelId, attemptId);
      if (!stillActive) {
        console.log("[ReelAssembly] Attempt superseded, aborting completion:", attemptId);
        return;
      }
      
      if (!result.success) {
        // Assembly failed - executeAssembly already updated the database
        // Just sync our local state
        const errorMessage = result.userMessage || result.error || "Assembly failed";
        setError(errorMessage);
        if (result.clipError?.reason === "timeout_resolving_source") {
          setState("needs_attention");
          markJobNeedsAttention(errorMessage, result.clipError);
        } else {
          setState("needs_attention");
          markJobNeedsAttention(errorMessage, result.clipError);
        }
        clearTimers();
        assemblyStartRef.current = null;
        queryClient.invalidateQueries({ queryKey: ["reel", reelId] });
        return;
      }
      
      queryClient.invalidateQueries({ queryKey: ["reel", reelId] });
    } catch (err) {
      console.error("[ReelAssembly] Retry failed:", err);
      
      const durationMs = assemblyStartRef.current 
        ? Date.now() - assemblyStartRef.current 
        : undefined;
      
      logAssemblyTelemetry("failure", reelId, { 
        durationMs, 
        reason: err instanceof Error ? err.message : "retry_exception",
        retryCount: newRetryCount,
      });
      
      // Create structured error with context
      const lastError = createLastError(
        "We hit an issue assembling one clip.",
        currentStep || "collecting_clips",
        "unknown_error",
        { error: err instanceof Error ? err : undefined }
      );
      
      // CRITICAL: Never stay in "assembling" after an unhandled error
      // Transition to needs_attention so user can take action
      await supabase
        .from("reels")
        .update({
          status: "needs_attention",
          render_error: JSON.stringify(lastError),
          updated_at: new Date().toISOString(),
        })
        .eq("id", reelId);
      
      markJobNeedsAttention("We hit an issue assembling one clip. Open the editor to fix it.");
      
      setState("needs_attention");
      setError(lastError.message);
      clearTimers();
      assemblyStartRef.current = null;
      activeJobIdRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["reel", reelId] });
    }
  }, [reelId, queryClient, clearTimers, retryCount, ensureRenderJob, markJobNeedsAttention, currentStep]);
  
  const canRetry = (state === "failed" || state === "needs_attention") && retryCount < MAX_RETRY_ATTEMPTS;
  
  // Final progress with animated display
  const finalProgress: AssemblyProgress = {
    ...progress,
    percent: Math.round(displayProgress),
  };
  
  return {
    state,
    error,
    isAssembling: state === "assembling",
    isReady: state === "ready",
    canRetry,
    retryCount,
    maxRetries: MAX_RETRY_ATTEMPTS,
    retry,
    progress: finalProgress,
    attemptId: currentAttemptId,
  };
}
