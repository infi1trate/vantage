/**
 * PrimaryCTA
 * 
 * Bold primary call-to-action button for the popover.
 * Supports different states: start, stop, resume, etc.
 */

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Circle, Square, Play, Pause, Loader2, AlertCircle, Unlock } from "lucide-react";
import { ReactNode } from "react";

type CTAVariant = 
  | "start"       // Start recording
  | "stop"        // Stop recording
  | "pause"       // Pause recording
  | "resume"      // Resume recording
  | "authorize"   // Request permissions
  | "retry"       // Retry after error
  | "processing"; // Processing/uploading

interface PrimaryCTAProps {
  variant: CTAVariant;
  onClick: () => void;
  disabled?: boolean;
  /** Optional countdown number */
  countdown?: number;
  /** Helper text below button */
  helperText?: string;
}

const VARIANT_CONFIG: Record<CTAVariant, {
  label: string;
  icon: ReactNode;
  className: string;
}> = {
  start: {
    label: "Start Recording",
    icon: <Circle className="w-4 h-4 fill-current" />,
    className: "bg-vantage-green hover:bg-vantage-green/90 text-background",
  },
  stop: {
    label: "Stop",
    icon: <Square className="w-4 h-4 fill-current" />,
    className: "bg-destructive hover:bg-destructive/90 text-white",
  },
  pause: {
    label: "Pause",
    icon: <Pause className="w-4 h-4" />,
    className: "bg-amber-500 hover:bg-amber-500/90 text-background",
  },
  resume: {
    label: "Resume",
    icon: <Play className="w-4 h-4 fill-current" />,
    className: "bg-vantage-green hover:bg-vantage-green/90 text-background",
  },
  authorize: {
    label: "Grant Permissions",
    icon: <Unlock className="w-4 h-4" />,
    className: "bg-vantage-green hover:bg-vantage-green/90 text-background",
  },
  retry: {
    label: "Try Again",
    icon: <AlertCircle className="w-4 h-4" />,
    className: "bg-vantage-green hover:bg-vantage-green/90 text-background",
  },
  processing: {
    label: "Processing...",
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    className: "bg-muted text-muted-foreground cursor-not-allowed",
  },
};

export function PrimaryCTA({ 
  variant, 
  onClick, 
  disabled, 
  countdown,
  helperText,
}: PrimaryCTAProps) {
  const config = VARIANT_CONFIG[variant];
  const isProcessing = variant === "processing";

  return (
    <div className="space-y-2">
      <Button
        onClick={onClick}
        disabled={disabled || isProcessing}
        className={cn(
          // Base styles
          "w-full h-11 text-sm font-semibold uppercase tracking-wider",
          // Transition
          "transition-all duration-150",
          // Active state
          "active:scale-[0.98]",
          // Variant styles
          config.className,
          // Glow effect for primary actions
          variant === "start" && "shadow-lg shadow-vantage-green/25",
          variant === "stop" && "shadow-lg shadow-destructive/25"
        )}
      >
        {countdown !== undefined ? (
          <span className="text-2xl font-bold">{countdown}</span>
        ) : (
          <span className="flex items-center gap-2">
            {config.icon}
            {config.label}
          </span>
        )}
      </Button>

      {/* Helper text */}
      {helperText && (
        <p className="text-xs text-muted-foreground text-center">
          {helperText}
        </p>
      )}
    </div>
  );
}
