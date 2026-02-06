import { memo } from "react";
import { Trophy, Sparkles, Medal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Challenge, ChallengePrize } from "@/lib/challenges/types";

interface PrizeDisplayProps {
  prizePool: string | null;
  prizesTop3: ChallengePrize[];
  className?: string;
}

export const PrizeDisplay = memo(function PrizeDisplay({
  prizePool,
  prizesTop3,
  className,
}: PrizeDisplayProps) {
  if (!prizePool && prizesTop3.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Main Prize Pool */}
      {prizePool && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/20">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span className="font-mono font-bold text-primary text-sm">
            {prizePool}
          </span>
        </div>
      )}

      {/* Top 3 Prizes */}
      {prizesTop3.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Medal className="h-3.5 w-3.5 text-yellow-500" />
            <span>Top 3</span>
          </div>
          <div className="flex items-center gap-2">
            {prizesTop3.slice(0, 3).map((prize) => (
              <span key={prize.rank} className="font-mono">
                {prize.rank === 1 && '🥇'}
                {prize.rank === 2 && '🥈'}
                {prize.rank === 3 && '🥉'}
                {prize.amount} {prize.currency}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
