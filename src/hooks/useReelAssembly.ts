/**
 * Reel Assembly Hook
 * 
 * Manages the reel assembly lifecycle with:
 * - Real-time subscription to reel status changes
 * - 45-second timeout fail-safe
 * - Retry mechanism for failed assembly
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

export type AssemblyState = "idle" | "assembling" | "ready" | "failed";

const ASSEMBLY_TIMEOUT_MS = 45_000; // 45 seconds max
const POLL_INTERVAL_MS = 2_000; // Poll every 2s as backup

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
  
  /** Retry assembly function */
  retry: () => Promise<void>;
}

/**
 * Subscribe to reel status changes and handle assembly lifecycle
 */
export function useReelAssembly(
  reelId: string | undefined,
  initialStatus: ReelStatus | undefined
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
  
  const timeoutRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  
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
  }, []);
  
  // Handle status update from any source
  const handleStatusChange = useCallback((newStatus: ReelStatus) => {
    if (!mountedRef.current) return;
    
    console.log("[ReelAssembly] Status changed:", newStatus);
    
    if (newStatus === "compiling") {
      setState("assembling");
      setError(null);
    } else if (newStatus === "failed") {
      setState("failed");
      clearTimers();
    } else {
      // draft, ready, rendering = assembly complete
      setState("ready");
      setError(null);
      clearTimers();
    }
    
    // Update React Query cache
    queryClient.invalidateQueries({ queryKey: ["reel", reelId] });
  }, [reelId, queryClient, clearTimers]);
  
  // Fail the assembly with timeout
  const failWithTimeout = useCallback(async () => {
    if (!reelId || !mountedRef.current) return;
    
    console.warn("[ReelAssembly] Assembly timed out after 45s");
    
    try {
      // Update reel to failed status
      await updateReel(reelId, { status: "failed" });
      
      // Also update render_error via direct update
      await supabase
        .from("reels")
        .update({ 
          status: "failed",
          render_error: "Reel assembly is taking longer than expected.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", reelId);
      
      if (mountedRef.current) {
        setState("failed");
        setError("Reel assembly is taking longer than expected.");
        clearTimers();
        queryClient.invalidateQueries({ queryKey: ["reel", reelId] });
      }
    } catch (err) {
      console.error("[ReelAssembly] Failed to update timeout status:", err);
    }
  }, [reelId, queryClient, clearTimers]);
  
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
      timeoutRef.current = window.setTimeout(failWithTimeout, ASSEMBLY_TIMEOUT_MS);
      
      // Also setup polling as backup (realtime might not always work)
      pollRef.current = window.setInterval(pollStatus, POLL_INTERVAL_MS);
    }
    
    return () => {
      mountedRef.current = false;
      clearTimers();
      supabase.removeChannel(channel);
    };
  }, [reelId, state, handleStatusChange, failWithTimeout, pollStatus, clearTimers]);
  
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
    
    console.log("[ReelAssembly] Retrying assembly");
    setState("assembling");
    setError(null);
    
    try {
      // Reset status to compiling
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
      setState("failed");
      setError("Failed to retry assembly. Please try again.");
      clearTimers();
    }
  }, [reelId, queryClient, failWithTimeout, pollStatus, clearTimers]);
  
  return {
    state,
    error,
    isAssembling: state === "assembling",
    isReady: state === "ready",
    canRetry: state === "failed",
    retry,
  };
}
