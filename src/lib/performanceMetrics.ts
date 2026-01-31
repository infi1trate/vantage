/**
 * Lightweight Performance Instrumentation for Vantage
 * 
 * Provides mark/measure API, rolling averages, dev-only logging,
 * and optional telemetry support for tracking:
 * - Capture pipeline (facecam, screen, compositing, recorder)
 * - Thumbnail generation and loading
 * - Playback startup and scrubbing
 * - Frame continuity and dropped frames
 */

// ============= Types =============

export type MetricCategory = 
  | "capture:facecam"
  | "capture:facecam:first-frame"
  | "capture:facecam:frame-gap"
  | "capture:screen"
  | "capture:screen:first-frame"
  | "capture:background-removal"
  | "capture:composite"
  | "capture:recorder"
  | "capture:recorder:first-data"
  | "thumbnail:generate"
  | "thumbnail:load"
  | "thumbnail:queue"
  | "thumbnail:cache-hit"
  | "thumbnail:cache-miss"
  | "thumbnail:cache-store"
  | "playback:startup"
  | "playback:metadata"
  | "playback:first-frame"
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
  lastFrameTime: number;
  maxFrameGap: number;
}

interface RollingAverage {
  values: number[];
  maxSize: number;
  sum: number;
}

interface PerformanceMark {
  name: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// ============= Configuration =============

const IS_DEV = import.meta.env.DEV;
const MAX_ENTRIES = 100;
const ROLLING_WINDOW_SIZE = 30;

// Frame budget thresholds (in ms)
const FRAME_BUDGET_30FPS = 33.33;
const FRAME_BUDGET_60FPS = 16.67;
const DROPPED_FRAME_THRESHOLD = 66; // 2x 30fps budget

// ============= State =============

const metrics: MetricEntry[] = [];
const frameMetrics: Map<MetricCategory, FrameMetrics> = new Map();
const rollingAverages: Map<MetricCategory, RollingAverage> = new Map();
const performanceMarks: Map<string, PerformanceMark> = new Map();
const activeTimers: Map<string, number> = new Map();

// Live stats for dev overlay
let currentCaptureFPS = 0;
let droppedFrameWarnings: string[] = [];
let thumbnailQueueDepth = 0;

// Subscribers for live updates
type StatsSubscriber = (stats: LiveStats) => void;
const statsSubscribers: Set<StatsSubscriber> = new Set();

export interface LiveStats {
  captureFPS: number;
  droppedFrameWarnings: string[];
  thumbnailQueueDepth: number;
  recentMetrics: MetricEntry[];
}

// ============= Mark/Measure API =============

/**
 * Create a performance mark (like performance.mark but internal)
 */
export function mark(name: string, metadata?: Record<string, unknown>): void {
  performanceMarks.set(name, {
    name,
    timestamp: performance.now(),
    metadata,
  });
  
  if (IS_DEV) {
    console.debug(`[Perf] Mark: ${name}`);
  }
}

/**
 * Measure time between two marks
 */
export function measure(
  name: string,
  startMark: string,
  endMark?: string,
  category?: MetricCategory
): number {
  const start = performanceMarks.get(startMark);
  if (!start) {
    if (IS_DEV) {
      console.warn(`[Perf] Start mark not found: ${startMark}`);
    }
    return 0;
  }
  
  const endTime = endMark 
    ? performanceMarks.get(endMark)?.timestamp ?? performance.now()
    : performance.now();
  
  const duration = endTime - start.timestamp;
  
  if (IS_DEV) {
    console.debug(`[Perf] Measure: ${name} = ${duration.toFixed(2)}ms`);
  }
  
  // Record as metric if category provided
  if (category) {
    recordMetric(category, duration, { measureName: name, ...start.metadata });
  }
  
  // Clean up marks
  performanceMarks.delete(startMark);
  if (endMark) {
    performanceMarks.delete(endMark);
  }
  
  return duration;
}

/**
 * Clear a mark without measuring (cleanup)
 */
export function clearMark(name: string): void {
  performanceMarks.delete(name);
}

// ============= Timer API (existing) =============

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
    if (IS_DEV) {
      console.warn(`[Perf] No start time found for: ${key}`);
    }
    return 0;
  }
  
  activeTimers.delete(key);
  const duration = performance.now() - startTime;
  
  recordMetric(category, duration, metadata);
  return duration;
}

// ============= Metric Recording =============

