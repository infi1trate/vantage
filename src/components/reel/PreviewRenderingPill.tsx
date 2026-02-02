/**
 * Preview Rendering Pill
 * 
 * Subtle indicator shown overlaid on the player when preview is rendering in background.
 * Non-blocking - user can interact with editor immediately.
 */

import { memo, useState, useEffect, useRef } from "react";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { PreviewStatus } from "@/lib/reels";

interface PreviewRenderingPillProps {
  previewStatus: PreviewStatus;
  className?: string;
}

export const PreviewRenderingPill = memo(function PreviewRenderingPill({
  previewStatus,
  className,
}: PreviewRenderingPillProps) {
  // Track when preview became ready to auto-hide success
  const [showSuccess, setShowSuccess] = useState(false);
  const prevStatusRef = useRef(previewStatus);
  
  useEffect(() => {
    // Detect transition to "ready"
    if (previewStatus === "ready" && prevStatusRef.current !== "ready") {
      setShowSuccess(true);
      // Hide success after 3 seconds
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
    prevStatusRef.current = previewStatus;
  }, [previewStatus]);
  
  const isRendering = previewStatus === "rendering";
  const isPending = previewStatus === "pending";
  
  // Don't show for failed states
  if (previewStatus === "failed") return null;
  
  return (
    <AnimatePresence>
      {(isRendering || isPending) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "absolute top-3 left-3 z-10",
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full",
            "bg-background/80 backdrop-blur-sm border border-border/50",
            "text-xs font-medium text-muted-foreground",
            "shadow-sm",
            className
          )}
        >
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          <span>Preview rendering…</span>
        </motion.div>
      )}
      
      {/* Brief success indicator when preview becomes ready */}
      {showSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "absolute top-3 left-3 z-10",
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full",
            "bg-vantage-success/10 backdrop-blur-sm border border-vantage-success/30",
            "text-xs font-medium text-vantage-success",
            "shadow-sm",
            className
          )}
        >
          <Check className="h-3 w-3" />
          <span>Preview ready</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default PreviewRenderingPill;
