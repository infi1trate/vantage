/**
 * Smart Effect Pairing
 * 
 * Maps VFX effects to suggested SFX pairings for one-click enhancement.
 * Suggestions are shown as subtle toasts, dismissable, and only once per event.
 */

// VFX key → suggested SFX keys (primary, alternatives)
export const VFX_SFX_PAIRINGS: Record<string, { primary: string; alternatives?: string[] }> = {
  // Impact VFX
  zoomPunch: { primary: "whoosh", alternatives: ["boom"] },
  screenShake: { primary: "hitmarkerSfx", alternatives: ["boom", "punch"] },
  hitmarker: { primary: "hitmarkerSfx", alternatives: ["punch"] },
  flashBang: { primary: "boom", alternatives: ["punch"] },
  
  // Transition VFX
  whipPan: { primary: "whoosh" },
  glitchCut: { primary: "reverseHit", alternatives: ["whoosh"] },
  
  // Emphasis VFX
  vignette: { primary: "suspense" },
  colorPop: { primary: "riseFx" },
  slowZoom: { primary: "suspense", alternatives: ["riseFx"] },
  
  // Timing VFX
  freezeFrame: { primary: "bassDrop", alternatives: ["vine_boom", "boom"] },
  speedRamp: { primary: "whoosh", alternatives: ["reverseHit"] },
};

/**
 * Get suggested SFX for a given VFX key
 */
export function getSuggestedSFX(vfxKey: string): { primary: string; alternatives: string[] } | null {
  const pairing = VFX_SFX_PAIRINGS[vfxKey];
  if (!pairing) return null;
  
  return {
    primary: pairing.primary,
    alternatives: pairing.alternatives || [],
  };
}

/**
 * Track which effect events have already shown suggestions
 * to avoid repeated toasts for the same event
 */
const shownSuggestions = new Set<string>();

export function hasShownSuggestion(effectId: string): boolean {
  return shownSuggestions.has(effectId);
}

export function markSuggestionShown(effectId: string): void {
  shownSuggestions.add(effectId);
}

export function clearSuggestionHistory(): void {
  shownSuggestions.clear();
}
