/**
 * Reel Compiling Placeholder
 * 
 * Shows assembly progress with step-based indicators.
 * Also handles failed state with retry option.
 */

import { memo, useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Film, Sparkles, AlertCircle, RefreshCw, Loader2, Check, X, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ReelCompilingPlaceholderProps {
  clipCount?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  className?: string;
  /** Whether assembly failed */
  isFailed?: boolean;
  /** Error message to display */
  errorMessage?: string | null;
  /** Retry handler */
  onRetry?: () => Promise<void>;
  /** Whether retry is in progress */
  isRetrying?: boolean;
  /** Cancel handler - returns to session detail */
  onCancel?: () => void;
}

// Assembly steps configuration
const ASSEMBLY_STEPS = [
  { id: "collecting", label: "Collecting clips", range: [0, 20] },
  { id: "stitching", label: "Stitching sequence", range: [20, 70] },
  { id: "preparing", label: "Preparing preview", range: [70, 100] },
] as const;

function getActiveStep(progress: number): number {
  for (let i = 0; i < ASSEMBLY_STEPS.length; i++) {
    if (progress <= ASSEMBLY_STEPS[i].range[1]) {
      return i;
    }
  }
  return ASSEMBLY_STEPS.length - 1;
}

export const ReelCompilingPlaceholder = memo(function ReelCompilingPlaceholder({
  clipCount = 3,
  aspectRatio = "16:9",
  className,
  isFailed = false,
  errorMessage,
  onRetry,
  isRetrying = false,
  onCancel,
}: ReelCompilingPlaceholderProps) {
  // Simulated progress: 0 → 85% over ~25 seconds, then holds
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  
  // Progress simulation - smooth increase to 85%, then hold
  useEffect(() => {
    if (isFailed || isRetrying) {
      // Reset on failure or retry
      if (isRetrying) {
        setProgress(0);
        startTimeRef.current = Date.now();
      }
      return;
    }
    
    // Target 85% over ~25 seconds with easing
    const DURATION_MS = 25_000;
    const MAX_PROGRESS = 85;
    
    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const t = Math.min(elapsed / DURATION_MS, 1);
      
      // Ease-out curve: starts fast, slows down
      const eased = 1 - Math.pow(1 - t, 3);
      const newProgress = Math.min(eased * MAX_PROGRESS, MAX_PROGRESS);
      
      setProgress(newProgress);
      
      // Stop interval once we hit max
      if (newProgress >= MAX_PROGRESS && intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }, 100);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isFailed, isRetrying]);
  
  const activeStepIndex = getActiveStep(progress);
  
  // Aspect ratio to padding-bottom percentage
  const aspectPadding = {
    "16:9": "56.25%",
    "9:16": "177.78%",
    "1:1": "100%",
  }[aspectRatio];

  return (
    <div className={cn("w-full h-full flex flex-col", className)}>
      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div 
          className={cn(
            "relative w-full max-w-2xl overflow-hidden rounded-xl border",
            isFailed 
              ? "bg-destructive/5 border-destructive/30"
              : "bg-gradient-to-br from-muted/40 via-muted/20 to-muted/40 border-border/30"
          )}
          style={{ maxHeight: aspectRatio === "9:16" ? "70%" : undefined }}
        >
          {/* Maintain aspect ratio */}
          <div style={{ paddingBottom: aspectPadding }} />
          
          {/* Shimmer overlay - only when assembling */}
          {!isFailed && (
            <div className="absolute inset-0 overflow-hidden">
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12"
                animate={{
                  x: ["-100%", "200%"],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>
          )}
          
          {/* Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6">
            {isFailed ? (
              <>
                {/* Failed State */}
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                
                <div className="text-center max-w-sm">
                  <p className="text-base font-medium text-foreground">
                    Assembly failed
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {errorMessage || "Something went wrong during reel assembly."}
                  </p>
                </div>
                
                <div className="flex items-center gap-3 mt-2">
                  {onRetry && (
                    <Button 
                      onClick={onRetry}
                      disabled={isRetrying}
                      className="gap-2"
                    >
                      {isRetrying ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Retrying...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Retry Assembly
                        </>
                      )}
                    </Button>
                  )}
                  {onCancel && (
                    <Button variant="outline" onClick={onCancel} className="gap-2">
                      <ArrowLeft className="h-4 w-4" />
                      Back to Session
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Assembling State */}
                <motion.div
                  className="relative"
                  animate={{ scale: [1, 1.03, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Film className="h-8 w-8 text-primary" />
                  </div>
                  <motion.div
                    className="absolute -top-1 -right-1"
                    animate={{ 
                      rotate: [0, 10, -10, 0],
                      scale: [1, 1.1, 1],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Sparkles className="h-5 w-5 text-vantage-warning" />
                  </motion.div>
                </motion.div>
                
                {/* Title + Subtitle */}
                <div className="text-center">
                  <p className="text-base font-semibold text-foreground">
                    Assembling your reel…
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Stitching clips + preparing preview
                  </p>
                </div>
                
                {/* Step-based Progress */}
                <div className="w-full max-w-xs space-y-3">
                  {/* Progress bar */}
                  <div className="relative h-2 bg-muted/50 rounded-full overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </div>
                  
                  {/* Step checklist */}
                  <div className="space-y-2">
                    {ASSEMBLY_STEPS.map((step, index) => {
                      const isComplete = progress > step.range[1];
                      const isActive = index === activeStepIndex && !isComplete;
                      
                      return (
                        <div
                          key={step.id}
                          className={cn(
                            "flex items-center gap-2.5 text-sm transition-opacity",
                            isComplete ? "opacity-100" : isActive ? "opacity-100" : "opacity-40"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors",
                            isComplete 
                              ? "bg-vantage-success text-white" 
                              : isActive 
                                ? "bg-primary/20 border-2 border-primary"
                                : "bg-muted/50 border border-border"
                          )}>
                            {isComplete ? (
                              <Check className="h-3 w-3" />
                            ) : isActive ? (
                              <Loader2 className="h-3 w-3 animate-spin text-primary" />
                            ) : null}
                          </div>
                          <span className={cn(
                            "font-medium",
                            isComplete 
                              ? "text-vantage-success" 
                              : isActive 
                                ? "text-foreground"
                                : "text-muted-foreground"
                          )}>
                            {step.label}
                          </span>
                          {isActive && (
                            <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                              {Math.round(progress)}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Background helper text */}
                <p className="text-xs text-muted-foreground/70 text-center mt-2">
                  Running in background — you can leave this page, we'll keep working.
                </p>
                
                {/* Cancel option */}
                {onCancel && (
                  <button
                    onClick={onCancel}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 underline-offset-2 hover:underline"
                  >
                    Cancel
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Timeline Placeholder */}
      <div className="shrink-0 px-4 pb-4">
        <div className={cn(
          "rounded-lg border p-3",
          isFailed 
            ? "bg-destructive/5 border-destructive/20"
            : "bg-muted/20 border-border/30"
        )}>
          {/* Timeline header */}
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
            <div className="flex-1" />
            <Skeleton className="h-3 w-12" />
          </div>
          
          {/* Placeholder clip blocks */}
          <div className="flex gap-1.5 h-12">
            {Array.from({ length: Math.min(clipCount, 5) }).map((_, i) => (
              <motion.div
                key={i}
                className={cn(
                  "flex-1 rounded border",
                  isFailed 
                    ? "bg-destructive/10 border-destructive/20"
                    : "bg-muted/50 border-border/20"
                )}
                initial={{ opacity: 0.3 }}
                animate={isFailed ? {} : { opacity: [0.3, 0.5, 0.3] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
          
          {/* Disabled message */}
          <p className={cn(
            "text-[10px] text-center mt-2",
            isFailed ? "text-destructive/60" : "text-muted-foreground/60"
          )}>
            {isFailed 
              ? "Assembly must complete before editing"
              : "FX and editing will be available once assembly completes"
            }
          </p>
        </div>
      </div>
    </div>
  );
});

export default ReelCompilingPlaceholder;
