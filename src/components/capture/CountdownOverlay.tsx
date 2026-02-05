import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, Pause, Play } from "lucide-react";

interface CountdownOverlayProps {
  isOpen: boolean;
  onComplete: () => Promise<void> | void;
  onCancel: () => void;
  startFrom?: number;
}

const HARD_TIMEOUT_MS = 10000; // 10 second failsafe

export function CountdownOverlay({
  isOpen,
  onComplete,
  onCancel,
  startFrom = 5,
}: CountdownOverlayProps) {
  const [displayCount, setDisplayCount] = useState(startFrom);
  const [isPaused, setIsPaused] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Refs to avoid stale closure issues
  const remainingRef = useRef(startFrom);
  const pausedRef = useRef(false);
  const canceledRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedAtRef = useRef<number | null>(null);

  // Clear interval helper
  const clearCountdownInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Clear hard timeout helper
  const clearHardTimeout = useCallback(() => {
    if (hardTimeoutRef.current) {
      clearTimeout(hardTimeoutRef.current);
      hardTimeoutRef.current = null;
    }
  }, []);

  // Start the countdown interval
  const startCountdownInterval = useCallback(() => {
    clearCountdownInterval();
    
    intervalRef.current = setInterval(() => {
      // Check if canceled
      if (canceledRef.current) {
        clearCountdownInterval();
        return;
      }

      // Check if paused
      if (pausedRef.current) {
        return; // Don't tick while paused
      }

      // Decrement
      remainingRef.current -= 1;
      const newCount = remainingRef.current;
      
      console.log(`[countdown] tick n=${newCount}`);
      setDisplayCount(newCount);

      // Check if complete
      if (newCount <= 0) {
        console.log("[countdown] complete -> startRecording");
        clearCountdownInterval();
      }
    }, 1000);
  }, [clearCountdownInterval]);

  // Handle countdown completion
  const handleComplete = useCallback(async () => {
    if (isCompleting || canceledRef.current) return;
    
    setIsCompleting(true);
    clearHardTimeout();
    
    console.log("[record] startRecording called");
    
    try {
      await onComplete();
      console.log("[record] startRecording success");
    } catch (error) {
      console.error("[record] startRecording failed", error);
      // onComplete should handle its own error display
    }
    
    // Always reset completing state (overlay closure is handled by parent)
    setIsCompleting(false);
  }, [onComplete, isCompleting, clearHardTimeout]);

  // Watch for countdown reaching zero
  useEffect(() => {
    if (displayCount <= 0 && isOpen && !canceledRef.current && !isCompleting) {
      handleComplete();
    }
  }, [displayCount, isOpen, isCompleting, handleComplete]);

  // Initialize/reset when overlay opens
  useEffect(() => {
    if (isOpen) {
      console.log(`[countdown] start at ${startFrom}`);
      
      // Reset all refs
      remainingRef.current = startFrom;
      pausedRef.current = false;
      canceledRef.current = false;
      openedAtRef.current = Date.now();
      
      // Reset state
      setDisplayCount(startFrom);
      setIsPaused(false);
      setIsCompleting(false);
      
      // Start countdown
      startCountdownInterval();
      
      // Set hard timeout failsafe
      clearHardTimeout();
      hardTimeoutRef.current = setTimeout(() => {
        if (!canceledRef.current && remainingRef.current > 0) {
          console.error("[countdown] HARD TIMEOUT - auto-canceling after 10s");
          canceledRef.current = true;
          clearCountdownInterval();
          onCancel();
        }
      }, HARD_TIMEOUT_MS);
    } else {
      // Cleanup when closing
      clearCountdownInterval();
      clearHardTimeout();
    }

    return () => {
      clearCountdownInterval();
      clearHardTimeout();
    };
  }, [isOpen, startFrom, startCountdownInterval, clearCountdownInterval, clearHardTimeout, onCancel]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        console.log("[countdown] canceled=true (ESC)");
        canceledRef.current = true;
        clearCountdownInterval();
        clearHardTimeout();
        onCancel();
      } else if (e.code === "Space") {
        e.preventDefault();
        togglePause();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel, clearCountdownInterval, clearHardTimeout]);

  // Toggle pause
  const togglePause = useCallback(() => {
    if (canceledRef.current || isCompleting) return;
    
    const newPaused = !pausedRef.current;
    pausedRef.current = newPaused;
    setIsPaused(newPaused);
    
    console.log(`[countdown] paused=${newPaused}`);
    
    if (newPaused) {
      // Pause: stop interval but keep refs
      clearCountdownInterval();
    } else {
      // Resume: restart interval only if not canceled
      if (!canceledRef.current) {
        startCountdownInterval();
      }
    }
  }, [clearCountdownInterval, startCountdownInterval, isCompleting]);

  // Cancel button handler
  const handleCancel = useCallback(() => {
    console.log("[countdown] canceled=true (button)");
    canceledRef.current = true;
    clearCountdownInterval();
    clearHardTimeout();
    onCancel();
  }, [onCancel, clearCountdownInterval, clearHardTimeout]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
        >
          {/* Background with neon yellow tint, blur, and vignette */}
          <div 
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse at center, transparent 0%, hsla(0, 0%, 0%, 0.85) 100%),
                hsla(66, 100%, 50%, 0.12)
              `,
              backdropFilter: "blur(8px)",
            }}
          />

          {/* Countdown number */}
          <div className="relative z-10 flex flex-col items-center gap-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={displayCount}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{
                  duration: 0.4,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="relative"
              >
                {/* Glow effect behind number */}
                <div 
                  className="absolute inset-0 blur-3xl"
                  style={{
                    background: "hsl(var(--vantage-lime) / 0.4)",
                    transform: "scale(2)",
                  }}
                />
                
                {/* The countdown number */}
                <span 
                  className="relative font-display text-[20rem] leading-none tracking-tighter"
                  style={{
                    color: "hsl(var(--vantage-lime))",
                    textShadow: `
                      0 0 40px hsl(var(--vantage-lime) / 0.8),
                      0 0 80px hsl(var(--vantage-lime) / 0.5),
                      0 0 120px hsl(var(--vantage-lime) / 0.3)
                    `,
                  }}
                >
                  {displayCount > 0 ? displayCount : "GO"}
                </span>
              </motion.div>
            </AnimatePresence>

            {/* Paused indicator */}
            <AnimatePresence>
              {isPaused && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full mt-4"
                >
                  <span 
                    className="font-barlow text-2xl font-semibold uppercase tracking-widest"
                    style={{ color: "hsl(var(--vantage-lime))" }}
                  >
                    Paused
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Completing indicator */}
            <AnimatePresence>
              {isCompleting && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full mt-4"
                >
                  <span 
                    className="font-barlow text-2xl font-semibold uppercase tracking-widest"
                    style={{ color: "hsl(var(--vantage-lime))" }}
                  >
                    Starting...
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Controls */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="absolute bottom-12 flex items-center gap-4 z-10"
          >
            <Button
              variant="outline"
              size="lg"
              onClick={handleCancel}
              disabled={isCompleting}
              className="min-w-32 border-muted-foreground/30 bg-background/50 backdrop-blur-sm uppercase tracking-wider text-xs hover:bg-background/70"
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              onClick={togglePause}
              disabled={isCompleting || displayCount <= 0}
              className="min-w-32 border-muted-foreground/30 bg-background/50 backdrop-blur-sm uppercase tracking-wider text-xs hover:bg-background/70"
            >
              {isPaused ? (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </>
              )}
            </Button>
          </motion.div>

          {/* Keyboard hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="absolute bottom-6 text-xs text-muted-foreground uppercase tracking-wider z-10"
          >
            <kbd className="px-1.5 py-0.5 bg-muted/50 rounded font-mono text-foreground">ESC</kbd>
            {" "}to cancel • 
            <kbd className="px-1.5 py-0.5 bg-muted/50 rounded font-mono text-foreground ml-1">Space</kbd>
            {" "}to {isPaused ? "resume" : "pause"}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
