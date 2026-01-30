/**
 * Video Frame Monitor Hook
 * 
 * Uses requestVideoFrameCallback (if available) to detect frame gaps
 * and camera stalls without changing user-visible behavior.
 * Falls back to timeupdate heuristics for unsupported browsers.
 */

import { useRef, useEffect, useCallback } from "react";
import { recordFrameGap, recordMetric } from "@/lib/performanceMetrics";

interface FrameMonitorOptions {
  /** The video element to monitor */
  videoElement: HTMLVideoElement | null;
  /** Whether monitoring is enabled */
  enabled: boolean;
  /** Threshold in ms to consider a frame gap significant (default: 100) */
  gapThreshold?: number;
  /** Callback when a significant gap is detected (for logging only) */
  onFrameGap?: (gapMs: number, frameNumber: number) => void;
}

interface FrameMonitorResult {
  /** Current estimated FPS based on recent frame timings */
  estimatedFPS: number;
  /** Number of significant frame gaps detected */
  gapCount: number;
  /** Largest gap detected in ms */
  maxGapMs: number;
  /** Total frames processed */
  frameCount: number;
  /** Whether the monitor is actively running */
  isMonitoring: boolean;
  /** Reset gap statistics */
  resetStats: () => void;
}

// Check if requestVideoFrameCallback is available
const hasRVFC = typeof HTMLVideoElement !== "undefined" && 
  "requestVideoFrameCallback" in HTMLVideoElement.prototype;

export function useVideoFrameMonitor({
  videoElement,
  enabled,
  gapThreshold = 100,
  onFrameGap,
}: FrameMonitorOptions): FrameMonitorResult {
  // Stats refs (avoid re-renders on every frame)
  const statsRef = useRef({
    estimatedFPS: 0,
    gapCount: 0,
    maxGapMs: 0,
    frameCount: 0,
    isMonitoring: false,
  });
  
  // Frame timing tracking
  const lastFrameTimeRef = useRef(0);
  const frameTimingsRef = useRef<number[]>([]);
  const callbackIdRef = useRef<number | null>(null);
  
  // Fallback interval for non-RVFC browsers
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const resetStats = useCallback(() => {
    statsRef.current = {
      estimatedFPS: 0,
      gapCount: 0,
      maxGapMs: 0,
      frameCount: 0,
      isMonitoring: statsRef.current.isMonitoring,
    };
    frameTimingsRef.current = [];
    lastFrameTimeRef.current = 0;
  }, []);
  
  // Process a frame timing
  const processFrame = useCallback((now: number) => {
    const stats = statsRef.current;
    const lastTime = lastFrameTimeRef.current;
    
    if (lastTime > 0) {
      const delta = now - lastTime;
      
      // Detect frame gap
      if (delta > gapThreshold) {
        stats.gapCount++;
        stats.maxGapMs = Math.max(stats.maxGapMs, delta);
        
        // Record metric for analytics
        recordFrameGap("capture:facecam" as any, delta);
        
        // Callback for logging (but no auto-recovery that would change UX)
        onFrameGap?.(delta, stats.frameCount);
        
        if (import.meta.env.DEV && delta > 200) {
          console.warn(`[FrameMonitor] Large gap: ${delta.toFixed(0)}ms at frame ${stats.frameCount}`);
        }
      }
      
      // Track for FPS estimation (rolling window of 30 frames)
      frameTimingsRef.current.push(delta);
      if (frameTimingsRef.current.length > 30) {
        frameTimingsRef.current.shift();
      }
      
      // Calculate estimated FPS from rolling average
      if (frameTimingsRef.current.length >= 5) {
        const avgDelta = frameTimingsRef.current.reduce((a, b) => a + b, 0) / frameTimingsRef.current.length;
        stats.estimatedFPS = Math.round(1000 / avgDelta);
      }
    }
    
    stats.frameCount++;
    lastFrameTimeRef.current = now;
  }, [gapThreshold, onFrameGap]);
  
  // RVFC callback handler
  const rvfcCallback = useCallback((now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => {
    if (!statsRef.current.isMonitoring) return;
    
    processFrame(now);
    
    // Schedule next frame
    if (videoElement && statsRef.current.isMonitoring) {
      callbackIdRef.current = (videoElement as any).requestVideoFrameCallback(rvfcCallback);
    }
  }, [videoElement, processFrame]);
  
  // Start/stop monitoring
  useEffect(() => {
    if (!enabled || !videoElement) {
      // Stop monitoring
      statsRef.current.isMonitoring = false;
      
      if (callbackIdRef.current !== null && hasRVFC && videoElement) {
        (videoElement as any).cancelVideoFrameCallback(callbackIdRef.current);
        callbackIdRef.current = null;
      }
      
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
      
      return;
    }
    
    // Start monitoring
    statsRef.current.isMonitoring = true;
    resetStats();
    
    if (hasRVFC) {
      // Use requestVideoFrameCallback for accurate frame timing
      callbackIdRef.current = (videoElement as any).requestVideoFrameCallback(rvfcCallback);
      
      if (import.meta.env.DEV) {
        console.log("[FrameMonitor] Using requestVideoFrameCallback");
      }
    } else {
      // Fallback: use timeupdate events + interval for estimation
      // This is less accurate but works everywhere
      let lastTimeUpdate = 0;
      
      const handleTimeUpdate = () => {
        const now = performance.now();
        if (lastTimeUpdate > 0) {
          processFrame(now);
        }
        lastTimeUpdate = now;
      };
      
      videoElement.addEventListener("timeupdate", handleTimeUpdate);
      
      // Also use a periodic check for non-playing video (like preview)
      fallbackIntervalRef.current = setInterval(() => {
        if (videoElement.readyState >= 2 && !videoElement.paused) {
          processFrame(performance.now());
        }
      }, 100);
      
      if (import.meta.env.DEV) {
        console.log("[FrameMonitor] Using timeupdate fallback");
      }
      
      return () => {
        videoElement.removeEventListener("timeupdate", handleTimeUpdate);
        if (fallbackIntervalRef.current) {
          clearInterval(fallbackIntervalRef.current);
          fallbackIntervalRef.current = null;
        }
      };
    }
    
    return () => {
      statsRef.current.isMonitoring = false;
      
      if (callbackIdRef.current !== null && hasRVFC && videoElement) {
        try {
          (videoElement as any).cancelVideoFrameCallback(callbackIdRef.current);
        } catch (e) {
          // Ignore errors during cleanup
        }
        callbackIdRef.current = null;
      }
      
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };
  }, [enabled, videoElement, rvfcCallback, processFrame, resetStats]);
  
  // Return current stats (reading from ref for performance)
  return {
    estimatedFPS: statsRef.current.estimatedFPS,
    gapCount: statsRef.current.gapCount,
    maxGapMs: statsRef.current.maxGapMs,
    frameCount: statsRef.current.frameCount,
    isMonitoring: statsRef.current.isMonitoring,
    resetStats,
  };
}
