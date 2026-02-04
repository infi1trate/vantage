/**
 * Page Transition Overlay
 * 
 * Subtle fade-through-black transition for mode changes.
 * Used when transitioning from Session Detail to Reel Editor.
 * 
 * SAFETY: Includes automatic timeout to prevent permanent black screen
 * if navigation fails or callback throws.
 */

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Film, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface PageTransitionOverlayProps {
  /** Whether the transition is active */
  isActive: boolean;
  /** Called when fade-in completes (at peak darkness) */
  onFadeInComplete?: () => void;
  /** Optional label to show during transition */
  label?: string;
  /** Safety timeout in ms to auto-dismiss if stuck (default: 5000) */
  timeoutMs?: number;
  /** Called if overlay times out (for cleanup) */
  onTimeout?: () => void;
}

export function PageTransitionOverlay({
  isActive,
  onFadeInComplete,
  label = "Opening Reel Editor",
  timeoutMs = 5000,
  onTimeout,
}: PageTransitionOverlayProps) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"idle" | "fading-in" | "peak" | "fading-out" | "error">("idle");
  const [showError, setShowError] = useState(false);
  const callbackFiredRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state when overlay becomes inactive
  useEffect(() => {
    if (!isActive) {
      setPhase("idle");
      setShowError(false);
      callbackFiredRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [isActive]);

  // Start transition when active
  useEffect(() => {
    if (isActive && phase === "idle") {
      setPhase("fading-in");
      
      // Safety timeout - if we're still active after timeoutMs, show error state
      timeoutRef.current = setTimeout(() => {
        console.error("[PageTransitionOverlay] Timeout - overlay stuck, showing error recovery");
        setPhase("error");
        setShowError(true);
        onTimeout?.();
      }, timeoutMs);
    }
  }, [isActive, phase, timeoutMs, onTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleReturnToLibrary = () => {
    setShowError(false);
    navigate("/library");
  };

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
            if (phase === "fading-in" && !callbackFiredRef.current) {
              setPhase("peak");
              callbackFiredRef.current = true;
              
              // Clear timeout since callback will fire
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
              }
              
              // Small delay at peak before triggering navigation
              setTimeout(() => {
                try {
                  onFadeInComplete?.();
                } catch (error) {
                  console.error("[PageTransitionOverlay] Callback error:", error);
                  setPhase("error");
                  setShowError(true);
                }
              }, 50);
            }
          }}
        >
          {/* Error state - show recovery UI */}
          {showError ? (
            <motion.div
              className="flex flex-col items-center gap-4 text-center px-6"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Something went wrong
                </p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  The reel editor couldn't be opened. Your reel may still be processing in the background.
                </p>
              </div>
              <Button onClick={handleReturnToLibrary} className="mt-2">
                Return to Library
              </Button>
            </motion.div>
          ) : (
            /* Normal transition content */
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
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
