/**
 * Reel Assembly Hook
 * 
 * Manages the reel assembly lifecycle with:
 * - Real-time subscription to reel status changes
 * - 45-second timeout fail-safe
 * - Retry mechanism for failed assembly
 * - Telemetry logging for duration, failures, and retries
 * - Integration with global render queue for cross-app visibility
 * 
 * States:
 * - idle: No assembly running
 * - assembling: Assembly in progress
 * - ready: Assembly complete, preview available
 * - failed: Assembly failed with error
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ReelStatus, updateReel, getReel } from "@/lib/reels";
import { useQueryClient } from "@tanstack/react-query";
import {
  createRenderJob,
  updateRenderJob,
  getReelAssemblyJob,
  loadRenderJobs,
  RenderJob,
} from "@/lib/renderQueue";

export type AssemblyState = "idle" | "assembling" | "ready" | "failed";

const ASSEMBLY_TIMEOUT_MS = 45_000; // 45 seconds max
const POLL_INTERVAL_MS = 2_000; // Poll every 2s as backup

// Assembly step progress ranges (matches ReelCompilingPlaceholder)
const ASSEMBLY_STEP_PROGRESS: Record<string, { stage: number; progress: number }> = {
  collecting: { stage: 0, progress: 20 },
  stitching: { stage: 1, progress: 70 },
  preparing: { stage: 2, progress: 100 },
};

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
  
  /** Retry assembly function */
  retry: () => Promise<void>;
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
  
  // In production, this would send to an analytics service
  // e.g., analytics.track('reel_assembly', logData);
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
  
  const timeoutRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const assemblyStartRef = useRef<number | null>(null);
  const progressSimulationRef = useRef<number | null>(null);
  const renderJobIdRef = useRef<string | null>(null);
  
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
    if (progressSimulationRef.current) {
      clearInterval(progressSimulationRef.current);
      progressSimulationRef.current = null;
    }
  }, []);
  
  // Create or get the render queue job for this reel
  const ensureRenderJob = useCallback(() => {
    if (!reelId) return null;
    
    // Check if job already exists
    let job = getReelAssemblyJob(reelId);
    
    if (!job && reelMetadata?.sessionId) {
      // Create new job
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
  
  // Update render job progress
  const updateJobProgress = useCallback((stage: number, progress: number) => {
    if (!renderJobIdRef.current) return;
    
    updateRenderJob(renderJobIdRef.current, {
      status: "processing",
      currentStageIndex: stage,
      overallProgress: progress,
      startedAt: new Date().toISOString(),
    });
  }, []);
  
  // Complete render job
  const completeJob = useCallback(() => {
    if (!renderJobIdRef.current) return;
    
    updateRenderJob(renderJobIdRef.current, {
      status: "completed",
      overallProgress: 100,
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
  
  // Start simulating progress for the render job
  const startProgressSimulation = useCallback(() => {
    if (progressSimulationRef.current) return;
    
    let elapsed = 0;
    const maxDuration = 25000; // 25 seconds to reach 85%
    
    progressSimulationRef.current = window.setInterval(() => {
      elapsed += 500;
      const t = Math.min(elapsed / maxDuration, 1);
      // Ease-out curve
      const easedProgress = 1 - Math.pow(1 - t, 3);
      // Cap at 85% - hold there until real completion
      const progress = Math.min(85, Math.round(easedProgress * 85));
      
      // Determine which stage we're in
      let stage = 0;
      if (progress >= 70) stage = 2;
      else if (progress >= 20) stage = 1;
      
      updateJobProgress(stage, progress);
    }, 500);
  }, [updateJobProgress]);
  
  // Handle status update from any source
  const handleStatusChange = useCallback((newStatus: ReelStatus) => {
    if (!mountedRef.current || !reelId) return;
    
    console.log("[ReelAssembly] Status changed:", newStatus);
    
    if (newStatus === "compiling") {
      setState("assembling");
      setError(null);
      // Track assembly start
      if (!assemblyStartRef.current) {
        assemblyStartRef.current = Date.now();
        logAssemblyTelemetry("start", reelId);
        // Create render job and start progress simulation
        ensureRenderJob();
        startProgressSimulation();
      }
    } else if (newStatus === "failed") {
      setState("failed");
      clearTimers();
      // Fail the render job
      failJob("Reel assembly failed. Please try again.");
      // Log failure with duration
      const durationMs = assemblyStartRef.current 
        ? Date.now() - assemblyStartRef.current 
        : undefined;
      logAssemblyTelemetry("failure", reelId, { 
        durationMs,
        reason: "status_changed_to_failed",
        retryCount,
      });
      assemblyStartRef.current = null;
    } else {
      // draft, ready, rendering = assembly complete
      setState("ready");
      setError(null);
      clearTimers();
      // Complete the render job
      completeJob();
      // Log success with duration
      const durationMs = assemblyStartRef.current 
        ? Date.now() - assemblyStartRef.current 
        : undefined;
      if (durationMs) {
        logAssemblyTelemetry("success", reelId, { durationMs, retryCount });
      }
      assemblyStartRef.current = null;
    }
    
    // Update React Query cache
    queryClient.invalidateQueries({ queryKey: ["reel", reelId] });
  }, [reelId, queryClient, clearTimers, retryCount, ensureRenderJob, startProgressSimulation, completeJob, failJob]);
  
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
    });
    
    console.warn("[ReelAssembly] Assembly timed out after 45s");
    
    // Fail the render job
    failJob("Reel assembly is taking longer than expected. Please try again.");
    
    try {
      // Update reel to failed status
      await updateReel(reelId, { status: "failed" });
      
      // Also update render_error via direct update
      await supabase
        .from("reels")
        .update({ 
          status: "failed",
          render_error: "Reel assembly is taking longer than expected. Please try again.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", reelId);
      
      if (mountedRef.current) {
        setState("failed");
        setError("Reel assembly is taking longer than expected. Please try again.");
        clearTimers();
        assemblyStartRef.current = null;
        queryClient.invalidateQueries({ queryKey: ["reel", reelId] });
      }
    } catch (err) {
      console.error("[ReelAssembly] Failed to update timeout status:", err);
    }
  }, [reelId, queryClient, clearTimers, retryCount, failJob]);
  
  // Poll for status as a backup mechanism
  const pollStatus = useCallback(async () => {
    if (!reelId || !mountedRef.current) return;
    
    try {
      const reel = await getReel(reelId);
      if (reel && mountedRef.current) {
        handleStatusChange(reel.status as ReelStatus);
      }
    } catch (err) {
      console.error("[ReelAssembly] Poll error:", err);
    }
  }, [reelId, handleStatusChange]);
  
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
          const newStatus = (payload.new as { status: ReelStatus })?.status;
          if (newStatus) {
            handleStatusChange(newStatus);
          }
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
      
      // Ensure render job exists for global queue visibility
      ensureRenderJob();
      startProgressSimulation();
      
      timeoutRef.current = window.setTimeout(failWithTimeout, ASSEMBLY_TIMEOUT_MS);
      
      // Also setup polling as backup (realtime might not always work)
      pollRef.current = window.setInterval(pollStatus, POLL_INTERVAL_MS);
    }
    
    return () => {
      mountedRef.current = false;
      clearTimers();
      supabase.removeChannel(channel);
    };
  }, [reelId, state, handleStatusChange, failWithTimeout, pollStatus, clearTimers, ensureRenderJob, startProgressSimulation]);
  
  // Sync state when initialStatus changes (e.g., from React Query refetch)
  useEffect(() => {
    const newState = getStateFromStatus(initialStatus);
    if (newState !== state && initialStatus) {
      console.log("[ReelAssembly] Syncing state from prop:", initialStatus, "->", newState);
      setState(newState);
      
      if (newState !== "assembling") {
        clearTimers();
      }
      
      if (initialStatus === "failed") {
        // Try to get the error message
        getReel(reelId!).then((reel) => {
          if (reel?.render_error && mountedRef.current) {
            setError(reel.render_error);
          }
        });
      }
    }
  }, [initialStatus, reelId, state, getStateFromStatus, clearTimers]);
  
  // Retry assembly
  const retry = useCallback(async () => {
    if (!reelId) return;
    
    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);
    
    logAssemblyTelemetry("retry", reelId, { retryCount: newRetryCount });
    
    console.log("[ReelAssembly] Retrying assembly, attempt:", newRetryCount);
    setState("assembling");
    setError(null);
    assemblyStartRef.current = Date.now();
    
    try {
      // Reset status to compiling - preserves format + selected moments
      await supabase
        .from("reels")
        .update({ 
          status: "compiling",
          render_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reelId);
      
      // Start timeout
      timeoutRef.current = window.setTimeout(failWithTimeout, ASSEMBLY_TIMEOUT_MS);
      pollRef.current = window.setInterval(pollStatus, POLL_INTERVAL_MS);
      
      // Simulate assembly completing (in production, this would be a backend job)
      // For now, we transition to draft after a short delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      await supabase
        .from("reels")
        .update({ 
          status: "draft",
          render_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reelId);
      
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
      
      setState("failed");
      setError("Something interrupted the assembly process. Please try again.");
      clearTimers();
      assemblyStartRef.current = null;
    }
  }, [reelId, queryClient, failWithTimeout, pollStatus, clearTimers, retryCount]);
  
  return {
    state,
    error,
    isAssembling: state === "assembling",
    isReady: state === "ready",
    canRetry: state === "failed",
    retryCount,
    retry,
  };
}