/**
 * Record a metric with optional dev logging
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
  
  // Update rolling average
  updateRollingAverage(category, duration);
  
  // Update frame-level aggregates for high-frequency categories
  if (isHighFrequencyCategory(category)) {
    updateFrameMetrics(category, duration);
  }
  
  // Dev logging for significant metrics
  if (IS_DEV && shouldLogMetric(category, duration)) {
    console.log(
      `[Perf] ${category}: ${duration.toFixed(2)}ms`,
      metadata ? metadata : ""
    );
  }
  
  // Notify subscribers
  notifySubscribers();
}

function isHighFrequencyCategory(category: MetricCategory): boolean {
  return category.includes("background-removal") || 
         category.includes("composite") ||
         category.includes("frame");
}

function shouldLogMetric(category: MetricCategory, duration: number): boolean {
  // Log slow operations
  if (duration > 100) return true;
  
  // Log startup/significant events
  if (category.includes("startup") || 
      category.includes("first-frame") ||
      category.includes("first-data")) {
    return true;
  }
  
  return false;
}

// ============= Rolling Averages =============

function updateRollingAverage(category: MetricCategory, duration: number): void {
  let rolling = rollingAverages.get(category);
  
  if (!rolling) {
    rolling = {
      values: [],
      maxSize: ROLLING_WINDOW_SIZE,
      sum: 0,
    };
    rollingAverages.set(category, rolling);
  }
  
  rolling.values.push(duration);
  rolling.sum += duration;
  
  // Remove oldest if over limit
  if (rolling.values.length > rolling.maxSize) {
    const removed = rolling.values.shift()!;
    rolling.sum -= removed;
  }
}

/**
 * Get rolling average for a category
 */
export function getRollingAverage(category: MetricCategory): number {
  const rolling = rollingAverages.get(category);
  if (!rolling || rolling.values.length === 0) return 0;
  return rolling.sum / rolling.values.length;
}

/**
 * Get rolling statistics for a category
 */
export function getRollingStats(category: MetricCategory): {
  avg: number;
  min: number;
  max: number;
  count: number;
} | null {
  const rolling = rollingAverages.get(category);
  if (!rolling || rolling.values.length === 0) return null;
  
  return {
    avg: rolling.sum / rolling.values.length,
    min: Math.min(...rolling.values),
    max: Math.max(...rolling.values),
    count: rolling.values.length,
  };
}

// ============= Frame Metrics & Continuity =============

function updateFrameMetrics(category: MetricCategory, duration: number): void {
  const now = performance.now();
  let existing = frameMetrics.get(category);
  
  if (!existing) {
    existing = {
      frameCount: 0,
      totalDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      droppedFrames: 0,
      lastFrameTime: now,
      maxFrameGap: 0,
    };
  }
  
  // Calculate frame gap for continuity detection
  const frameGap = now - existing.lastFrameTime;
  existing.maxFrameGap = Math.max(existing.maxFrameGap, frameGap);
  existing.lastFrameTime = now;
  
  existing.frameCount++;
  existing.totalDuration += duration;
  existing.minDuration = Math.min(existing.minDuration, duration);
  existing.maxDuration = Math.max(existing.maxDuration, duration);
  
  // Detect dropped frames (frame took > 2x budget)
  if (duration > DROPPED_FRAME_THRESHOLD) {
    existing.droppedFrames++;
    
    // Add warning for dev overlay
    const warning = `${category}: ${duration.toFixed(0)}ms @ ${new Date().toLocaleTimeString()}`;
    droppedFrameWarnings.push(warning);
    
    // Keep only last 10 warnings
    if (droppedFrameWarnings.length > 10) {
      droppedFrameWarnings.shift();
    }
  }
  
  frameMetrics.set(category, existing);
}

/**
 * Record a frame gap (for continuity detection)
 */
export function recordFrameGap(category: MetricCategory, gapMs: number): void {
  if (gapMs > 100) { // Gap > 100ms is significant
    recordMetric("capture:facecam:frame-gap" as MetricCategory, gapMs, {
      category,
      significant: gapMs > 200,
    });
    
    if (IS_DEV && gapMs > 200) {
      console.warn(`[Perf] Large frame gap detected: ${gapMs.toFixed(0)}ms in ${category}`);
    }
  }
}

/**
 * Get frame-level statistics
 */
export function getFrameStats(category: MetricCategory): FrameMetrics | null {
  return frameMetrics.get(category) || null;
}

// ============= FPS Counter =============

/**
 * Create a FPS counter for continuous monitoring
 */
