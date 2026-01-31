/**
 * Performance Budget System
 * 
 * Defines acceptable performance thresholds for key operations.
 * Used for regression detection in development and CI.
 * 
 * PERFORMANCE BUDGETS:
 * ====================
 * 
 * CAPTURE PIPELINE:
 * - Camera first-frame: ≤1500ms (permission + stream acquisition)
 * - Screen first-frame: ≤2000ms (includes picker UI)
 * - Background removal per-frame: ≤33ms (30fps budget)
 * - Composite per-frame: ≤16ms (60fps budget)
 * - Recorder first-data: ≤3000ms (includes codec negotiation)
 * 
 * PLAYBACK:
 * - Video detail open (metadata): ≤500ms
 * - First frame rendered: ≤1000ms
 * - Seek response: ≤100ms
 * - Scrub handler (per-frame): ≤16ms (no long tasks)
 * 
 * THUMBNAILS:
 * - First thumbnail shown: ≤200ms (from cache)
 * - Thumbnail generation: ≤100ms (worker)
 * - Cache hit: ≤10ms
 * 
 * LIBRARY:
 * - Initial render: ≤300ms
 * - Scroll frame: ≤16ms
 * 
 * LONG TASK LIMITS:
 * - Recording: ≤2 long tasks (>50ms) per minute
 * - Playback: ≤1 long task per seek
 * - Library scroll: 0 long tasks
 * 
 * CPU/MEMORY TARGETS (best-effort):
 * - Recording CPU: ≤60% sustained
 * - Recording memory growth: ≤50MB/minute
 * - Playback CPU: ≤30% sustained
 */

import { 
  getPerformanceSummary, 
  getFrameStats, 
  getRollingAverage,
  MetricCategory 
} from "./performanceMetrics";

// ============= Budget Definitions =============

export interface PerformanceBudget {
  /** Human-readable name */
  name: string;
  /** Associated metric category */
  category: MetricCategory;
  /** Maximum acceptable duration in ms */
  maxDuration: number;
  /** Maximum acceptable p95 in ms (optional) */
  maxP95?: number;
  /** Maximum dropped frames allowed (for frame-based metrics) */
  maxDroppedFrames?: number;
  /** Severity: 'warning' logs, 'error' fails tests */
  severity: "warning" | "error";
}

export const PERFORMANCE_BUDGETS: PerformanceBudget[] = [
  // Capture pipeline
  {
    name: "Camera First Frame",
    category: "capture:facecam:first-frame",
    maxDuration: 1500,
    severity: "warning",
  },
  {
    name: "Screen First Frame",
    category: "capture:screen:first-frame",
    maxDuration: 2000,
    severity: "warning",
  },
  {
    name: "Background Removal Frame",
    category: "capture:background-removal",
    maxDuration: 33, // 30fps budget
    maxP95: 50,
    maxDroppedFrames: 10,
    severity: "warning",
  },
  {
    name: "Composite Frame",
    category: "capture:composite",
    maxDuration: 16, // 60fps budget
    maxP95: 25,
    severity: "warning",
  },
  {
    name: "Recorder First Data",
    category: "capture:recorder:first-data",
    maxDuration: 3000,
    severity: "error",
  },
  
  // Playback
  {
    name: "Playback Startup",
    category: "playback:startup",
    maxDuration: 1000,
    severity: "warning",
  },
  {
    name: "Playback Metadata",
    category: "playback:metadata",
    maxDuration: 500,
    severity: "warning",
  },
  {
    name: "Playback First Frame",
    category: "playback:first-frame",
    maxDuration: 1000,
    severity: "warning",
  },
  {
    name: "Seek Response",
    category: "playback:seek",
    maxDuration: 100,
    maxP95: 200,
    severity: "warning",
  },
  
  // Thumbnails
  {
    name: "Thumbnail Generation",
    category: "thumbnail:generate",
    maxDuration: 100,
    severity: "warning",
  },
  {
    name: "Thumbnail Load",
    category: "thumbnail:load",
    maxDuration: 200,
    severity: "warning",
  },
  {
    name: "Thumbnail Cache Hit",
    category: "thumbnail:cache-hit",
    maxDuration: 10,
    severity: "warning",
  },
  
  // Library
  {
    name: "Library Render",
    category: "library:render",
    maxDuration: 300,
    severity: "warning",
  },
];

