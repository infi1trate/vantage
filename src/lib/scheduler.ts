/**
 * Task Scheduler Utilities
 * 
 * Provides scheduling primitives for non-blocking task execution.
 * Uses requestIdleCallback when available, with appropriate fallbacks.
 */

// Note: IdleDeadline and IdleRequestCallback types may be defined elsewhere
// We use type augmentation only if needed

type IdleCallbackFn = (deadline: { didTimeout: boolean; timeRemaining(): number }) => void;

/**
 * Check if requestIdleCallback is available
 */
export const hasIdleCallback = typeof window !== "undefined" && 
  typeof window.requestIdleCallback === "function";

/**
 * Schedule a callback to run when the browser is idle
 * Falls back to setTimeout(0) when requestIdleCallback is unavailable
 */
export function scheduleIdle(
  callback: () => void,
  options?: { timeout?: number }
): number {
  if (hasIdleCallback) {
    return window.requestIdleCallback!(() => callback(), options);
  }
  
  // Fallback: use setTimeout with 0 delay
  // This yields to the event loop but runs ASAP
  return window.setTimeout(callback, 0) as unknown as number;
}

/**
 * Cancel a scheduled idle callback
 */
export function cancelIdle(handle: number): void {
  if (hasIdleCallback) {
    window.cancelIdleCallback!(handle);
  } else {
    window.clearTimeout(handle);
  }
}

/**
 * Schedule a callback to run on the next animation frame
 * Useful for visual updates
 */
export function scheduleFrame(callback: FrameRequestCallback): number {
  return requestAnimationFrame(callback);
}

/**
 * Run a task with deadline awareness
 * Returns true if task completed, false if it should be rescheduled
 */
export type DeadlineTask = (timeRemaining: () => number) => boolean;

/**
 * Run tasks in chunks during idle time
 * Automatically reschedules if time runs out
 */
export function runChunkedTasks(
  tasks: DeadlineTask[],
  onComplete?: () => void
): () => void {
  let index = 0;
  let cancelled = false;
  
  function processTasks(deadline?: IdleDeadline) {
    if (cancelled) return;
    
    const timeRemaining = deadline 
      ? () => deadline.timeRemaining()
      : () => 16; // Assume 16ms budget in fallback
    
    // Process tasks while we have time
    while (index < tasks.length && timeRemaining() > 0) {
      const completed = tasks[index](timeRemaining);
      if (completed) {
        index++;
      } else {
        // Task needs more time, reschedule
        break;
      }
    }
    
    // Check if done
    if (index >= tasks.length) {
      onComplete?.();
    } else {
      // Reschedule remaining tasks
      scheduleIdle(() => processTasks());
    }
  }
  
  // Start processing
  scheduleIdle(() => processTasks());
  
  // Return cancel function
  return () => {
    cancelled = true;
  };
}

/**
 * Create a debounced function that uses requestIdleCallback
 * The function will run when idle after the debounce period
 */
export function debounceIdle<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): T {
  let timeoutId: number | null = null;
  let idleId: number | null = null;
  
  return ((...args: Parameters<T>) => {
    // Clear previous timeout
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
    if (idleId !== null) {
      cancelIdle(idleId);
    }
    
    // Set new timeout
    timeoutId = window.setTimeout(() => {
      // Schedule to run during idle
      idleId = scheduleIdle(() => fn(...args));
    }, delay);
  }) as T;
}

/**
 * Create a throttled function that respects idle time
 * Will not run more than once per interval, and prefers idle time
 */
export function throttleIdle<T extends (...args: any[]) => void>(
  fn: T,
  interval: number
): T {
  let lastRun = 0;
  let pendingArgs: Parameters<T> | null = null;
  let scheduled = false;
  
  return ((...args: Parameters<T>) => {
    const now = performance.now();
    
    if (now - lastRun >= interval) {
      // Run immediately
      lastRun = now;
      fn(...args);
    } else {
      // Schedule for later
      pendingArgs = args;
      
      if (!scheduled) {
        scheduled = true;
        const remaining = interval - (now - lastRun);
        
        window.setTimeout(() => {
          scheduled = false;
          if (pendingArgs !== null) {
            lastRun = performance.now();
            fn(...pendingArgs);
            pendingArgs = null;
          }
        }, remaining);
      }
    }
  }) as T;
}
