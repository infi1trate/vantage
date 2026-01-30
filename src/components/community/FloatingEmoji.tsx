import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface FloatingEmojiProps {
  emoji: string | null;
  onComplete: () => void;
  className?: string;
}

export function FloatingEmoji({
  emoji,
  onComplete,
  className,
}: FloatingEmojiProps) {
  return (
    <AnimatePresence>
      {emoji && (
        <motion.div
          key={emoji + Date.now()}
          initial={{ opacity: 1, y: 0, scale: 1 }}
          animate={{ opacity: 0, y: -40, scale: 1.3 }}
          exit={{ opacity: 0 }}
          transition={{ 
            duration: 0.6, 
            ease: [0.25, 0.46, 0.45, 0.94] // ease-out quad
          }}
          onAnimationComplete={onComplete}
          className={cn(
            "absolute text-2xl pointer-events-none z-50",
            "drop-shadow-lg",
            className
          )}
        >
          {emoji}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