// ============= Budget Violation Detection =============

export interface BudgetViolation {
  budget: PerformanceBudget;
  actual: number;
  threshold: number;
  type: "duration" | "p95" | "dropped_frames";
  message: string;
}

/**
 * Check all budgets against current metrics
 * Returns list of violations (empty = all good)
 */
export function checkBudgets(): BudgetViolation[] {
  const violations: BudgetViolation[] = [];
  const summary = getPerformanceSummary();
  
  for (const budget of PERFORMANCE_BUDGETS) {
    const stats = summary[budget.category];
    if (!stats || stats.count === 0) continue;
    
    // Check max duration
    if (stats.maxDuration > budget.maxDuration) {
      violations.push({
        budget,
        actual: stats.maxDuration,
        threshold: budget.maxDuration,
        type: "duration",
        message: `${budget.name}: max ${stats.maxDuration.toFixed(0)}ms exceeds budget ${budget.maxDuration}ms`,
      });
    }
    
    // Check P95 if defined (approximated by rolling avg * 1.5)
    if (budget.maxP95 && stats.rollingAvg * 1.5 > budget.maxP95) {
      violations.push({
        budget,
        actual: stats.rollingAvg * 1.5,
        threshold: budget.maxP95,
        type: "p95",
        message: `${budget.name}: estimated P95 ${(stats.rollingAvg * 1.5).toFixed(0)}ms exceeds budget ${budget.maxP95}ms`,
      });
    }
    
    // Check dropped frames
    if (budget.maxDroppedFrames !== undefined && stats.droppedFrames !== undefined) {
      if (stats.droppedFrames > budget.maxDroppedFrames) {
        violations.push({
          budget,
          actual: stats.droppedFrames,
          threshold: budget.maxDroppedFrames,
          type: "dropped_frames",
          message: `${budget.name}: ${stats.droppedFrames} dropped frames exceeds budget ${budget.maxDroppedFrames}`,
        });
      }
    }
  }
  
  return violations;
}

/**
 * Check a specific metric category against its budget
 */
export function checkCategoryBudget(category: MetricCategory): BudgetViolation | null {
  const budget = PERFORMANCE_BUDGETS.find(b => b.category === category);
  if (!budget) return null;
  
  const summary = getPerformanceSummary();
  const stats = summary[category];
  if (!stats || stats.count === 0) return null;
  
  if (stats.maxDuration > budget.maxDuration) {
    return {
      budget,
      actual: stats.maxDuration,
      threshold: budget.maxDuration,
      type: "duration",
      message: `${budget.name}: ${stats.maxDuration.toFixed(0)}ms exceeds budget ${budget.maxDuration}ms`,
    };
  }
  
  return null;
}

// ============= Long Task Monitoring =============

const LONG_TASK_THRESHOLD = 50; // ms
let longTaskObserver: PerformanceObserver | null = null;
let longTaskCount = 0;
let longTaskCallbacks: Set<(count: number, duration: number) => void> = new Set();

/**
 * Start monitoring for long tasks (>50ms main thread blocks)
 */
export function startLongTaskMonitoring(): void {
  if (longTaskObserver) return;
  
  // Check for PerformanceObserver support
  if (typeof PerformanceObserver === "undefined") {
    if (import.meta.env.DEV) {
      console.log("[PerfBudget] PerformanceObserver not available - long task monitoring disabled");
    }
    return;
  }
  
  try {
    longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration >= LONG_TASK_THRESHOLD) {
          longTaskCount++;
          
          if (import.meta.env.DEV) {
            console.warn(`[PerfBudget] Long task detected: ${entry.duration.toFixed(0)}ms (total: ${longTaskCount})`);
          }
          
          // Notify callbacks
          for (const callback of longTaskCallbacks) {
            try {
              callback(longTaskCount, entry.duration);
            } catch (e) {
              // Ignore callback errors
            }
          }
        }
      }
    });
    
    longTaskObserver.observe({ entryTypes: ["longtask"] });
    
    if (import.meta.env.DEV) {
      console.log("[PerfBudget] Long task monitoring started");
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[PerfBudget] Failed to start long task monitoring:", e);
    }
  }
}

