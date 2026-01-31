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
          initial={{ opacity: 1, y: 0, scale: 1.2, rotate: -5 }}
          animate={{ 
            opacity: 0, 
            y: -60, 
            scale: 1.8,
            rotate: 5,
          }}
          exit={{ opacity: 0 }}
          transition={{ 
            duration: 0.7, 
            ease: [0.25, 0.46, 0.45, 0.94]
          }}
          onAnimationComplete={onComplete}
          className={cn(
            "absolute text-3xl pointer-events-none z-50",
            "drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]",
            className
          )}
        >
          {emoji}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
