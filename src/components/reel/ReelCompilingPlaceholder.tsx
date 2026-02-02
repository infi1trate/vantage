/**
 * Reel Compiling Placeholder
 * 
 * Shows a clear, friendly state when the reel is being assembled.
 * Also handles failed state with retry option.
 */

import { memo } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Film, Sparkles, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

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
}

export const ReelCompilingPlaceholder = memo(function ReelCompilingPlaceholder({
  clipCount = 3,
  aspectRatio = "16:9",
  className,
  isFailed = false,
  errorMessage,
  onRetry,
  isRetrying = false,
}: ReelCompilingPlaceholderProps) {
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
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
                
                {onRetry && (
                  <Button 
                    onClick={onRetry}
                    disabled={isRetrying}
                    className="gap-2 mt-2"
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
              </>
            ) : (
              <>
                {/* Assembling State */}
                <motion.div
                  className="relative"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Film className="h-8 w-8 text-primary" />
                  </div>
                  <motion.div
                    className="absolute -top-1 -right-1"
                    animate={{ 
                      rotate: [0, 15, -15, 0],
                      scale: [1, 1.1, 1],
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Sparkles className="h-5 w-5 text-vantage-warning" />
                  </motion.div>
                </motion.div>
                
                <div className="text-center">
                  <p className="text-base font-medium text-foreground">
                    Assembling your reel…
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Clips are being stitched together
                  </p>
                </div>
                
                {/* Clip count indicator */}
                {clipCount > 0 && (
                  <div className="flex items-center gap-1.5 mt-2">
                    {Array.from({ length: Math.min(clipCount, 6) }).map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full bg-primary/40"
                        animate={{
                          opacity: [0.3, 1, 0.3],
                          scale: [0.8, 1, 0.8],
                        }}
                        transition={{
                          duration: 1.2,
                          repeat: Infinity,
                          delay: i * 0.15,
                        }}
                      />
                    ))}
                    {clipCount > 6 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        +{clipCount - 6}
                      </span>
                    )}
                  </div>
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
