/**
 * Capture Health Monitor
 * 
 * Real-time monitoring of capture pipeline health with automatic
 * performance mode degradation. Never interrupts recording; only
 * degrades optional features (live previews, effects).
 * 
 * Performance Modes:
 * - "high": Full effects, live preview enabled
 * - "balanced": Reduced effects, preview at lower fidelity
 * - "minimal": All optional effects disabled
 */

import { getMemoryStats, MemoryPressureLevel } from "./memoryGuard";
import { getRollingAverage, getFrameStats } from "./performanceMetrics";

// ============= Types =============

export type PerformanceMode = "high" | "balanced" | "minimal";

export interface CaptureHealthState {
  /** Current performance mode */
  mode: PerformanceMode;
  /** Current composite FPS */
  compositeFPS: number;
  /** Dropped frames in current session */
  droppedFrames: number;
  /** Dropped frames per minute (rolling) */
  droppedPerMinute: number;
  /** Average encoder delay in ms */
  encoderDelayMs: number;
  /** Memory pressure level */
  memoryPressure: MemoryPressureLevel;
  /** Whether live preview is recommended */
  livePreviewAllowed: boolean;
  /** Reason for current mode (for UI) */
  degradationReason: string | null;
  /** Timestamp of last health check */
  lastCheckAt: number;
}

export interface HealthThresholds {
  /** FPS below this triggers "balanced" mode */
  fpsWarning: number;
  /** FPS below this triggers "minimal" mode */
  fpsCritical: number;
  /** Dropped frames/min for "balanced" */
  droppedWarning: number;
  /** Dropped frames/min for "minimal" */
  droppedCritical: number;
  /** Encoder delay (ms) for "balanced" */
  encoderDelayWarning: number;
  /** Encoder delay (ms) for "minimal" */
  encoderDelayCritical: number;
}

// ============= Configuration =============

const DEFAULT_THRESHOLDS: HealthThresholds = {
  fpsWarning: 27,
  fpsCritical: 20,
  droppedWarning: 3,
  droppedCritical: 6,
  encoderDelayWarning: 500,
  encoderDelayCritical: 1000,
};

const CHECK_INTERVAL_MS = 1000; // Check every second
const RECOVERY_DELAY_MS = 5000; // Wait 5s of good health before upgrading mode

// ============= State =============

let isMonitoring = false;
let checkIntervalId: ReturnType<typeof setInterval> | null = null;
let currentState: CaptureHealthState = createInitialState();
let thresholds: HealthThresholds = { ...DEFAULT_THRESHOLDS };
let lastModeDowngrade = 0;
let sessionStartTime = 0;
let sessionDroppedFrames = 0;

// Subscribers
type HealthSubscriber = (state: CaptureHealthState) => void;
const subscribers = new Set<HealthSubscriber>();

// ============= Core Functions =============

function createInitialState(): CaptureHealthState {
  return {
    mode: "high",
    compositeFPS: 30,
    droppedFrames: 0,
    droppedPerMinute: 0,
    encoderDelayMs: 0,
    memoryPressure: "normal",
    livePreviewAllowed: true,
    degradationReason: null,
    lastCheckAt: Date.now(),
  };
}

/**
 * Start monitoring capture health
 */
export function startHealthMonitoring(customThresholds?: Partial<HealthThresholds>): void {
  if (isMonitoring) return;
  
  // Apply custom thresholds
  if (customThresholds) {
    thresholds = { ...DEFAULT_THRESHOLDS, ...customThresholds };
  }
  
  isMonitoring = true;
  sessionStartTime = Date.now();
  sessionDroppedFrames = 0;
  currentState = createInitialState();
  
  // Start periodic health checks
  checkIntervalId = setInterval(checkHealth, CHECK_INTERVAL_MS);
  
  if (import.meta.env.DEV) {
    console.log("[CaptureHealth] Monitoring started");
  }
}

/**
 * Stop monitoring capture health
 */
export function stopHealthMonitoring(): void {
  if (!isMonitoring) return;
  
  isMonitoring = false;
  
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
  }
  
  if (import.meta.env.DEV) {
    console.log("[CaptureHealth] Monitoring stopped");
  }
}

/**
 * Get current health state
 */
