/**
 * PopoverShell
 * 
 * Main container for the desktop capture popover.
 * Provides the cinematic Vantage styling with glass effect.
 * Includes header row with close, title, and home.
 * 
 * Layout: Fixed header, scrollable body, sticky footer area.
 */

import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { X, Home, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

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
        // Base container with fixed dimensions
        "relative flex flex-col h-full",
        // Glassmorphism with Vantage theme
        "bg-background/95 backdrop-blur-xl",
        "border border-white/[0.08]",
        "shadow-2xl shadow-black/50",
        // Sizing - max 380px for popover
        isHUD ? "w-auto" : "w-full max-w-[380px]",
        // Rounded corners
        "rounded-2xl overflow-hidden",
        // Subtle glow accent
        "ring-1 ring-vantage-green/10",
        className
      )}
    >
      {/* Subtle top gradient accent */}
      <div 
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-vantage-green/30 to-transparent z-10" 
        aria-hidden="true"
      />
      
      {/* Header row - sticky, hidden for HUD mode */}
      {!isHUD && (
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06] bg-background/95 backdrop-blur-xl">
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
      
      {/* Content - scrollable body with safe-area padding */}
      <ScrollArea className="flex-1 min-h-0">
        <div className={cn(
          "relative",
          isHUD ? "p-3" : "p-4 pb-6" // Extra bottom padding for safe area
        )}>
          {children}
        </div>
      </ScrollArea>
      
      {/* Bottom subtle reflection */}
      <div 
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent z-10" 
        aria-hidden="true"
      />
    </div>
  );
}
