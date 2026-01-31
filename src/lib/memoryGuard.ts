/**
 * Memory Guard for Long Recordings
 * 
 * Monitors heap usage and provides signals to pause non-essential
 * background tasks when memory pressure is detected.
 * 
 * Features:
 * - Polls memory usage at configurable intervals
 * - Notifies subscribers when entering/leaving pressure state
 * - Provides API to pause/resume non-essential work
 * - Works silently (no user-visible changes)
 */

// Memory thresholds
const PRESSURE_THRESHOLD = 0.70;  // 70% heap = light pressure
const CRITICAL_THRESHOLD = 0.85;  // 85% heap = critical pressure
const POLL_INTERVAL_MS = 5000;    // Check every 5 seconds
const FAST_POLL_INTERVAL_MS = 1000; // Check every 1 second under pressure

export type MemoryPressureLevel = "normal" | "elevated" | "critical";

export interface MemoryStats {
  usedHeapMB: number;
  totalHeapMB: number;
  limitHeapMB: number;
  usageRatio: number;
  pressureLevel: MemoryPressureLevel;
}

type PressureCallback = (level: MemoryPressureLevel, stats: MemoryStats) => void;

// Singleton state
let isMonitoring = false;
let pollIntervalId: ReturnType<typeof setInterval> | null = null;
let currentLevel: MemoryPressureLevel = "normal";
const subscribers = new Set<PressureCallback>();

// Queued non-essential tasks
let nonEssentialTasksPaused = false;
const deferredTasks: (() => void)[] = [];
const MAX_DEFERRED_TASKS = 100;

/**
 * Get current memory statistics
 * Returns null if memory API is not available (non-Chrome browsers)
 */
export function getMemoryStats(): MemoryStats | null {
  const memory = (performance as any).memory;
  
  if (!memory) {
    return null;
  }
  
  const usedHeapMB = memory.usedJSHeapSize / (1024 * 1024);
  const totalHeapMB = memory.totalJSHeapSize / (1024 * 1024);
  const limitHeapMB = memory.jsHeapSizeLimit / (1024 * 1024);
  const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
  
  let pressureLevel: MemoryPressureLevel = "normal";
  if (usageRatio >= CRITICAL_THRESHOLD) {
    pressureLevel = "critical";
  } else if (usageRatio >= PRESSURE_THRESHOLD) {
    pressureLevel = "elevated";
  }
  
  return {
    usedHeapMB,
    totalHeapMB,
    limitHeapMB,
    usageRatio,
    pressureLevel,
  };
}

/**
 * Check memory and notify subscribers if pressure level changed
 */
function checkMemory(): void {
  const stats = getMemoryStats();
  
  if (!stats) {
    return; // Memory API not available
  }
  
  const previousLevel = currentLevel;
  currentLevel = stats.pressureLevel;
  
  // Update non-essential task pausing
  if (currentLevel === "critical" && !nonEssentialTasksPaused) {
    nonEssentialTasksPaused = true;
    console.log("[MemoryGuard] Critical pressure - pausing non-essential tasks");
  } else if (currentLevel === "normal" && nonEssentialTasksPaused) {
    nonEssentialTasksPaused = false;
    console.log("[MemoryGuard] Pressure relieved - resuming non-essential tasks");
    flushDeferredTasks();
  }
  
  // Notify on level change
  if (currentLevel !== previousLevel) {
    console.log(`[MemoryGuard] Pressure level: ${previousLevel} → ${currentLevel} (${(stats.usageRatio * 100).toFixed(1)}%)`);
    
    for (const callback of subscribers) {
      try {
        callback(currentLevel, stats);
      } catch (e) {
        console.warn("[MemoryGuard] Subscriber callback error:", e);
      }
    }
  }
  
  // Adjust polling frequency based on pressure
  if (pollIntervalId) {
    const expectedInterval = currentLevel === "normal" ? POLL_INTERVAL_MS : FAST_POLL_INTERVAL_MS;
    // We don't dynamically change interval to keep it simple
  }
}

/**
 * Flush deferred tasks when pressure is relieved
 */
