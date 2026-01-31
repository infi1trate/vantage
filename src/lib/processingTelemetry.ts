/**
 * Processing Telemetry
 * 
 * Lightweight instrumentation for tracking key processing milestones.
 * Logs timestamps for:
 * - Stop click -> Library route rendered
 * - Job created -> job complete
 * - Thumbnail ready time
 * 
 * Also provides CPU load heuristics for adaptive processing.
 */

import { mark, measure, recordMetric, MetricCategory } from "./performanceMetrics";

// ============= Types =============

export interface ProcessingMilestones {
  stopClickTime?: number;
  libraryRenderedTime?: number;
  jobCreatedTime?: number;
  jobCompletedTime?: number;
  thumbnailReadyTime?: number;
  localSaveTime?: number;
  cloudUploadStartTime?: number;
  cloudUploadEndTime?: number;
}

interface JobTelemetry {
  jobId: string;
  sessionId: string;
  milestones: ProcessingMilestones;
  progressUpdates: number;
}

// ============= State =============

const jobTelemetry: Map<string, JobTelemetry> = new Map();
let lastCaptureStopTime: number | null = null;
let lastLibraryRenderTime: number | null = null;

// CPU load heuristics
let recentFrameTimes: number[] = [];
const MAX_FRAME_SAMPLES = 30;
let estimatedCPULoad: "low" | "medium" | "high" = "low";
let lastCPUCheckTime = 0;
const CPU_CHECK_INTERVAL = 1000; // Check every second

// ============= Capture Stop -> Library Timing =============

/**
 * Mark when user clicks stop recording
 */
export function markCaptureStop(): void {
  lastCaptureStopTime = performance.now();
  mark("capture:stop");
  
  if (import.meta.env.DEV) {
    console.log("[Telemetry] Capture stopped at", new Date().toISOString());
  }
}

/**
 * Mark when library page is rendered (call from Library component)
 */
export function markLibraryRendered(): void {
  lastLibraryRenderTime = performance.now();
  mark("library:rendered");
  
  // If we have a recent capture stop, measure the transition
  if (lastCaptureStopTime) {
    const duration = lastLibraryRenderTime - lastCaptureStopTime;
    
    recordMetric("library:render" as MetricCategory, duration, {
      event: "capture-to-library",
    });
    
    if (import.meta.env.DEV) {
      console.log(`[Telemetry] Stop -> Library: ${duration.toFixed(0)}ms`);
    }
    
    // Only use the measurement once
    lastCaptureStopTime = null;
  }
}

// ============= Job Lifecycle Telemetry =============

/**
 * Start tracking a new processing job
 */
export function trackJobCreated(jobId: string, sessionId: string): void {
  const now = performance.now();
  
  jobTelemetry.set(jobId, {
    jobId,
    sessionId,
    milestones: {
      jobCreatedTime: now,
    },
    progressUpdates: 0,
  });
  
  mark(`job:${jobId}:created`);
  
  if (import.meta.env.DEV) {
    console.log(`[Telemetry] Job created: ${jobId}`);
  }
}

/**
 * Track local save completion
 */
export function trackLocalSaveComplete(jobId: string): void {
  const telemetry = jobTelemetry.get(jobId);
  if (telemetry) {
    telemetry.milestones.localSaveTime = performance.now();
    
    if (telemetry.milestones.jobCreatedTime) {
      const duration = telemetry.milestones.localSaveTime - telemetry.milestones.jobCreatedTime;
      
      if (import.meta.env.DEV) {
        console.log(`[Telemetry] Job ${jobId} local save: ${duration.toFixed(0)}ms`);
      }
    }
  }
}

/**
 * Track thumbnail generation
 */
