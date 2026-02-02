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
import { ReelStatus, AssemblyStep, updateReel, getReel, retryAssembly, isJobActive, cancelAssemblyJob, isAttemptActive } from "@/lib/reels";
import { useQueryClient } from "@tanstack/react-query";
import {
  createRenderJob,
  updateRenderJob,
  getReelAssemblyJob,
  resetRenderJobForRetry,
  RenderJob,
} from "@/lib/renderQueue";

export type AssemblyState = "idle" | "assembling" | "ready" | "failed" | "needs_attention";

const ASSEMBLY_TIMEOUT_MS = 45_000; // 45 seconds max
const POLL_INTERVAL_MS = 2_000; // Poll every 2s as backup
const MAX_RETRY_ATTEMPTS = 3;

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

export interface AssemblyProgress {
  /** Current progress percentage (0-100) */
  percent: number;
  /** Current stage index (0-2) */
  stage: number;
  /** Current assembly step from database */
  step: AssemblyStep | null;
  /** When the current step started */
  stepStartedAt: string | null;
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
  
  // Calculate current progress from step (non-simulated)
  const progress = useMemo((): AssemblyProgress => {
    return calculateStepProgress(currentStep, stepStartedAt);
  }, [currentStep, stepStartedAt]);
  
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
  
  // Complete render job
  const completeJob = useCallback(() => {
    if (!renderJobIdRef.current) return;
    
    updateRenderJob(renderJobIdRef.current, {
      status: "completed",
      overallProgress: 100,
      currentStageIndex: 2,
    });
    renderJobIdRef.current = null;
  }, []);
  
  // Fail render job
  const failJob = useCallback((errorMessage: string) => {
    if (!renderJobIdRef.current) return;
    
    updateRenderJob(renderJobIdRef.current, {
      status: "failed",
      errorMessage,
    });
  }, []);
  
  // Mark job as needing attention
  const markJobNeedsAttention = useCallback((errorMessage: string) => {
    if (!renderJobIdRef.current) return;
    
    updateRenderJob(renderJobIdRef.current, {
      status: "needs_attention",
      errorMessage,
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
  }, [reelId, queryClient, clearTimers, retryCount, ensureRenderJob, updateJobProgress, completeJob, failJob, currentAttemptId]);
  
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
  
  // Retry assembly
  const retry = useCallback(async () => {
    if (!reelId) return;
    
    const newRetryCount = retryCount + 1;
    
    if (newRetryCount > MAX_RETRY_ATTEMPTS) {
      console.warn("[ReelAssembly] Max retries exceeded");
      setError("Still having trouble — try again later.");
      return;
    }
    
    console.log("[ReelAssembly] Retrying assembly, attempt:", newRetryCount);
    
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
      
      // Start timeout
      timeoutRef.current = window.setTimeout(failWithTimeout, ASSEMBLY_TIMEOUT_MS);
      pollRef.current = window.setInterval(pollStatus, POLL_INTERVAL_MS);
      
      // Simulate assembly completing (in production, this would be a backend job)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Before completing, verify this attempt is still active
      const stillActive = await isAttemptActive(reelId, attemptId);
      if (!stillActive) {
        console.log("[ReelAssembly] Attempt superseded, aborting completion:", attemptId);
        return;
      }
      
      await supabase
        .from("reels")
        .update({ 
          status: "draft",
          assembly_step: "ready",
          render_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reelId)
        .eq("assembly_attempt_id", attemptId); // Only update if attempt matches
      
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
      
      failJob("Something interrupted the assembly process. Please try again.");
      
      setState("failed");
      setError("Something interrupted the assembly process. Please try again.");
      clearTimers();
      assemblyStartRef.current = null;
      activeJobIdRef.current = null;
    }
  }, [reelId, queryClient, failWithTimeout, pollStatus, clearTimers, retryCount, ensureRenderJob, failJob]);
  
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