function flushDeferredTasks(): void {
  const tasksToRun = deferredTasks.splice(0);
  
  if (tasksToRun.length > 0) {
    console.log(`[MemoryGuard] Flushing ${tasksToRun.length} deferred tasks`);
    
    // Run tasks using requestIdleCallback or setTimeout
    const scheduler = window.requestIdleCallback || ((cb: () => void) => setTimeout(cb, 0));
    
    for (const task of tasksToRun) {
      scheduler(() => {
        try {
          task();
        } catch (e) {
          console.warn("[MemoryGuard] Deferred task error:", e);
        }
      });
    }
  }
}

/**
 * Start memory monitoring
 */
export function startMemoryMonitoring(): void {
  if (isMonitoring) return;
  
  // Check if memory API is available
  if (!(performance as any).memory) {
    console.log("[MemoryGuard] Memory API not available - monitoring disabled");
    return;
  }
  
  isMonitoring = true;
  
  // Initial check
  checkMemory();
  
  // Start polling
  pollIntervalId = setInterval(checkMemory, POLL_INTERVAL_MS);
  console.log("[MemoryGuard] Memory monitoring started");
}

/**
 * Stop memory monitoring
 */
export function stopMemoryMonitoring(): void {
  if (!isMonitoring) return;
  
  isMonitoring = false;
  
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
  
  // Reset state
  currentLevel = "normal";
  nonEssentialTasksPaused = false;
  deferredTasks.length = 0;
  
  console.log("[MemoryGuard] Memory monitoring stopped");
}

/**
 * Subscribe to memory pressure changes
 */
export function onMemoryPressure(callback: PressureCallback): () => void {
  subscribers.add(callback);
  
  // Immediately notify of current state
  const stats = getMemoryStats();
  if (stats) {
    callback(currentLevel, stats);
  }
  
  return () => subscribers.delete(callback);
}

/**
 * Get current pressure level
 */
export function getCurrentPressureLevel(): MemoryPressureLevel {
  return currentLevel;
}

/**
 * Check if non-essential tasks should be paused
 */
export function shouldPauseNonEssential(): boolean {
  return nonEssentialTasksPaused;
}

/**
 * Schedule a non-essential task that can be deferred under memory pressure
 * 
 * @param task - The task to run
 * @param options - Configuration options
 * @returns true if task was run immediately, false if deferred
 */
export function scheduleNonEssential(
  task: () => void,
  options?: { priority?: "low" | "normal" }
): boolean {
  if (!nonEssentialTasksPaused) {
    // Run immediately using requestIdleCallback
    const scheduler = window.requestIdleCallback || ((cb: () => void) => setTimeout(cb, 0));
    scheduler(task);
    return true;
  }
  
  // Defer the task
  if (deferredTasks.length < MAX_DEFERRED_TASKS) {
    deferredTasks.push(task);
  } else {
    // Queue is full - drop lowest priority tasks
    console.warn("[MemoryGuard] Deferred task queue full - task dropped");
  }
  
  return false;
}

/**
 * Run a task only if not under memory pressure
 * Returns a promise that resolves when the task completes
 */
export async function runWhenNotPressured<T>(
  task: () => T | Promise<T>,
  timeout = 30000
): Promise<T> {
  if (!nonEssentialTasksPaused) {
    return task();
  }
  
  // Wait for pressure to be relieved
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      unsubscribe();
      reject(new Error("Timeout waiting for memory pressure to be relieved"));
    }, timeout);
    
    const unsubscribe = onMemoryPressure((level) => {
      if (level === "normal") {
        clearTimeout(timeoutId);
        unsubscribe();
        
        // Run the task
        try {
          const result = task();
          if (result instanceof Promise) {
            result.then(resolve).catch(reject);
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(e);
        }
      }
    });
  });
}

/**
 * Force garbage collection hint
 * Note: This doesn't actually force GC, just helps the browser know we're done with objects
 */
export function hintGarbageCollection(): void {
  // Clear any accumulated weak references
  if (typeof gc === "function") {
    // V8 exposes gc() when run with --expose-gc flag (development only)
    (gc as () => void)();
    console.log("[MemoryGuard] Forced garbage collection");
  }
}