export function getHealthState(): CaptureHealthState {
  return { ...currentState };
}

/**
 * Subscribe to health state changes
 */
export function subscribeToHealth(callback: HealthSubscriber): () => void {
  subscribers.add(callback);
  callback(currentState); // Immediate callback with current state
  return () => subscribers.delete(callback);
}

/**
 * Report a dropped frame (called by capture pipeline)
 */
export function reportDroppedFrame(): void {
  sessionDroppedFrames++;
}

/**
 * Report encoder delay (called by MediaRecorder ondataavailable)
 */
let lastEncoderDelays: number[] = [];
export function reportEncoderDelay(delayMs: number): void {
  lastEncoderDelays.push(delayMs);
  // Keep rolling window of 10
  if (lastEncoderDelays.length > 10) {
    lastEncoderDelays.shift();
  }
}

/**
 * Report current composite FPS (called by composite loop)
 */
let lastFPSReports: number[] = [];
export function reportCompositeFPS(fps: number): void {
  lastFPSReports.push(fps);
  if (lastFPSReports.length > 5) {
    lastFPSReports.shift();
  }
}

// ============= Health Check Logic =============

function checkHealth(): void {
  const now = Date.now();
  
  // Gather metrics
  const avgFPS = lastFPSReports.length > 0
    ? lastFPSReports.reduce((a, b) => a + b, 0) / lastFPSReports.length
    : 30;
  
  const avgEncoderDelay = lastEncoderDelays.length > 0
    ? lastEncoderDelays.reduce((a, b) => a + b, 0) / lastEncoderDelays.length
    : 0;
  
  const sessionMinutes = Math.max(1, (now - sessionStartTime) / 60000);
  const droppedPerMinute = sessionDroppedFrames / sessionMinutes;
  
  const memoryStats = getMemoryStats();
  const memoryPressure = memoryStats?.pressureLevel ?? "normal";
  
  // Determine performance mode
  let newMode: PerformanceMode = "high";
  let degradationReason: string | null = null;
  
  // Check critical conditions first (minimal mode)
  if (avgFPS < thresholds.fpsCritical) {
    newMode = "minimal";
    degradationReason = `Low FPS (${avgFPS.toFixed(0)})`;
  } else if (droppedPerMinute >= thresholds.droppedCritical) {
    newMode = "minimal";
    degradationReason = `High frame drops (${droppedPerMinute.toFixed(1)}/min)`;
  } else if (avgEncoderDelay >= thresholds.encoderDelayCritical) {
    newMode = "minimal";
    degradationReason = `Encoder delay (${avgEncoderDelay.toFixed(0)}ms)`;
  } else if (memoryPressure === "critical") {
    newMode = "minimal";
    degradationReason = "Memory pressure";
  }
  // Check warning conditions (balanced mode)
  else if (avgFPS < thresholds.fpsWarning) {
    newMode = "balanced";
    degradationReason = `FPS below target (${avgFPS.toFixed(0)})`;
  } else if (droppedPerMinute >= thresholds.droppedWarning) {
    newMode = "balanced";
    degradationReason = `Frame drops (${droppedPerMinute.toFixed(1)}/min)`;
  } else if (avgEncoderDelay >= thresholds.encoderDelayWarning) {
    newMode = "balanced";
    degradationReason = `Encoder delay (${avgEncoderDelay.toFixed(0)}ms)`;
  } else if (memoryPressure === "elevated") {
    newMode = "balanced";
    degradationReason = "Memory pressure";
  }
  
  // Apply hysteresis: don't upgrade mode too quickly
  const currentModeIndex = modeIndex(currentState.mode);
  const newModeIndex = modeIndex(newMode);
  
  if (newModeIndex < currentModeIndex) {
    // Downgrade immediately
    lastModeDowngrade = now;
  } else if (newModeIndex > currentModeIndex) {
    // Only upgrade if we've been stable for RECOVERY_DELAY_MS
    if (now - lastModeDowngrade < RECOVERY_DELAY_MS) {
      newMode = currentState.mode;
      degradationReason = currentState.degradationReason;
    }
  }
  
  // Update state
  const previousMode = currentState.mode;
  currentState = {
    mode: newMode,
    compositeFPS: avgFPS,
    droppedFrames: sessionDroppedFrames,
    droppedPerMinute,
    encoderDelayMs: avgEncoderDelay,
    memoryPressure,
    livePreviewAllowed: newMode !== "minimal",
    degradationReason,
    lastCheckAt: now,
  };
  
  // Log mode changes
  if (previousMode !== newMode && import.meta.env.DEV) {
    console.log(`[CaptureHealth] Mode: ${previousMode} → ${newMode}`, degradationReason);
  }
  
  // Notify subscribers
  for (const callback of subscribers) {
    try {
      callback(currentState);
    } catch (e) {
      console.warn("[CaptureHealth] Subscriber error:", e);
    }
  }
}

