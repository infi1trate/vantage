import { useCallback, useMemo } from "react";
import { Annotation } from "@/lib/captures";
import { cn } from "@/lib/utils";

export interface FramePin {
  id: string;
  annotationId?: string;
  type: "kill" | "death" | "highlight" | "marker";
  timestamp: number;
  endTimestamp?: number;
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
}

interface FramePinsProps {
  pins: FramePin[];
  currentTime: number;
  duration: number;
  onPinClick?: (pin: FramePin) => void;
  className?: string;
}

// SVG shapes for each pin type
const PinShapes = {
  kill: ({ className }: { className?: string }) => (
    // Sharp diamond
    <svg viewBox="0 0 16 16" className={cn("w-4 h-4", className)}>
      <path 
        d="M8 1L15 8L8 15L1 8L8 1Z" 
        fill="currentColor" 
        stroke="hsl(var(--background))" 
        strokeWidth="1"
      />
    </svg>
  ),
  death: ({ className }: { className?: string }) => (
    // Hollow circle
    <svg viewBox="0 0 16 16" className={cn("w-4 h-4", className)}>
      <circle 
        cx="8" 
        cy="8" 
        r="6" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2"
      />
      <circle 
        cx="8" 
        cy="8" 
        r="2" 
        fill="currentColor"
      />
    </svg>
  ),
  highlight: ({ className }: { className?: string }) => (
    // Star dot
    <svg viewBox="0 0 16 16" className={cn("w-4 h-4", className)}>
      <path 
        d="M8 0L9.5 5.5L15 6L10.5 9.5L12 15L8 11.5L4 15L5.5 9.5L1 6L6.5 5.5L8 0Z" 
        fill="currentColor"
        stroke="hsl(var(--background))"
        strokeWidth="0.5"
      />
    </svg>
  ),
  marker: ({ className }: { className?: string }) => (
    // Small flag
    <svg viewBox="0 0 16 16" className={cn("w-4 h-4", className)}>
      <path 
        d="M3 1V15" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round"
      />
      <path 
        d="M3 2L13 4L3 7Z" 
        fill="currentColor"
      />
    </svg>
  ),
};

const PIN_COLORS = {
  kill: "text-vantage-success",
  death: "text-destructive",
  highlight: "text-vantage-warning",
  marker: "text-primary",
};

export function FramePins({
  pins,
  currentTime,
  duration,
  onPinClick,
  className,
}: FramePinsProps) {
  // Filter pins visible at current time (within 0.5s tolerance or in range)
  const visiblePins = useMemo(() => {
    return pins.filter((pin) => {
      const tolerance = 0.5;
      if (pin.endTimestamp) {
        // Range pin - visible if current time is within range
        return currentTime >= pin.timestamp - tolerance && currentTime <= pin.endTimestamp + tolerance;
      }
      // Point pin - visible if within tolerance
      return Math.abs(currentTime - pin.timestamp) <= tolerance;
    });
  }, [pins, currentTime]);

  // All pins for timeline reference (faded if not current)
  const allPinsWithState = useMemo(() => {
    return pins.map((pin) => {
      const tolerance = 0.5;
      let isActive = false;
      if (pin.endTimestamp) {
        isActive = currentTime >= pin.timestamp - tolerance && currentTime <= pin.endTimestamp + tolerance;
      } else {
        isActive = Math.abs(currentTime - pin.timestamp) <= tolerance;
      }
      return { ...pin, isActive };
    });
  }, [pins, currentTime]);

  return (
    <div className={cn("absolute inset-0 pointer-events-none", className)}>
      {allPinsWithState.map((pin) => {
        const Shape = PinShapes[pin.type];
        
        return (
          <button
            key={pin.id}
            className={cn(
              "absolute pointer-events-auto transition-all duration-200",
              "transform -translate-x-1/2 -translate-y-1/2",
              "hover:scale-125 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background rounded-sm",
              PIN_COLORS[pin.type],
              pin.isActive 
                ? "opacity-100 scale-100" 
                : "opacity-30 scale-75 hover:opacity-60"
            )}
            style={{
              left: `${pin.x * 100}%`,
              top: `${pin.y * 100}%`,
            }}
            onClick={() => onPinClick?.(pin)}
            aria-label={`${pin.type} marker at ${Math.floor(pin.timestamp / 60)}:${Math.floor(pin.timestamp % 60).toString().padStart(2, '0')}`}
          >
            <Shape />
          </button>
        );
      })}
    </div>
  );
}

// Hook to manage frame pins
export function useFramePins(annotations: Annotation[]) {
  // Convert annotations to pins if they have position data in metadata
  const pins = useMemo<FramePin[]>(() => {
    return annotations
      .filter((a) => {
        // Only include annotations that have position metadata
        // For now, we'll handle this at the component level
        return ["kill", "death", "highlight", "marker"].includes(a.annotation_type);
      })
      .map((a) => ({
        id: a.id,
        annotationId: a.id,
        type: a.annotation_type as FramePin["type"],
        timestamp: a.timestamp_seconds,
        endTimestamp: a.end_timestamp_seconds || undefined,
        // Default to center if no position - actual positions stored elsewhere
        x: 0.5,
        y: 0.5,
      }));
  }, [annotations]);

  return { pins };
}
