/**
 * Assembly Debug Panel
 * 
 * Subtle instrumentation panel showing assembly step details.
 * Helps identify exactly where stalls occur (e.g., rendering_preview vs finalizing_manifest).
 * 
 * Hidden behind an "i" icon to avoid overwhelming normal users.
 */

import { memo, useState, useEffect } from "react";
import { Info, ChevronDown, ChevronUp, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export type AssemblyStep = 
  | "collecting_clips"
  | "stitching_sequence"
  | "rendering_preview"
  | "finalizing_manifest"
  | "ready"
  | "failed";

const STEP_LABELS: Record<AssemblyStep, string> = {
  collecting_clips: "Collecting clips",
  stitching_sequence: "Stitching sequence",
  rendering_preview: "Rendering preview",
  finalizing_manifest: "Finalizing manifest",
  ready: "Ready",
  failed: "Failed",
};

const STEP_ORDER: AssemblyStep[] = [
  "collecting_clips",
  "stitching_sequence",
  "rendering_preview",
  "finalizing_manifest",
  "ready",
];

interface AssemblyDebugPanelProps {
  currentStep: AssemblyStep | null;
  stepStartedAt: string | null;
  stepCompletedAt: string | null;
  reelUpdatedAt: string | null;
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

export const AssemblyDebugPanel = memo(function AssemblyDebugPanel({
  currentStep,
  stepStartedAt,
  stepCompletedAt,
  reelUpdatedAt,
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
              </p>
              {!isTerminal && (
                <p className="text-muted-foreground">
                  Elapsed: <span className="tabular-nums font-mono">{elapsed}</span>
                </p>
              )}
            </div>
          </div>
          
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
