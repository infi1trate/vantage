import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  MousePointer2, 
  GripHorizontal, 
  Crosshair, 
  Keyboard,
  X,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingHintProps {
  show: boolean;
  onDismiss: () => void;
  className?: string;
}

export function OnboardingHint({ show, onDismiss, className }: OnboardingHintProps) {
  if (!show) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center z-20",
        "bg-background/80 backdrop-blur-sm",
        "animate-fade-in",
        className
      )}
    >
      <div className="max-w-md p-6 rounded-xl bg-card border border-border/50 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold">Getting Started</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 -mt-1 -mr-2"
            onClick={onDismiss}
            aria-label="Dismiss hint"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* Hint 1: Timeline drag */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <GripHorizontal className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Drag the timeline</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click and drag on the timeline to select a moment or range
              </p>
            </div>
          </div>

          {/* Hint 2: Video click */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Crosshair className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium">Click on the video</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                After selecting a moment, click anywhere on the video to pin it
              </p>
            </div>
          </div>

          {/* Hint 3: Keyboard shortcuts */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-vantage-purple/10 flex items-center justify-center">
              <Keyboard className="h-5 w-5 text-vantage-purple" />
            </div>
            <div>
              <p className="text-sm font-medium">Use keyboard shortcuts</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Press <kbd className="px-1 py-0.5 bg-background rounded text-[10px] font-mono">?</kbd> anytime to see all shortcuts
              </p>
            </div>
          </div>
        </div>

        <Button 
          className="w-full mt-5 h-11" 
          onClick={onDismiss}
          size="lg"
        >
          Got it, let's go
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// Empty state for timeline - shown when no selection
interface TimelineEmptyStateProps {
  className?: string;
}

export function TimelineEmptyState({ className }: TimelineEmptyStateProps) {
  return (
    <div 
      className={cn(
        "flex items-center justify-center gap-2 py-2",
        "text-xs text-muted-foreground",
        className
      )}
    >
      <GripHorizontal className="h-3.5 w-3.5" />
      <span>Drag on the timeline to select a moment</span>
      <span className="text-muted-foreground/50">•</span>
      <MousePointer2 className="h-3.5 w-3.5" />
      <span>Click the video to pin it</span>
    </div>
  );
}
