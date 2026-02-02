/**
 * Assembly Debug Panel
 * 
 * Subtle instrumentation panel showing assembly step details.
 * Helps identify exactly where stalls occur (e.g., rendering_preview vs finalizing_manifest).
 * 
 * Enhanced to show per-segment status during collecting_clips.
 * Hidden behind an "i" icon to avoid overwhelming normal users.
 */

import { memo, useState, useEffect } from "react";
import { Info, ChevronDown, ChevronUp, Clock, CheckCircle2, AlertCircle, Loader2, Circle, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { SegmentProgress, SegmentStatus } from "@/hooks/useReelAssembly";

/**
 * Assembly steps (MANIFEST-FIRST)
 * Preview generation is now a separate background job
 */
export type AssemblyStep = 
  | "collecting_clips"
  | "finalizing_manifest"
  | "ready"
  | "failed";

const STEP_LABELS: Record<AssemblyStep, string> = {
  collecting_clips: "Collecting clips",
  finalizing_manifest: "Creating timeline",
  ready: "Ready",
  failed: "Failed",
};

const STEP_ORDER: AssemblyStep[] = [
  "collecting_clips",
  "finalizing_manifest",
  "ready",
];

interface AssemblyDebugPanelProps {
  currentStep: AssemblyStep | null;
  stepStartedAt: string | null;
  stepCompletedAt: string | null;
  reelUpdatedAt: string | null;
  /** Per-segment status for collecting_clips */
  segments?: SegmentProgress[];
  /** Current segment being resolved (1-indexed) */
  currentSegmentIndex?: number;
  /** Total segments */
  totalSegments?: number;
  className?: string;
}

function formatElapsed(startTime: string | null): string {
  if (!startTime) return "—";
  
  const start = new Date(startTime).getTime();
  const now = Date.now();
  const elapsed = Math.floor((now - start) / 1000);
  
  if (elapsed < 60) return `${elapsed}s`;
  if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
  return `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`;
}

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return "—";
  
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatMomentTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const SEGMENT_STATUS_ICONS: Record<SegmentStatus, React.ReactNode> = {
  pending: <Circle className="h-3 w-3 text-muted-foreground" />,
  resolving: <Loader2 className="h-3 w-3 text-primary animate-spin" />,
  resolved: <CheckCircle2 className="h-3 w-3 text-vantage-success" />,
  failed: <AlertCircle className="h-3 w-3 text-destructive" />,
  skipped: <SkipForward className="h-3 w-3 text-muted-foreground" />,
};

const SEGMENT_STATUS_COLORS: Record<SegmentStatus, string> = {
  pending: "text-muted-foreground",
  resolving: "text-primary",
  resolved: "text-vantage-success",
  failed: "text-destructive",
  skipped: "text-muted-foreground opacity-60",
};

export const AssemblyDebugPanel = memo(function AssemblyDebugPanel({
  currentStep,
  stepStartedAt,
  stepCompletedAt,
  reelUpdatedAt,
  segments,
  currentSegmentIndex,
  totalSegments,
  className,
}: AssemblyDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [elapsed, setElapsed] = useState("—");
  
  // Update elapsed time every second when panel is open
  useEffect(() => {
    if (!isOpen || !stepStartedAt) return;
    
    const updateElapsed = () => {
      setElapsed(formatElapsed(stepStartedAt));
    };
    
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    
    return () => clearInterval(interval);
  }, [isOpen, stepStartedAt]);
  
  const currentStepIndex = currentStep ? STEP_ORDER.indexOf(currentStep) : -1;
  const isTerminal = currentStep === "ready" || currentStep === "failed";
  const showSegments = currentStep === "collecting_clips" && segments && segments.length > 0;
  
  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn("w-full", className)}
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 gap-1.5 text-xs text-muted-foreground/70 hover:text-muted-foreground",
            "transition-colors"
          )}
        >
          <Info className="h-3 w-3" />
          <span className="hidden sm:inline">Debug</span>
          {isOpen ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-2">
        <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-medium">Assembly Instrumentation</span>
            <span className="tabular-nums">
              Updated: {formatTimestamp(reelUpdatedAt)}
            </span>
          </div>
          
          {/* Current Step Summary */}
          <div className="flex items-center gap-2 p-2 rounded bg-background/50 border border-border/30">
            {isTerminal ? (
              currentStep === "ready" ? (
                <CheckCircle2 className="h-4 w-4 text-vantage-success shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              )
            ) : (
              <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">
                {currentStep ? STEP_LABELS[currentStep] : "Unknown"}
                {currentSegmentIndex !== undefined && totalSegments ? (
                  <span className="ml-1 text-muted-foreground font-normal">
                    ({currentSegmentIndex}/{totalSegments})
                  </span>
                ) : null}
              </p>
              {!isTerminal && (
                <p className="text-muted-foreground">
                  Elapsed: <span className="tabular-nums font-mono">{elapsed}</span>
                </p>
              )}
            </div>
          </div>
          
          {/* Per-Segment Status (when collecting clips) */}
          {showSegments && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1.5">
                Segment Status
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                {segments.map((segment, idx) => (
                  <div
                    key={segment.momentId}
                    className={cn(
                      "flex items-center gap-2 py-0.5 px-1.5 rounded text-[11px]",
                      segment.status === "resolving" && "bg-primary/10",
                      segment.status === "failed" && "bg-destructive/10"
                    )}
                  >
                    <span className="shrink-0 w-4">
                      {SEGMENT_STATUS_ICONS[segment.status]}
                    </span>
                    <span className={cn("flex-1 truncate", SEGMENT_STATUS_COLORS[segment.status])}>
                      {segment.label} @ {formatMomentTimestamp(segment.timestampSeconds)}
                    </span>
                    <span className="text-muted-foreground/60 shrink-0 tabular-nums">
                      #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Step Timeline */}
          <div className="space-y-1.5">
            {STEP_ORDER.slice(0, -1).map((step, index) => {
              const isComplete = currentStepIndex > index || currentStep === "ready";
              const isActive = currentStepIndex === index && !isTerminal;
              const isPending = currentStepIndex < index && !isTerminal;
              
              return (
                <div
                  key={step}
                  className={cn(
                    "flex items-center gap-2 py-1 px-2 rounded transition-colors",
                    isActive && "bg-primary/10",
                    isComplete && "opacity-60"
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full flex items-center justify-center shrink-0",
                      isComplete && "bg-vantage-success text-white",
                      isActive && "bg-primary/20 border-2 border-primary",
                      isPending && "bg-muted border border-border"
                    )}
                  >
                    {isComplete && <CheckCircle2 className="h-2.5 w-2.5" />}
                    {isActive && <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />}
                  </div>
                  <span
                    className={cn(
                      "font-medium",
                      isComplete && "text-vantage-success",
                      isActive && "text-foreground",
                      isPending && "text-muted-foreground"
                    )}
                  >
                    {STEP_LABELS[step]}
                  </span>
                  {isActive && (
                    <span className="ml-auto text-muted-foreground tabular-nums font-mono">
                      {elapsed}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30 text-muted-foreground">
            <div>
              <p className="text-[10px] uppercase tracking-wider opacity-70">Step Started</p>
              <p className="font-mono tabular-nums">{formatTimestamp(stepStartedAt)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider opacity-70">Step Completed</p>
              <p className="font-mono tabular-nums">{formatTimestamp(stepCompletedAt)}</p>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});

export default AssemblyDebugPanel;
