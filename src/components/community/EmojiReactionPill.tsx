import { useState } from "react";
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
  const isMobile = useIsMobile();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className={cn(
            "flex items-center gap-1 rounded-full",
            "bg-popover/95 backdrop-blur-md border border-border/50",
            "shadow-lg shadow-black/30",
            isMobile ? "px-2 py-2" : "px-2 py-1.5",
            className
          )}
        >
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onReact(emoji)}
              onMouseEnter={() => !isMobile && setHoveredEmoji(emoji)}
              onMouseLeave={() => !isMobile && setHoveredEmoji(null)}
              className={cn(
                "flex items-center justify-center rounded-full",
                "transition-all duration-150 ease-out",
                "hover:bg-muted/50 active:scale-90",
                isMobile ? "w-10 h-10" : "w-8 h-8",
                hoveredEmoji === emoji && !isMobile && "scale-125 -translate-y-1"
              )}
            >
              <span className={cn(isMobile ? "text-xl" : "text-lg")}>{emoji}</span>
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
