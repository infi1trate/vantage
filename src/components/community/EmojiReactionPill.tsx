import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { REACTION_EMOJIS, ReactionEmoji } from "@/lib/communityReactions";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

interface EmojiReactionPillProps {
  onReact: (emoji: ReactionEmoji) => void;
  isVisible: boolean;
  className?: string;
}

export function EmojiReactionPill({
  onReact,
  isVisible,
  className,
}: EmojiReactionPillProps) {
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);
  const [lastClicked, setLastClicked] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const handleClick = useCallback((emoji: ReactionEmoji) => {
    setLastClicked(emoji);
    onReact(emoji);
    
    // Reset click animation
    setTimeout(() => setLastClicked(null), 200);
  }, [onReact]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.9 }}
          transition={{ 
            duration: 0.2, 
            ease: [0.25, 0.46, 0.45, 0.94] 
          }}
          className={cn(
            "flex items-center gap-0.5 rounded-full",
            "bg-card/95 backdrop-blur-md border border-border/50",
            "shadow-xl shadow-black/40",
            isMobile ? "px-2 py-2" : "px-3 py-2",
            className
          )}
        >
          {/* Fun label on desktop */}
          {!isMobile && (
            <span className="text-xs text-muted-foreground mr-1 select-none">
              React
            </span>
          )}
          
          {REACTION_EMOJIS.map((emoji, index) => (
            <motion.button
              key={emoji}
              onClick={() => handleClick(emoji)}
              onMouseEnter={() => !isMobile && setHoveredEmoji(emoji)}
              onMouseLeave={() => !isMobile && setHoveredEmoji(null)}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                y: hoveredEmoji === emoji ? -4 : 0,
              }}
              transition={{ 
                delay: index * 0.03,
                duration: 0.15,
                y: { duration: 0.1 }
              }}
              whileTap={{ scale: 0.8 }}
              className={cn(
                "flex items-center justify-center rounded-full",
                "transition-colors duration-100",
                "hover:bg-primary/10 active:bg-primary/20",
                isMobile ? "w-11 h-11" : "w-9 h-9",
                lastClicked === emoji && "ring-2 ring-primary/50"
              )}
            >
              <span 
                className={cn(
                  "transition-transform duration-100",
                  isMobile ? "text-2xl" : "text-xl",
                  hoveredEmoji === emoji && "scale-125"
                )}
              >
                {emoji}
              </span>
            </motion.button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