/**
 * Stop long task monitoring
 */
export function stopLongTaskMonitoring(): void {
  if (longTaskObserver) {
    longTaskObserver.disconnect();
    longTaskObserver = null;
  }
  longTaskCount = 0;
}

/**
 * Get current long task count
 */
export function getLongTaskCount(): number {
  return longTaskCount;
}

/**
 * Reset long task count
 */
export function resetLongTaskCount(): void {
  longTaskCount = 0;
}

/**
 * Subscribe to long task events
 */
export function onLongTask(callback: (count: number, duration: number) => void): () => void {
  longTaskCallbacks.add(callback);
  return () => longTaskCallbacks.delete(callback);
}

// ============= Assertions for Testing =============

/**
 * Assert that a metric is within budget
 * Throws if budget is exceeded (for use in tests)
 */
export function assertWithinBudget(category: MetricCategory): void {
  const violation = checkCategoryBudget(category);
  if (violation && violation.budget.severity === "error") {
    throw new Error(violation.message);
  }
}

/**
 * Assert no long tasks occurred
 * Throws if any long tasks were detected (for use in tests)
 */
export function assertNoLongTasks(): void {
  if (longTaskCount > 0) {
    throw new Error(`${longTaskCount} long tasks detected (>${LONG_TASK_THRESHOLD}ms)`);
  }
}

/**
 * Assert long tasks below threshold
 */
export function assertLongTasksBelow(max: number): void {
  if (longTaskCount > max) {
    throw new Error(`${longTaskCount} long tasks exceeds limit of ${max}`);
  }
}

// ============= Reporting =============

/**
 * Generate a budget compliance report
 */
export function generateBudgetReport(): string {
  const violations = checkBudgets();
  const summary = getPerformanceSummary();
  
  let report = "=== PERFORMANCE BUDGET REPORT ===\n\n";
  
  // Status
  if (violations.length === 0) {
    report += "✅ All budgets within limits\n\n";
  } else {
    const errors = violations.filter(v => v.budget.severity === "error");
    const warnings = violations.filter(v => v.budget.severity === "warning");
    
    report += `❌ ${errors.length} errors, ⚠️ ${warnings.length} warnings\n\n`;
    
    if (errors.length > 0) {
      report += "ERRORS:\n";
      for (const v of errors) {
        report += `  • ${v.message}\n`;
      }
      report += "\n";
    }
    
    if (warnings.length > 0) {
      report += "WARNINGS:\n";
      for (const v of warnings) {
        report += `  • ${v.message}\n`;
      }
      report += "\n";
    }
  }
  
  // Long tasks
  report += `Long Tasks: ${longTaskCount}\n\n`;
  
  // Summary table
  report += "METRIC SUMMARY:\n";
  for (const [category, stats] of Object.entries(summary)) {
    const budget = PERFORMANCE_BUDGETS.find(b => b.category === category);
    const status = budget 
      ? (stats.maxDuration <= budget.maxDuration ? "✓" : "✗")
      : "-";
    
    report += `  ${status} ${category}: avg=${stats.avgDuration.toFixed(1)}ms, max=${stats.maxDuration.toFixed(1)}ms, n=${stats.count}\n`;
  }
  
  return report;
}

/**
 * Log budget report to console (dev only)
 */
export function logBudgetReport(): void {
  if (import.meta.env.DEV) {
    console.log(generateBudgetReport());
  }
}

// ============= Auto-start in Development =============

// Automatically start long task monitoring in development
if (import.meta.env.DEV && typeof window !== "undefined") {
  // Delay start to avoid impacting app startup
  setTimeout(() => {
    startLongTaskMonitoring();
  }, 1000);
}
