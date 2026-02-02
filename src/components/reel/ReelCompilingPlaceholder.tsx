/**
 * Reel Compiling Placeholder
 * 
 * Shows a clear, friendly state when the reel is being assembled.
 * Replaces ambiguous "no video" states with explicit feedback.
 */

import { memo } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Film, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ReelCompilingPlaceholderProps {
  clipCount?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  className?: string;
}

export const ReelCompilingPlaceholder = memo(function ReelCompilingPlaceholder({
  clipCount = 3,
  aspectRatio = "16:9",
  className,
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
          className="relative w-full max-w-2xl overflow-hidden rounded-xl bg-gradient-to-br from-muted/40 via-muted/20 to-muted/40 border border-border/30"
          style={{ maxHeight: aspectRatio === "9:16" ? "70%" : undefined }}
        >
          {/* Maintain aspect ratio */}
          <div style={{ paddingBottom: aspectPadding }} />
          
          {/* Shimmer overlay */}
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
          
          {/* Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            {/* Animated icon */}
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
            
            {/* Text */}
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
          </div>
        </div>
      </div>
      
      {/* Timeline Placeholder */}
      <div className="shrink-0 px-4 pb-4">
        <div className="bg-muted/20 rounded-lg border border-border/30 p-3">
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
                className="flex-1 rounded bg-muted/50 border border-border/20"
                initial={{ opacity: 0.3 }}
                animate={{ opacity: [0.3, 0.5, 0.3] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
          
          {/* Disabled message */}
          <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
            FX and editing will be available once assembly completes
          </p>
        </div>
      </div>
    </div>
  );
});

export default ReelCompilingPlaceholder;
