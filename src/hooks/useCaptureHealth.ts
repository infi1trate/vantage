/**
 * React hook for capture health monitoring
 * 
 * Provides real-time capture health state and performance mode
 * with automatic lifecycle management.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  CaptureHealthState,
  PerformanceMode,
  startHealthMonitoring,
  stopHealthMonitoring,
  subscribeToHealth,
  getHealthState,
  reportDroppedFrame,
  reportEncoderDelay,
  reportCompositeFPS,
  detectSystemCapability,
  getCachedCapability,
  SystemCapabilityResult,
} from "@/lib/captureHealth";

export interface UseCaptureHealthResult {
  /** Current health state */
  health: CaptureHealthState;
  /** Current performance mode */
  mode: PerformanceMode;
  /** Whether live preview effects are allowed */
  livePreviewAllowed: boolean;
  /** System capability (detected on first use) */
  systemCapability: SystemCapabilityResult | null;
  /** Manual override for performance mode */
  overrideMode: (mode: PerformanceMode | null) => void;
  /** Current override (null = auto) */
  modeOverride: PerformanceMode | null;
  /** Whether currently monitoring */
  isMonitoring: boolean;
  /** Start monitoring */
  startMonitoring: () => void;
  /** Stop monitoring */
  stopMonitoring: () => void;
  /** Report metrics from capture pipeline */
  reportMetrics: {
    droppedFrame: () => void;
    encoderDelay: (ms: number) => void;
    compositeFPS: (fps: number) => void;
  };
}

/**
 * Hook for monitoring and reacting to capture health
 * 
 * @param autoStart - Start monitoring immediately (default: false)
 * @param detectCapability - Run capability detection on mount (default: true)
 */
export function useCaptureHealth(
  autoStart = false,
  detectCapability = true
): UseCaptureHealthResult {
  const [health, setHealth] = useState<CaptureHealthState>(getHealthState);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [modeOverride, setModeOverride] = useState<PerformanceMode | null>(null);
  const [systemCapability, setSystemCapability] = useState<SystemCapabilityResult | null>(
    getCachedCapability
  );
  
  // Track if component is mounted
  const mountedRef = useRef(true);
  
  // Subscribe to health updates
  useEffect(() => {
    const unsubscribe = subscribeToHealth((state) => {
      if (mountedRef.current) {
        setHealth(state);
      }
    });
    
    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, []);
  
  // Detect system capability on mount
  useEffect(() => {
    if (!detectCapability) return;
    
    // Check cache first
    const cached = getCachedCapability();
    if (cached) {
      setSystemCapability(cached);
      return;
    }
    
    // Run detection
    detectSystemCapability().then((result) => {
      if (mountedRef.current) {
        setSystemCapability(result);
      }
    });
  }, [detectCapability]);
  
  // Auto-start if requested
  useEffect(() => {
    if (autoStart) {
      startHealthMonitoring();
      setIsMonitoring(true);
    }
    
    return () => {
      stopHealthMonitoring();
    };
  }, [autoStart]);
  
  const startMonitoring = useCallback(() => {
    startHealthMonitoring();
    setIsMonitoring(true);
  }, []);
  
  const stopMonitoringHandler = useCallback(() => {
    stopHealthMonitoring();
    setIsMonitoring(false);
  }, []);
  
  const overrideMode = useCallback((mode: PerformanceMode | null) => {
    setModeOverride(mode);
  }, []);
  
  // Compute effective mode (override takes precedence)
  const effectiveMode = modeOverride ?? health.mode;
  const livePreviewAllowed = effectiveMode !== "minimal";
  
  // Report metrics callbacks (stable references)
  const reportMetrics = useRef({
    droppedFrame: reportDroppedFrame,
    encoderDelay: reportEncoderDelay,
    compositeFPS: reportCompositeFPS,
  });
  
  return {
    health,
    mode: effectiveMode,
    livePreviewAllowed,
    systemCapability,
    overrideMode,
    modeOverride,
    isMonitoring,
    startMonitoring,
    stopMonitoring: stopMonitoringHandler,
    reportMetrics: reportMetrics.current,
  };
}

export default useCaptureHealth;
