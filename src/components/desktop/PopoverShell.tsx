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
        // Base container - fills parent completely
        "relative flex flex-col h-full w-full",
        // Solid Vantage dark surface - no border, no outer frame
        "bg-background",
        // Overflow handling
        "overflow-hidden",
        className
      )}
    >
      {/* Subtle top accent line */}
      <div 
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-vantage-green/20 to-transparent z-10" 
        aria-hidden="true"
      />
      
      {/* Header row - pinned to top, hidden for HUD mode */}
      {!isHUD && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-background">
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
            <X className="w-4 h-4" strokeWidth={2} />
          </Button>

          {/* Center title with record indicator - uses app header style */}
          <div className="flex items-center gap-2">
            <Circle className="w-2 h-2 fill-vantage-green text-vantage-green" aria-hidden="true" />
            <span className="font-barlow text-base font-semibold text-foreground uppercase tracking-wider">
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
            <Home className="w-4 h-4" strokeWidth={2} />
          </Button>
        </div>
      )}
      
      {/* Content - scrollable body with safe-area padding */}
      {/* Content - fills available space */}
      <div className={cn(
        "flex-1 min-h-0 flex flex-col overflow-hidden",
        isHUD ? "p-3" : "px-4 py-4"
      )}>
        {children}
      </div>
      
      {/* Bottom subtle accent */}
      <div 
        className="absolute inset-x-0 bottom-0 h-px bg-white/[0.04] z-10" 
        aria-hidden="true"
      />
    </div>
  );
}
