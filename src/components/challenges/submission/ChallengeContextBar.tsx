import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, Scissors, Info, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChallengeContextBarProps {
  ruleSummary?: string;
  minClipDuration?: number; // in seconds
  maxClipDuration?: number; // in seconds
  endsAt?: string | null;
  requiredMoments?: number;
}

export function ChallengeContextBar({
  ruleSummary,
  minClipDuration = 5,
  maxClipDuration = 60,
  endsAt,
  requiredMoments = 1,
}: ChallengeContextBarProps) {
  const getTimeRemaining = () => {
    if (!endsAt) return null;

    const now = new Date();
    const end = new Date(endsAt);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return { text: "Ended", urgent: true };

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return { text: `${days}d ${hours}h left`, urgent: false };
    }
    if (hours > 0) {
      return { text: `${hours}h ${minutes}m left`, urgent: hours < 2 };
    }
    return { text: `${minutes}m left`, urgent: true };
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const timeRemaining = getTimeRemaining();

  return (
    <div className={cn(
      "grid grid-cols-1 gap-2 p-3 rounded-lg bg-muted/30 border border-border",
      requiredMoments > 1 ? "sm:grid-cols-4" : "sm:grid-cols-3"
    )}>
      {/* Rule summary */}
      <div className="flex items-start gap-2 sm:col-span-1">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground line-clamp-2">
          {ruleSummary || "Complete the challenge objective"}
        </p>
      </div>

      {/* Clip duration */}
      <div className="flex items-center gap-2">
        <Scissors className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm">
          <span className="text-muted-foreground">Clip: </span>
          <span className="font-medium">
            {formatDuration(minClipDuration)} – {formatDuration(maxClipDuration)}
          </span>
        </span>
      </div>

      {/* Required moments */}
      {requiredMoments > 1 && (
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm">
            <span className="text-muted-foreground">Moments: </span>
            <span className="font-medium">{requiredMoments} required</span>
          </span>
        </div>
      )}

      {/* Time remaining */}
      {timeRemaining && (
        <div className="flex items-center justify-start sm:justify-end gap-2">
          {timeRemaining.urgent ? (
            <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <Badge
            variant={timeRemaining.urgent ? "destructive" : "secondary"}
            className={cn(
              "text-xs",
              timeRemaining.urgent && "bg-yellow-500/20 text-yellow-600 dark:text-yellow-500 border-yellow-500/30"
            )}
          >
            {timeRemaining.text}
          </Badge>
        </div>
      )}
    </div>
  );
}