export function createFPSCounter(label: string): {
  tick: () => void;
  getFPS: () => number;
  reset: () => void;
  getDroppedFrames: () => number;
} {
  let frameCount = 0;
  let lastTime = performance.now();
  let currentFPS = 0;
  let droppedFrames = 0;
  let lastFrameTime = performance.now();
  
  return {
    tick: () => {
      const now = performance.now();
      const frameDelta = now - lastFrameTime;
      lastFrameTime = now;
      
      // Detect dropped frame
      if (frameDelta > DROPPED_FRAME_THRESHOLD) {
        droppedFrames++;
      }
      
      frameCount++;
      const elapsed = now - lastTime;
      
      // Calculate FPS every second
      if (elapsed >= 1000) {
        currentFPS = Math.round((frameCount * 1000) / elapsed);
        frameCount = 0;
        lastTime = now;
        
        // Update global stats for overlay
        currentCaptureFPS = currentFPS;
        notifySubscribers();
        
        // Log if FPS drops below target
        if (IS_DEV && currentFPS < 24) {
          console.warn(`[Perf] ${label} FPS dropped to ${currentFPS}`);
        }
      }
    },
    getFPS: () => currentFPS,
    reset: () => {
      frameCount = 0;
      lastTime = performance.now();
      lastFrameTime = performance.now();
      currentFPS = 0;
      droppedFrames = 0;
    },
    getDroppedFrames: () => droppedFrames,
  };
}

// ============= Thumbnail Queue Tracking =============

/**
 * Update thumbnail queue depth (for monitoring)
 */
export function setThumbnailQueueDepth(depth: number): void {
  thumbnailQueueDepth = depth;
  notifySubscribers();
}

/**
 * Increment/decrement thumbnail queue
 */
export function adjustThumbnailQueue(delta: number): void {
  thumbnailQueueDepth = Math.max(0, thumbnailQueueDepth + delta);
  notifySubscribers();
}

// ============= Live Stats Subscription =============

/**
 * Subscribe to live stats updates (for dev overlay)
 */
export function subscribeToStats(callback: StatsSubscriber): () => void {
  statsSubscribers.add(callback);
  
  // Immediately call with current stats
  callback(getLiveStats());
  
  // Return unsubscribe function
  return () => {
    statsSubscribers.delete(callback);
  };
}

function notifySubscribers(): void {
  if (statsSubscribers.size === 0) return;
  
  const stats = getLiveStats();
  for (const subscriber of statsSubscribers) {
    subscriber(stats);
  }
}

/**
 * Get current live stats
 */
export function getLiveStats(): LiveStats {
  return {
    captureFPS: currentCaptureFPS,
    droppedFrameWarnings: [...droppedFrameWarnings],
    thumbnailQueueDepth,
    recentMetrics: metrics.slice(-10),
  };
}

// ============= Summary & Export =============

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
 * Get performance summary for all tracked categories
 */
export function getPerformanceSummary(): Record<string, {
  count: number;
  avgDuration: number;
  maxDuration: number;
  rollingAvg: number;
  droppedFrames?: number;
}> {
  const summary: Record<string, {
    count: number;
    avgDuration: number;
    maxDuration: number;
    rollingAvg: number;
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
    const rollingAvg = getRollingAverage(category);
    
    summary[category] = {
      count: entries.length,
      avgDuration: total / entries.length,
      maxDuration: max,
      rollingAvg,
      droppedFrames: frameStats?.droppedFrames,
    };
  }
  
  return summary;
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
      `rolling=${stats.rollingAvg.toFixed(2)}ms, ` +
      `max=${stats.maxDuration.toFixed(2)}ms, ` +
      `count=${stats.count}${droppedInfo}`
    );
  }
  
  console.groupEnd();
}

/**
 * Reset all metrics
 */
export function resetMetrics(): void {
  metrics.length = 0;
  frameMetrics.clear();
  rollingAverages.clear();
  performanceMarks.clear();
  activeTimers.clear();
  droppedFrameWarnings.length = 0;
  thumbnailQueueDepth = 0;
  currentCaptureFPS = 0;
  notifySubscribers();
}

/**
 * Export metrics as JSON for external analysis
 */
export function exportMetrics(): string {
  return JSON.stringify({
    metrics,
    frameMetrics: Object.fromEntries(frameMetrics),
    rollingAverages: Object.fromEntries(
      Array.from(rollingAverages.entries()).map(([k, v]) => [k, {
        avg: v.sum / v.values.length,
        count: v.values.length,
      }])
    ),
    summary: getPerformanceSummary(),
    liveStats: getLiveStats(),
  }, null, 2);
}

// ============= Utility Functions =============

/**
 * Measure an async operation
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
 * Measure a sync operation
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

// ============= Dev-only Exports =============

// Expose to window for debugging (dev only)
if (IS_DEV && typeof window !== "undefined") {
  (window as any).__vantagePerf = {
    mark,
    measure,
    getPerformanceSummary,
    logPerformanceSummary,
    exportMetrics,
    resetMetrics,
    getLiveStats,
    getRollingStats,
    getFrameStats,
  };
}
