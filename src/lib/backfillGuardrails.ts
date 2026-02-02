/**
 * Backfill Guardrails
 * 
 * Performance guardrails for legacy ReelSource backfill operations.
 * Ensures backfill NEVER impacts live recording or gameplay performance.
 * 
 * Rules:
 * 1) Backfill runs at low priority (requestIdleCallback)
 * 2) Never executes during active capture
 * 3) Pauses if system load is high
 * 4) Strictly post-recording, post-playback only
 */

import { getHealthState, subscribeToHealth, CaptureHealthState } from "./captureHealth";
import { scheduleIdle, cancelIdle } from "./scheduler";
import { getMemoryStats } from "./memoryGuard";

// ============= Types =============

export interface BackfillGuardrailState {
  /** Whether backfill is currently allowed */
  isAllowed: boolean;
  /** Reason why backfill is blocked (null if allowed) */
  blockedReason: string | null;
  /** Whether an active capture is in progress */
  isCaptureActive: boolean;
  /** Whether system load is too high */
  isHighLoad: boolean;
  /** Whether video playback is active */
  isPlaybackActive: boolean;
}

export type BackfillPriority = "low" | "deferred";

// ============= State =============

let isCaptureActive = false;
let isPlaybackActive = false;
let currentHealthState: CaptureHealthState | null = null;
let healthUnsubscribe: (() => void) | null = null;

// Pending backfill jobs (deferred due to guardrails)
interface PendingBackfillJob {
  id: string;
  sessionId: string;
  execute: () => Promise<void>;
  scheduledHandle: number | null;
}

const pendingJobs = new Map<string, PendingBackfillJob>();

// ============= Configuration =============

/** Minimum idle time before backfill can start (ms) */
const MIN_IDLE_TIME_MS = 2000;

/** Memory pressure threshold that blocks backfill */
const MEMORY_PRESSURE_THRESHOLD = "high";

/** How often to retry deferred backfill (ms) */
const DEFERRED_RETRY_INTERVAL_MS = 5000;

// ============= Core Functions =============

/**
 * Initialize guardrails monitoring
 * Should be called once at app startup
 */
export function initBackfillGuardrails(): void {
  // Subscribe to health state changes
  if (!healthUnsubscribe) {
    healthUnsubscribe = subscribeToHealth((state) => {
      currentHealthState = state;
    });
  }
  
  console.log("[BackfillGuardrails] Initialized");
}

/**
 * Cleanup guardrails monitoring
 */
export function cleanupBackfillGuardrails(): void {
  if (healthUnsubscribe) {
    healthUnsubscribe();
    healthUnsubscribe = null;
  }
  
  // Cancel all pending jobs
  pendingJobs.forEach((job) => {
    if (job.scheduledHandle !== null) {
      cancelIdle(job.scheduledHandle);
    }
  });
  pendingJobs.clear();
}

/**
 * Mark that a capture session has started
 * This blocks ALL backfill operations
 */
export function markCaptureStarted(): void {
  isCaptureActive = true;
  console.log("[BackfillGuardrails] Capture started - backfill blocked");
  
  // Pause all pending backfill jobs
  pendingJobs.forEach((job) => {
    if (job.scheduledHandle !== null) {
      cancelIdle(job.scheduledHandle);
      job.scheduledHandle = null;
      console.log(`[BackfillGuardrails] Paused backfill job ${job.id}`);
    }
  });
}

/**
 * Mark that a capture session has ended
 * This may resume deferred backfill operations
 */
export function markCaptureEnded(): void {
  isCaptureActive = false;
  console.log("[BackfillGuardrails] Capture ended - backfill may resume");
  
  // Schedule deferred jobs to retry
  scheduleIdle(() => {
    resumeDeferredJobs();
  }, { timeout: MIN_IDLE_TIME_MS });
}

/**
 * Mark that video playback has started
 * This blocks backfill to avoid competing for resources
 */
export function markPlaybackStarted(): void {
  isPlaybackActive = true;
  console.log("[BackfillGuardrails] Playback started - backfill blocked");
}

/**
 * Mark that video playback has ended
 */
export function markPlaybackEnded(): void {
  isPlaybackActive = false;
  console.log("[BackfillGuardrails] Playback ended - backfill may resume");
  
  // Schedule deferred jobs to retry
  scheduleIdle(() => {
    resumeDeferredJobs();
  }, { timeout: 500 });
}

/**
 * Get current guardrail state
 */
export function getGuardrailState(): BackfillGuardrailState {
  const memoryStats = getMemoryStats();
  const isHighMemoryPressure = memoryStats 
    ? (memoryStats.pressureLevel === "critical" || memoryStats.pressureLevel === "elevated")
    : false;
  const isHighCPULoad = currentHealthState?.mode === "minimal";
  
  const isHighLoad = isHighMemoryPressure || isHighCPULoad;
  
  let blockedReason: string | null = null;
  
  if (isCaptureActive) {
    blockedReason = "Active recording in progress";
  } else if (isPlaybackActive) {
    blockedReason = "Video playback in progress";
  } else if (isHighLoad) {
    if (isHighMemoryPressure) {
      blockedReason = "High memory pressure";
    } else {
      blockedReason = "High system load";
    }
  }
  
  return {
    isAllowed: blockedReason === null,
    blockedReason,
    isCaptureActive,
    isHighLoad,
    isPlaybackActive,
  };
}

