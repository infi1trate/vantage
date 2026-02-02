/**
 * PopoverShell
 * 
 * Main container for the desktop capture popover.
 * Provides the cinematic Vantage styling with glass effect.
 * Includes header row with close, mode selector, and home.
 */

import { cn } from "@/lib/utils";
import { ReactNode, useState } from "react";
import { X, Home, Circle, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

type PopoverMode = "record" | "screenshot";

interface PopoverShellProps {
  children: ReactNode;
  className?: string;
  /** Whether to show the compact HUD variant (hides header) */
  isHUD?: boolean;
  /** Callback when close is clicked */
  onClose?: () => void;
  /** Callback when home is clicked */
  onHome?: () => void;
}

export function PopoverShell({ 
  children, 
  className, 
  isHUD = false,
  onClose,
  onHome,
}: PopoverShellProps) {
  const [mode, setMode] = useState<PopoverMode>("record");

  return (
    <div
      className={cn(
        // Base container
        "relative overflow-hidden",
        // Glassmorphism with Vantage theme
        "bg-background/95 backdrop-blur-xl",
        "border border-white/[0.08]",
        "shadow-2xl shadow-black/50",
        // Sizing - max 380px for popover
        isHUD ? "w-auto" : "w-full max-w-[380px]",
        // Rounded corners
        "rounded-2xl",
        // Subtle glow accent
        "ring-1 ring-vantage-green/10",
        className
      )}
    >
      {/* Subtle top gradient accent */}
      <div 
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-vantage-green/30 to-transparent" 
        aria-hidden 
      />
      
      {/* Header row - hidden for HUD mode */}
      {!isHUD && (
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.08]">
          {/* Close button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close popover"
            className={cn(
              "h-8 w-8 p-0 rounded-lg",
              "hover:bg-white/[0.08] active:bg-white/[0.12]",
              "text-muted-foreground hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            <X className="w-4 h-4" />
          </Button>

          {/* Segmented control - Record / Screenshot */}
          <div className="flex items-center bg-white/[0.06] rounded-lg p-0.5" role="tablist">
            <button
              onClick={() => setMode("record")}
              role="tab"
              aria-selected={mode === "record"}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium uppercase tracking-wider",
                "transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-inset",
                mode === "record"
                  ? "bg-vantage-green text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Circle className="w-3 h-3 fill-current" />
              Record
            </button>
            <button
              disabled
              role="tab"
              aria-selected={false}
              aria-disabled="true"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium uppercase tracking-wider",
                "text-muted-foreground/50 cursor-not-allowed"
              )}
            >
              <Camera className="w-3 h-3" />
              Screenshot
            </button>
          </div>

          {/* Home button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onHome}
            aria-label="Go to home"
            className={cn(
              "h-8 w-8 p-0 rounded-lg",
              "hover:bg-white/[0.08] active:bg-white/[0.12]",
              "text-muted-foreground hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            <Home className="w-4 h-4" />
          </Button>
        </div>
      )}
      
      {/* Content */}
      <div className={cn(
        "relative z-10",
        isHUD ? "p-3" : "p-4"
      )}>
        {children}
      </div>
      
      {/* Bottom subtle reflection */}
      <div 
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" 
        aria-hidden 
      />
    </div>
  );
}
