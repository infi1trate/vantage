/**
 * Phase 2 Effects & Performance Types
 * 
 * Re-exports all types for external use.
 */

// Effect metadata types
export type {
  FrameStyle,
  SFXType,
  VFXType,
  FrameConfig,
  SFXConfig,
  VFXConfig,
  ReelPackage,
  SessionEffects,
} from "./effectMetadataStore";

// Performance mode types
export type {
  PerformanceMode,
  CaptureHealthState,
  HealthThresholds,
  SystemCapability,
  SystemCapabilityResult,
} from "./captureHealth";

// Re-export constants
export { 
  REEL_PACKAGES, 
  DEFAULT_FRAME_CONFIG,
  getFramePreviewClass,
  hasEffects,
} from "./effectMetadataStore";