/**
 * Check if backfill is currently allowed
 */
export function isBackfillAllowed(): boolean {
  return getGuardrailState().isAllowed;
}

/**
 * Wait for backfill to be allowed
 * Returns immediately if already allowed, otherwise waits
 * 
 * @param maxWaitMs - Maximum time to wait (default 30s)
 * @returns true if allowed, false if timed out
 */
export async function waitForBackfillAllowed(maxWaitMs: number = 30_000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    if (isBackfillAllowed()) {
      return true;
    }
    
    // Wait a bit before checking again
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  
  return false;
}

/**
 * Execute a backfill task with guardrails
 * 
 * @param sessionId - Session being backfilled
 * @param task - The backfill task to execute
 * @param priority - "low" runs during idle, "deferred" waits for optimal conditions
 * @returns Promise that resolves when backfill completes or is deferred
 */
export async function executeWithGuardrails<T>(
  sessionId: string,
  task: () => Promise<T>,
  priority: BackfillPriority = "low"
): Promise<{ success: boolean; result?: T; deferred: boolean; reason?: string }> {
  const jobId = `backfill-${sessionId}-${Date.now()}`;
  
  // Check guardrails
  const state = getGuardrailState();
  
  if (!state.isAllowed) {
    console.log(`[BackfillGuardrails] Backfill blocked for ${sessionId}: ${state.blockedReason}`);
    
    if (priority === "deferred") {
      // Store for later execution
      return new Promise((resolve) => {
        const job: PendingBackfillJob = {
          id: jobId,
          sessionId,
          execute: async () => {
            try {
              const result = await task();
              resolve({ success: true, result, deferred: true });
            } catch (error) {
              resolve({ 
                success: false, 
                deferred: true, 
                reason: error instanceof Error ? error.message : "Unknown error" 
              });
            } finally {
              pendingJobs.delete(jobId);
            }
          },
          scheduledHandle: null,
        };
        
        pendingJobs.set(jobId, job);
        console.log(`[BackfillGuardrails] Deferred backfill for ${sessionId}`);
        
        // Try again after delay
        scheduleRetry(job);
      });
    }
    
    // Low priority - just report blocked
    return {
      success: false,
      deferred: false,
      reason: state.blockedReason || "Backfill not allowed",
    };
  }
  
  // Execute with idle callback for low priority
  return new Promise((resolve) => {
    const handle = scheduleIdle(async () => {
      // Double-check guardrails before executing
      if (!isBackfillAllowed()) {
        console.log(`[BackfillGuardrails] Backfill preempted for ${sessionId}`);
        resolve({
          success: false,
          deferred: false,
          reason: "Backfill preempted by higher priority task",
        });
        return;
      }
      
      console.log(`[BackfillGuardrails] Executing backfill for ${sessionId}`);
      
      try {
        const result = await task();
        resolve({ success: true, result, deferred: false });
      } catch (error) {
        console.error(`[BackfillGuardrails] Backfill failed for ${sessionId}:`, error);
        resolve({
          success: false,
          deferred: false,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }, { timeout: MIN_IDLE_TIME_MS });
    
    // Track the handle for potential cancellation
    const tempJob: PendingBackfillJob = {
      id: jobId,
      sessionId,
      execute: async () => {},
      scheduledHandle: handle,
    };
    pendingJobs.set(jobId, tempJob);
  });
}

// ============= Internal Helpers =============

function scheduleRetry(job: PendingBackfillJob): void {
  job.scheduledHandle = scheduleIdle(() => {
    if (isBackfillAllowed()) {
      console.log(`[BackfillGuardrails] Resuming deferred backfill ${job.id}`);
      job.execute();
    } else {
      // Try again later
      setTimeout(() => scheduleRetry(job), DEFERRED_RETRY_INTERVAL_MS);
    }
  }, { timeout: DEFERRED_RETRY_INTERVAL_MS });
}

function resumeDeferredJobs(): void {
  if (!isBackfillAllowed()) return;
  
  pendingJobs.forEach((job) => {
    if (job.scheduledHandle === null) {
      console.log(`[BackfillGuardrails] Scheduling deferred job ${job.id}`);
      scheduleRetry(job);
    }
  });
}

/**
 * Wrap a backfill function with guardrails
 * Convenience helper for common use case
 */
export function withGuardrails<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  getSessionId: (...args: Parameters<T>) => string,
  priority: BackfillPriority = "low"
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  return async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    const sessionId = getSessionId(...args);
    
    const result = await executeWithGuardrails(
      sessionId,
      () => fn(...args),
      priority
    );
    
    if (!result.success) {
      throw new Error(result.reason || "Backfill failed");
    }
    
    return result.result as Awaited<ReturnType<T>>;
  };
}
