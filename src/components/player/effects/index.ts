/**
 * Effects Components Index
 * 
 * Exports all effect-related components for the player.
 */

export { EffectChip } from "./EffectChip";
export { EffectsTray, type SnapSettings } from "./EffectsTray";
export { EffectEventMarker } from "./EffectEventMarker";
export { EffectEditor } from "./EffectEditor";
export { EffectsLane } from "./EffectsLane";
export { AutoEnhanceModal } from "./AutoEnhanceModal";
export { showSmartPairingToast, hasSuggestedPairing } from "./SmartPairingToast";

// Re-export the effect event types
export type { EffectEvent } from "@/lib/effectEvents";