export function trackThumbnailReady(jobId: string): void {
  const telemetry = jobTelemetry.get(jobId);
  if (telemetry) {
    telemetry.milestones.thumbnailReadyTime = performance.now();
    
    if (telemetry.milestones.jobCreatedTime) {
      const duration = telemetry.milestones.thumbnailReadyTime - telemetry.milestones.jobCreatedTime;
      
      recordMetric("thumbnail:generate" as MetricCategory, duration, {
        jobId,
        event: "processing-thumbnail",
      });
      
      if (import.meta.env.DEV) {
        console.log(`[Telemetry] Job ${jobId} thumbnail ready: ${duration.toFixed(0)}ms`);
      }
    }
  }
}

/**
 * Track cloud upload start
 */
export function trackCloudUploadStart(jobId: string): void {
  const telemetry = jobTelemetry.get(jobId);
  if (telemetry) {
    telemetry.milestones.cloudUploadStartTime = performance.now();
  }
}

/**
 * Track cloud upload end
 */
export function trackCloudUploadEnd(jobId: string): void {
  const telemetry = jobTelemetry.get(jobId);
  if (telemetry) {
    telemetry.milestones.cloudUploadEndTime = performance.now();
    
    if (telemetry.milestones.cloudUploadStartTime) {
      const duration = telemetry.milestones.cloudUploadEndTime - telemetry.milestones.cloudUploadStartTime;
      
      if (import.meta.env.DEV) {
        console.log(`[Telemetry] Job ${jobId} cloud upload: ${duration.toFixed(0)}ms`);
      }
    }
  }
}

/**
 * Track job completion
 */
export function trackJobCompleted(jobId: string, success: boolean): void {
  const telemetry = jobTelemetry.get(jobId);
  if (telemetry) {
    telemetry.milestones.jobCompletedTime = performance.now();
    
    if (telemetry.milestones.jobCreatedTime) {
      const totalDuration = telemetry.milestones.jobCompletedTime - telemetry.milestones.jobCreatedTime;
      
      // Log to console in dev
      if (import.meta.env.DEV) {
        console.log(
          `[Telemetry] Job ${jobId} ${success ? "completed" : "failed"}: ${totalDuration.toFixed(0)}ms total`,
          {
            progressUpdates: telemetry.progressUpdates,
            milestones: telemetry.milestones,
          }
        );
      }
      
      // Record as metric
      recordMetric("library:render" as MetricCategory, totalDuration, {
        event: success ? "job-complete" : "job-failed",
        jobId,
        progressUpdates: telemetry.progressUpdates,
      });
    }
    
    // Clean up after a delay (keep for debugging)
    setTimeout(() => {
      jobTelemetry.delete(jobId);
    }, 60000);
  }
}

/**
 * Track a progress update (for throttle metrics)
 */
export function trackProgressUpdate(jobId: string): void {
  const telemetry = jobTelemetry.get(jobId);
  if (telemetry) {
    telemetry.progressUpdates++;
  }
}

// ============= Progress Update Throttling =============

interface ThrottleState {
  lastUpdate: number;
  minInterval: number;
}

const throttleStates: Map<string, ThrottleState> = new Map();

/**
 * Create a throttled progress updater
 * Max 4 updates per second = 250ms minimum interval
 */
export function createThrottledUpdater(
  jobId: string,
  onUpdate: (progress: number, step: string) => void,
  maxUpdatesPerSecond = 4
): (progress: number, step: string, force?: boolean) => void {
  const minInterval = 1000 / maxUpdatesPerSecond;
  
  throttleStates.set(jobId, {
    lastUpdate: 0,
    minInterval,
  });
  
  return (progress: number, step: string, force = false) => {
    const state = throttleStates.get(jobId);
    if (!state) return;
    
    const now = performance.now();
    const elapsed = now - state.lastUpdate;
    
    // Force update for significant progress changes or step changes
    const shouldForce = force || progress === 0 || progress >= 100;
    
    if (elapsed >= state.minInterval || shouldForce) {
      state.lastUpdate = now;
      trackProgressUpdate(jobId);
      onUpdate(progress, step);
    }
  };
}

/**
 * Clean up throttle state for a job
 */
