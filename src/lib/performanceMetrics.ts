/**
 * Lightweight Performance Instrumentation for Vantage
 * 
 * Tracks key performance metrics across:
 * - Capture pipeline (facecam, background removal, compositing)
 * - Thumbnail generation
 * - Playback startup and scrubbing
 * - Library rendering
 */

type MetricCategory = 
  | "capture:facecam"
  | "capture:background-removal"
  | "capture:composite"
  | "capture:recorder"
  | "thumbnail:generate"
  | "thumbnail:load"
  | "playback:startup"
  | "playback:seek"
  | "library:render";

interface MetricEntry {
  category: MetricCategory;
  duration: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface FrameMetrics {
  frameCount: number;
  totalDuration: number;
  minDuration: number;
  maxDuration: number;
  droppedFrames: number;
}

// Rolling buffer for recent metrics
const MAX_ENTRIES = 100;
const metrics: MetricEntry[] = [];
const frameMetrics: Map<MetricCategory, FrameMetrics> = new Map();

// Active timers for async operations
const activeTimers: Map<string, number> = new Map();

/**
 * Start timing an operation
 */
export function startTiming(key: string): void {
  activeTimers.set(key, performance.now());
}

/**
 * End timing and record the metric
 */
export function endTiming(
  key: string, 
  category: MetricCategory, 
  metadata?: Record<string, unknown>
): number {
  const startTime = activeTimers.get(key);
  if (startTime === undefined) {
    console.warn(`[Perf] No start time found for: ${key}`);
    return 0;
  }
  
  activeTimers.delete(key);
  const duration = performance.now() - startTime;
  
  recordMetric(category, duration, metadata);
  return duration;
}

/**
 * Record a metric directly (when you already have the duration)
 */
export function recordMetric(
  category: MetricCategory, 
  duration: number, 
  metadata?: Record<string, unknown>
): void {
  const entry: MetricEntry = {
    category,
    duration,
    timestamp: Date.now(),
    metadata,
  };
  
  metrics.push(entry);
  
  // Maintain rolling buffer
  if (metrics.length > MAX_ENTRIES) {
    metrics.shift();
  }
  
  // Update frame-level aggregates for high-frequency categories
  if (category.includes("background-removal") || category.includes("composite")) {
    updateFrameMetrics(category, duration);
  }
}

/**
 * Update running frame-level statistics
 */
function updateFrameMetrics(category: MetricCategory, duration: number): void {
  const existing = frameMetrics.get(category) || {
    frameCount: 0,
    totalDuration: 0,
    minDuration: Infinity,
    maxDuration: 0,
    droppedFrames: 0,
  };
  
  existing.frameCount++;
  existing.totalDuration += duration;
  existing.minDuration = Math.min(existing.minDuration, duration);
  existing.maxDuration = Math.max(existing.maxDuration, duration);
  
  // Consider a frame "dropped" if it took longer than 2 frame budgets (66ms for 30fps)
  if (duration > 66) {
    existing.droppedFrames++;
  }
  
  frameMetrics.set(category, existing);
}

/**
 * Get average duration for a category
 */
export function getAverageDuration(category: MetricCategory): number {
  const categoryMetrics = metrics.filter(m => m.category === category);
  if (categoryMetrics.length === 0) return 0;
  
  const total = categoryMetrics.reduce((sum, m) => sum + m.duration, 0);
  return total / categoryMetrics.length;
}

/**
 * Get frame-level statistics for high-frequency operations
 */
export function getFrameStats(category: MetricCategory): FrameMetrics | null {
  return frameMetrics.get(category) || null;
}

/**
 * Get performance summary for all tracked categories
 */
export function getPerformanceSummary(): Record<MetricCategory, {
  count: number;
  avgDuration: number;
  maxDuration: number;
  droppedFrames?: number;
}> {
  const summary: Record<string, {
    count: number;
    avgDuration: number;
    maxDuration: number;
    droppedFrames?: number;
  }> = {};
  
  // Group metrics by category
  const grouped = new Map<MetricCategory, MetricEntry[]>();
  for (const entry of metrics) {
    const existing = grouped.get(entry.category) || [];
    existing.push(entry);
    grouped.set(entry.category, existing);
  }
  
  // Calculate stats for each category
  for (const [category, entries] of grouped) {
    const total = entries.reduce((sum, e) => sum + e.duration, 0);
    const max = Math.max(...entries.map(e => e.duration));
    const frameStats = frameMetrics.get(category);
    
    summary[category] = {
      count: entries.length,
      avgDuration: total / entries.length,
      maxDuration: max,
      droppedFrames: frameStats?.droppedFrames,
    };
  }
  
  return summary as Record<MetricCategory, typeof summary[string]>;
}

/**
 * Log performance summary to console
 */
export function logPerformanceSummary(): void {
  const summary = getPerformanceSummary();
  
  console.group("[Vantage Performance Summary]");
  
  for (const [category, stats] of Object.entries(summary)) {
    const droppedInfo = stats.droppedFrames !== undefined 
      ? `, dropped: ${stats.droppedFrames}` 
      : "";
    console.log(
      `${category}: avg=${stats.avgDuration.toFixed(2)}ms, ` +
      `max=${stats.maxDuration.toFixed(2)}ms, ` +
      `count=${stats.count}${droppedInfo}`
    );
  }
  
  console.groupEnd();
}

/**
 * Reset all metrics (useful for testing/debugging)
 */
export function resetMetrics(): void {
  metrics.length = 0;
  frameMetrics.clear();
  activeTimers.clear();
}

/**
 * Export metrics as JSON for external analysis
 */
export function exportMetrics(): string {
  return JSON.stringify({
    metrics,
    frameMetrics: Object.fromEntries(frameMetrics),
    summary: getPerformanceSummary(),
  }, null, 2);
}

/**
 * Utility: measure an async operation
 */
export async function measureAsync<T>(
  category: MetricCategory,
  operation: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const start = performance.now();
  try {
    return await operation();
  } finally {
    const duration = performance.now() - start;
    recordMetric(category, duration, metadata);
  }
}

/**
 * Utility: measure a sync operation
 */
export function measureSync<T>(
  category: MetricCategory,
  operation: () => T,
  metadata?: Record<string, unknown>
): T {
  const start = performance.now();
  try {
    return operation();
  } finally {
    const duration = performance.now() - start;
    recordMetric(category, duration, metadata);
  }
}

/**
 * Create a FPS counter for continuous monitoring
 */
export function createFPSCounter(label: string): {
  tick: () => void;
  getFPS: () => number;
  reset: () => void;
} {
  let frameCount = 0;
  let lastTime = performance.now();
  let currentFPS = 0;
  
  return {
    tick: () => {
      frameCount++;
      const now = performance.now();
      const elapsed = now - lastTime;
      
      // Calculate FPS every second
      if (elapsed >= 1000) {
        currentFPS = Math.round((frameCount * 1000) / elapsed);
        frameCount = 0;
        lastTime = now;
        
        // Log if FPS drops below target
        if (currentFPS < 24) {
          console.warn(`[Perf] ${label} FPS dropped to ${currentFPS}`);
        }
      }
    },
    getFPS: () => currentFPS,
    reset: () => {
      frameCount = 0;
      lastTime = performance.now();
      currentFPS = 0;
    },
  };
}
