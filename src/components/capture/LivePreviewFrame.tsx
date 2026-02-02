/**
 * Live Preview Overlay Frame
 * 
 * CSS-only frame overlay for capture preview. Renders as a positioned
 * layer on top of the preview canvas - does NOT affect the recording.
 * 
 * Auto-disables when performance mode drops to "minimal".
 */

import { memo } from "react";
import { cn } from "@/lib/utils";
import { FrameStyle, getFramePreviewClass } from "@/lib/effectMetadataStore";

interface LivePreviewFrameProps {
  /** Frame style to display */
  style: FrameStyle;
  /** Whether preview is allowed (from performance mode) */
  allowed: boolean;
  /** Whether explicitly enabled by user */
  enabled: boolean;
  /** Frame opacity */
  opacity?: number;
  /** Additional classes */
  className?: string;
}

export const LivePreviewFrame = memo(function LivePreviewFrame({
  style,
  allowed,
  enabled,
  opacity = 1,
  className,
}: LivePreviewFrameProps) {
  // Don't render if not allowed or not enabled
  if (!allowed || !enabled || style === "none") {
    return null;
  }
  
  const frameClass = getFramePreviewClass(style);
  
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 transition-opacity duration-300",
        frameClass,
        className
      )}
      style={{ opacity }}
      aria-hidden="true"
    />
  );
});

/**
 * Facecam Frame Overlay
 * 
 * Frame specifically for the facecam PiP preview.
 */
interface FacecamFrameOverlayProps {
  /** Whether to show border */
  showBorder: boolean;
  /** Border color */
  borderColor?: string;
  /** Frame style (for shape) */
  style: FrameStyle;
  /** Whether preview is allowed */
  allowed: boolean;
  /** Additional classes */
  className?: string;
}

export const FacecamFrameOverlay = memo(function FacecamFrameOverlay({
  showBorder,
  borderColor = "#ffffff",
  style,
  allowed,
  className,
}: FacecamFrameOverlayProps) {
  if (!allowed || !showBorder) {
    return null;
  }
  
  // Determine border radius based on style
  const radiusClass = 
    style === "retro-pixel" ? "rounded-none" :
    style === "gaming-bold" || style === "neon-glow" ? "rounded-xl" :
    style === "clean-modern" ? "rounded-2xl" :
    "rounded-lg";
  
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 border-2 transition-all duration-300",
        radiusClass,
        className
      )}
      style={{ borderColor }}
      aria-hidden="true"
    />
  );
});

export default LivePreviewFrame;