function modeIndex(mode: PerformanceMode): number {
  switch (mode) {
    case "minimal": return 0;
    case "balanced": return 1;
    case "high": return 2;
  }
}

// ============= System Capability Detection =============

const CAPABILITY_STORAGE_KEY = "vantage:systemCapability";

export type SystemCapability = "high" | "medium" | "low" | "unknown";

export interface SystemCapabilityResult {
  capability: SystemCapability;
  recommendedMode: PerformanceMode;
  livePreviewDefault: boolean;
  benchmarkScore: number;
  detectedAt: number;
}

/**
 * Get cached system capability or "unknown"
 */
export function getCachedCapability(): SystemCapabilityResult | null {
  try {
    const stored = localStorage.getItem(CAPABILITY_STORAGE_KEY);
    if (!stored) return null;
    
    const result = JSON.parse(stored) as SystemCapabilityResult;
    
    // Expire after 7 days
    if (Date.now() - result.detectedAt > 7 * 24 * 60 * 60 * 1000) {
      return null;
    }
    
    return result;
  } catch {
    return null;
  }
}

/**
 * Run a quick benchmark to detect system capability
 * Uses requestAnimationFrame loop to measure frame budget
 */
export async function detectSystemCapability(): Promise<SystemCapabilityResult> {
  // Check cache first
  const cached = getCachedCapability();
  if (cached) return cached;
  
  // Run benchmark: measure how fast we can run a tight loop
  const frames: number[] = [];
  const startTime = performance.now();
  const benchmarkDuration = 500; // 500ms benchmark
  
  return new Promise((resolve) => {
    let lastFrame = startTime;
    
    function measureFrame() {
      const now = performance.now();
      frames.push(now - lastFrame);
      lastFrame = now;
      
      if (now - startTime < benchmarkDuration) {
        requestAnimationFrame(measureFrame);
      } else {
        // Calculate results
        const avgFrameTime = frames.reduce((a, b) => a + b, 0) / frames.length;
        const estimatedFPS = 1000 / avgFrameTime;
        
        // Add CPU core count and memory as factors
        const cores = navigator.hardwareConcurrency || 4;
        const memory = (navigator as any).deviceMemory || 4; // GB
        
        // Score: weighted combination
        const score = (estimatedFPS * 0.5) + (cores * 5) + (memory * 10);
        
        let capability: SystemCapability;
        let recommendedMode: PerformanceMode;
        let livePreviewDefault: boolean;
        
        if (score >= 100 && estimatedFPS >= 55) {
          capability = "high";
          recommendedMode = "high";
          livePreviewDefault = true;
        } else if (score >= 60 && estimatedFPS >= 40) {
          capability = "medium";
          recommendedMode = "balanced";
          livePreviewDefault = true;
        } else {
          capability = "low";
          recommendedMode = "minimal";
          livePreviewDefault = false;
        }
        
        const result: SystemCapabilityResult = {
          capability,
          recommendedMode,
          livePreviewDefault,
          benchmarkScore: score,
          detectedAt: Date.now(),
        };
        
        // Cache result
        try {
          localStorage.setItem(CAPABILITY_STORAGE_KEY, JSON.stringify(result));
        } catch {
          // Ignore storage errors
        }
        
        if (import.meta.env.DEV) {
          console.log("[CaptureHealth] System capability detected:", result);
        }
        
        resolve(result);
      }
    }
    
    requestAnimationFrame(measureFrame);
  });
}

/**
 * Clear cached capability (for testing)
 */
export function clearCachedCapability(): void {
  localStorage.removeItem(CAPABILITY_STORAGE_KEY);
}
