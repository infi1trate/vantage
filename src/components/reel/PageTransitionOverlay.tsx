/**
 * Page Transition Overlay
 * 
 * Subtle fade-through-black transition for mode changes.
 * Used when transitioning from Session Detail to Reel Editor.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Film } from "lucide-react";

interface PageTransitionOverlayProps {
  /** Whether the transition is active */
  isActive: boolean;
  /** Called when fade-in completes (at peak darkness) */
  onFadeInComplete?: () => void;
  /** Optional label to show during transition */
  label?: string;
}

export function PageTransitionOverlay({
  isActive,
  onFadeInComplete,
  label = "Opening Reel Editor",
}: PageTransitionOverlayProps) {
  const [phase, setPhase] = useState<"idle" | "fading-in" | "peak" | "fading-out">("idle");

  useEffect(() => {
    if (isActive && phase === "idle") {
      setPhase("fading-in");
    }
  }, [isActive, phase]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          onAnimationComplete={() => {
            if (phase === "fading-in") {
              setPhase("peak");
              // Small delay at peak before triggering navigation
              setTimeout(() => {
                onFadeInComplete?.();
              }, 50);
            }
          }}
        >
          {/* Centered content - subtle indicator */}
          <motion.div
            className="flex flex-col items-center gap-3"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.1, delay: 0.05 }}
          >
            <div className="p-3 rounded-xl bg-vantage-warning/10 border border-vantage-warning/20">
              <Film className="h-6 w-6 text-vantage-warning" />
            </div>
            <span className="text-sm text-muted-foreground font-medium">
              {label}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
