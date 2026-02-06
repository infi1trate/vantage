import { memo } from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface DifficultyIndicatorProps {
  level: 1 | 2 | 3 | 4 | 5;
  className?: string;
}

const DIFFICULTY_LABELS = ['Easy', 'Normal', 'Hard', 'Expert', 'Legendary'];

export const DifficultyIndicator = memo(function DifficultyIndicator({
  level,
  className,
}: DifficultyIndicatorProps) {
  const clampedLevel = Math.min(5, Math.max(1, level));
  
  return (
    <div 
      className={cn("flex items-center gap-0.5", className)} 
      title={`Difficulty: ${DIFFICULTY_LABELS[clampedLevel - 1]}`}
      aria-label={`Difficulty level ${clampedLevel} out of 5: ${DIFFICULTY_LABELS[clampedLevel - 1]}`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Flame
          key={i}
          className={cn(
            "h-3.5 w-3.5 transition-colors",
            i < clampedLevel 
              ? "text-orange-500 fill-orange-500/30" 
              : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
});
