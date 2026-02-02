/**
 * PopoverShell
 * 
 * Main container for the desktop capture popover.
 * Provides the cinematic Vantage styling with glass effect.
 */

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface PopoverShellProps {
  children: ReactNode;
  className?: string;
  /** Whether to show the compact HUD variant */
  isHUD?: boolean;
}

export function PopoverShell({ children, className, isHUD = false }: PopoverShellProps) {
  return (
    <div
      className={cn(
        // Base container
        "relative overflow-hidden",
        // Glassmorphism with Vantage theme
        "bg-background/95 backdrop-blur-xl",
        "border border-border/50",
        "shadow-2xl shadow-black/50",
        // Sizing
        isHUD ? "w-auto" : "w-[360px] max-w-[520px]",
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