export function cleanupThrottle(jobId: string): void {
  throttleStates.delete(jobId);
}

// ============= CPU Load Heuristics =============

/**
 * Record a frame processing time for CPU load estimation
 */
export function recordFrameTime(frameTimeMs: number): void {
  recentFrameTimes.push(frameTimeMs);
  
  if (recentFrameTimes.length > MAX_FRAME_SAMPLES) {
    recentFrameTimes.shift();
  }
  
  // Only recalculate periodically
  const now = performance.now();
  if (now - lastCPUCheckTime > CPU_CHECK_INTERVAL) {
    lastCPUCheckTime = now;
    updateCPULoadEstimate();
  }
}

function updateCPULoadEstimate(): void {
  if (recentFrameTimes.length < 5) {
    estimatedCPULoad = "low";
    return;
  }
  
  const avgFrameTime = recentFrameTimes.reduce((a, b) => a + b, 0) / recentFrameTimes.length;
  const maxFrameTime = Math.max(...recentFrameTimes);
  
  // Heuristics based on frame times
  // 30fps budget = 33.33ms, 60fps budget = 16.67ms
  if (avgFrameTime > 50 || maxFrameTime > 100) {
    estimatedCPULoad = "high";
  } else if (avgFrameTime > 30 || maxFrameTime > 60) {
    estimatedCPULoad = "medium";
  } else {
    estimatedCPULoad = "low";
  }
  
  if (import.meta.env.DEV && estimatedCPULoad === "high") {
    console.warn(`[Telemetry] High CPU load detected: avg=${avgFrameTime.toFixed(1)}ms, max=${maxFrameTime.toFixed(1)}ms`);
  }
}

/**
 * Get current CPU load estimate
 */
export function getCPULoadEstimate(): "low" | "medium" | "high" {
  return estimatedCPULoad;
}

/**
 * Check if processing should be paused due to high CPU
 */
export function shouldPauseForCPU(): boolean {
  return estimatedCPULoad === "high";
}

/**
 * Reset CPU load tracking (call when capture ends)
 */
export function resetCPUTracking(): void {
  recentFrameTimes = [];
  estimatedCPULoad = "low";
  lastCPUCheckTime = 0;
}

// ============= Camera Preview State =============

let isCameraPreviewActive = false;

/**
 * Set camera preview state
 */
export function setCameraPreviewActive(active: boolean): void {
  isCameraPreviewActive = active;
  
  if (import.meta.env.DEV) {
    console.log(`[Telemetry] Camera preview: ${active ? "ACTIVE" : "INACTIVE"}`);
  }
  
  // Reset CPU tracking when camera preview ends
  if (!active) {
    resetCPUTracking();
  }
}

/**
 * Check if camera preview is active
 */
export function isCameraPreview(): boolean {
  return isCameraPreviewActive;
}

/**
 * Check if heavy processing should be paused
 * (camera preview active AND high CPU detected)
 */
export function shouldPauseHeavyProcessing(): boolean {
  return isCameraPreviewActive && shouldPauseForCPU();
}

// ============= Summary & Debug =============

/**
 * Get all job telemetry (for debugging)
 */
export function getJobTelemetry(): Map<string, JobTelemetry> {
  return new Map(jobTelemetry);
}

/**
 * Get summary stats
 */
export function getTelemetrySummary(): {
  activeJobs: number;
  cpuLoad: "low" | "medium" | "high";
  cameraPreviewActive: boolean;
  shouldPause: boolean;
} {
  return {
    activeJobs: jobTelemetry.size,
    cpuLoad: estimatedCPULoad,
    cameraPreviewActive: isCameraPreviewActive,
    shouldPause: shouldPauseHeavyProcessing(),
  };
}

// ============= Dev Exports =============

if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as any).__vantageTelemetry = {
    getJobTelemetry,
    getTelemetrySummary,
    getCPULoadEstimate,
    shouldPauseForCPU,
    shouldPauseHeavyProcessing,
  };
}
