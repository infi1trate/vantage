/**
 * PopoverShell
 * 
 * Main container for the desktop capture popover.
 * Provides the cinematic Vantage styling with glass effect.
 * Includes header row with close, title, and home.
 */

import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { X, Home, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        aria-hidden="true"
      />
      
      {/* Header row - hidden for HUD mode */}
      {!isHUD && (
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
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
              "transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vantage-green focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            <X className="w-4 h-4" />
          </Button>

          {/* Center title with record indicator */}
          <div className="flex items-center gap-2">
            <Circle className="w-2.5 h-2.5 fill-vantage-green text-vantage-green" aria-hidden="true" />
            <span className="text-sm font-semibold text-foreground tracking-wide">
              Record
            </span>
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
              "transition-all duration-150",
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
        aria-hidden="true"
      />
    </div>
  );
}
