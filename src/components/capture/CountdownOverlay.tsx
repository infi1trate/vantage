import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, Pause, Play } from "lucide-react";

interface CountdownOverlayProps {
  isOpen: boolean;
  onComplete: () => void;
  onCancel: () => void;
  startFrom?: number;
}

export function CountdownOverlay({
  isOpen,
  onComplete,
  onCancel,
  startFrom = 5,
}: CountdownOverlayProps) {
  const [count, setCount] = useState(startFrom);
  const [isPaused, setIsPaused] = useState(false);

  // Reset count when overlay opens
  useEffect(() => {
    if (isOpen) {
      setCount(startFrom);
      setIsPaused(false);
    }
  }, [isOpen, startFrom]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || isPaused) return;

    if (count <= 0) {
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setCount((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isOpen, count, isPaused, onComplete]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.code === "Space") {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

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
                key={count}
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
                  {count}
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
              onClick={onCancel}
              className="min-w-32 border-muted-foreground/30 bg-background/50 backdrop-blur-sm uppercase tracking-wider text-xs hover:bg-background/70"
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              onClick={togglePause}
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
