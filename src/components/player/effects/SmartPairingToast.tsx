/**
 * Smart Pairing Toast
 * 
 * Shows a subtle suggestion toast when a VFX is dropped,
 * offering to add a matching SFX with one-click apply.
 */

import { toast } from "sonner";
import { getSuggestedSFX, hasShownSuggestion, markSuggestionShown } from "@/lib/effectPairing";
import { getSFXDefinition } from "@/lib/effectEvents";
import { Volume2 } from "lucide-react";

interface ShowSmartPairingOptions {
  effectId: string;
  vfxKey: string;
  startTimeMs: number;
  onApply: (sfxKey: string, startTimeMs: number) => void;
}

/**
 * Show a smart pairing suggestion toast for a VFX effect
 * 
 * - Only shows once per effect
 * - Dismissable
 * - One-click apply
 */
export function showSmartPairingToast({
  effectId,
  vfxKey,
  startTimeMs,
  onApply,
}: ShowSmartPairingOptions): void {
  // Check if already suggested for this effect
  if (hasShownSuggestion(effectId)) {
    return;
  }

  // Get suggested SFX
  const suggestion = getSuggestedSFX(vfxKey);
  if (!suggestion) {
    return;
  }

  // Get SFX definition for display
  const sfxDef = getSFXDefinition(suggestion.primary);
  if (!sfxDef) {
    return;
  }

  // Mark as shown
  markSuggestionShown(effectId);

  // Show the toast
  toast(`Add matching sound?`, {
    description: `"${sfxDef.name}" pairs well with this effect`,
    duration: 6000,
    icon: <Volume2 className="h-4 w-4 text-accent" />,
    action: {
      label: "Add SFX",
      onClick: () => {
        onApply(suggestion.primary, startTimeMs);
      },
    },
    cancel: {
      label: "Dismiss",
      onClick: () => {
        // Just dismiss, already marked as shown
      },
    },
  });
}

/**
 * Check if a VFX has a suggested SFX pairing
 */
export function hasSuggestedPairing(vfxKey: string): boolean {
  return getSuggestedSFX(vfxKey) !== null;
}
