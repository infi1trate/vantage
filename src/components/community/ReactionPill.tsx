/**
 * ReactionPill - Emoji reaction selector that appears near playback controls
 * Premium, restrained design with instant reaction recording
 * Mobile-first with bottom sheet on small screens
 */

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { REACTION_EMOJIS, ReactionType } from "@/lib/communityReactions";
import { useIsMobile } from "@/hooks/use-mobile";

interface ReactionPillProps {
  onReact: (emoji: ReactionType) => void;
  disabled?: boolean;
  className?: string;
}

export function ReactionPill({ onReact, disabled, className }: ReactionPillProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [recentReaction, setRecentReaction] = useState<ReactionType | null>(null);

  const handleReact = useCallback(
    (emoji: ReactionType) => {
      if (disabled) return;
      setRecentReaction(emoji);
      onReact(emoji);
      setIsOpen(false);
      
      // Clear recent reaction indicator after animation
      setTimeout(() => setRecentReaction(null), 600);
    },
    [onReact, disabled]
  );

  return (
    <div className={cn("relative", className)}>
      {/* Trigger button */}
      <motion.button
        className={cn(
          "relative flex items-center gap-1 px-3 py-1.5 rounded-full",
          "bg-background/80 backdrop-blur-sm border border-border/50",
          "text-sm font-medium transition-all duration-200",
          "hover:bg-muted/80 hover:border-primary/30",
          "focus:outline-none focus:ring-2 focus:ring-primary/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        whileTap={{ scale: 0.95 }}
      >
        <span className="text-lg leading-none">😊</span>
        <span className="text-muted-foreground text-xs">React</span>
      </motion.button>

      {/* Emoji picker - Desktop popover */}
      <AnimatePresence>
        {isOpen && !isMobile && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "absolute bottom-full left-0 mb-2 z-50",
              "flex gap-0.5 p-1.5 rounded-full",
              "bg-background/95 backdrop-blur-md border border-border/50",
              "shadow-lg shadow-black/20"
            )}
          >
            {REACTION_EMOJIS.map((emoji) => (
              <motion.button
                key={emoji}
                className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-full",
                  "text-xl transition-colors duration-150",
                  "hover:bg-primary/20 focus:outline-none focus:bg-primary/20",
                  recentReaction === emoji && "bg-primary/30"
                )}
                onClick={() => handleReact(emoji)}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
              >
                {emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emoji picker - Mobile bottom sheet */}
      <AnimatePresence>
        {isOpen && isMobile && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Bottom sheet */}
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={cn(
                "fixed bottom-0 left-0 right-0 z-50",
                "p-4 pb-8 rounded-t-2xl",
                "bg-card border-t border-border/50",
                "safe-bottom"
              )}
            >
              {/* Handle */}
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-4" />
              
              <p className="text-center text-sm text-muted-foreground mb-4">
                React to this moment
              </p>
              
              <div className="flex justify-center gap-2">
                {REACTION_EMOJIS.map((emoji) => (
                  <motion.button
                    key={emoji}
                    className={cn(
                      "w-12 h-12 flex items-center justify-center rounded-full",
                      "text-2xl bg-muted/50 active:bg-primary/20",
                      "focus:outline-none focus:ring-2 focus:ring-primary/50",
                      recentReaction === emoji && "bg-primary/30"
                    )}
                    onClick={() => handleReact(emoji)}
                    whileTap={{ scale: 0.9 }}
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Click-away handler - Desktop only */}
      {isOpen && !isMobile && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Floating emoji animation when reaction is added
 */
interface FloatingReactionProps {
  emoji: ReactionType;
  onComplete: () => void;
}

export function FloatingReaction({ emoji, onComplete }: FloatingReactionProps) {
  return (
    <motion.div
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -40, scale: 1.2 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      onAnimationComplete={onComplete}
      className="absolute pointer-events-none text-2xl z-50"
      style={{ left: "50%", transform: "translateX(-50%)" }}
    >
      {emoji}
    </motion.div>
  );
}
