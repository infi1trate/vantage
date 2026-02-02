/**
 * Phase 2 Effects & Performance Types
 * 
 * Re-exports all types for external use.
 */

// Effect metadata types (legacy store)
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

// Effect Events (VFX/SFX timeline stickers)
export type {
  EffectEvent,
  EffectType,
  EffectIntensity,
  ApplyScope,
  SnapSource,
  VFXDefinition,
  SFXDefinition,
  EffectRenderGroup,
} from "./effectEvents";

// Re-export constants
export { 
  REEL_PACKAGES, 
  DEFAULT_FRAME_CONFIG,
  getFramePreviewClass,
  hasEffects,
} from "./effectMetadataStore";

// Effect catalogs
export {
  VFX_CATALOG,
  SFX_CATALOG,
  getVFXDefinition,
  getSFXDefinition,
  getDefaultDuration,
  getDefaultIntensity,
  getDefaultVolume,
} from "./effectEvents";
