/**
 * Frame Preview Overlay
 * 
 * Lightweight CSS-only overlay that displays on top of the camera preview.
 * Does NOT affect recording - purely visual preview.
 * 
 * Auto-disables when Performance Mode drops to 'minimal'.
 */

import { memo } from "react";
import { cn } from "@/lib/utils";
import type { FrameStyleParams } from "@/lib/frameOverlays";

interface FramePreviewOverlayProps {
  /** Style parameters for the frame */
  style: FrameStyleParams;
  /** Whether live preview is enabled */
  enabled: boolean;
  /** Whether performance allows preview (false = auto-disabled) */
  performanceAllowed: boolean;
  /** Additional classes */
  className?: string;
}

export const FramePreviewOverlay = memo(function FramePreviewOverlay({
  style,
  enabled,
  performanceAllowed,
  className,
}: FramePreviewOverlayProps) {
  // Don't render if disabled or performance-blocked
  if (!enabled || !performanceAllowed) {
    return null;
  }

  const colorVar = getColorVar(style.colorTheme);
  const glowIntensity = style.glowIntensity;

  // Shape classes
  const shapeClass = 
    style.shape === "circle" ? "rounded-full" :
    style.shape === "hex" ? "clip-path-hex" :
    style.shape === "square" ? "rounded-none" :
    style.shape === "pill" ? "rounded-full" :
    "rounded-xl";

  // Glow shadow
  const glowStyle: React.CSSProperties = glowIntensity > 0
    ? {
        boxShadow: `inset 0 0 ${glowIntensity * 20}px ${glowIntensity * 8}px ${colorVar}`,
      }
    : {};

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 transition-opacity duration-200",
        shapeClass,
        className
      )}
      style={{
        borderWidth: style.strokeWidth,
        borderColor: colorVar,
        borderStyle: "solid",
        ...glowStyle,
      }}
      aria-hidden="true"
    >
      {/* Mic Ring Indicator */}
      {style.micRingEnabled && (
        <div
          className={cn(
            "absolute inset-0 border-2 animate-pulse opacity-50",
            shapeClass
          )}
          style={{ borderColor: colorVar }}
        />
      )}

      {/* Nameplate (positioned at bottom) */}
      {style.nameplateEnabled && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-1">
          <div 
            className="px-2 py-0.5 rounded text-[10px] font-medium backdrop-blur-sm"
            style={{ 
              backgroundColor: `${colorVar}20`,
              color: colorVar,
              borderWidth: 1,
              borderColor: `${colorVar}40`,
            }}
          >
            Gamertag
          </div>
        </div>
      )}
    </div>
  );
});

function getColorVar(theme: string): string {
  const colors: Record<string, string> = {
    primary: "hsl(65 70% 45%)", // vantage primary
    white: "#ffffff",
    accent: "hsl(var(--accent))",
    destructive: "hsl(var(--destructive))",
    "neon-pink": "#ff00ff",
    "neon-cyan": "#00ffff",
    "neon-green": "#00ff00",
    "retro-green": "#00ff00",
  };
  return colors[theme] || colors.primary;
}

export default FramePreviewOverlay;
