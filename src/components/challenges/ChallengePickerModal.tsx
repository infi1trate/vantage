import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy, Clock, Flame, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Challenge } from "@/lib/challenges";
import { useChallenges } from "@/hooks/useChallenges";

interface ChallengePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameName?: string | null;
  onSelect: (challenge: Challenge) => void;
}

function getTimeRemaining(endsAt: string | null): string | null {
  if (!endsAt) return null;
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  const diff = end - now;
  if (diff <= 0) return "Ended";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d left`;
  if (hours > 0) return `${hours}h left`;
  const mins = Math.floor(diff / (1000 * 60));
  return `${mins}m left`;
}

export function ChallengePickerModal({
  open,
  onOpenChange,
  gameName,
  onSelect,
}: ChallengePickerModalProps) {
  const { data: challenges, isLoading } = useChallenges("active");

  // Filter to active challenges, prioritize same game
  const sortedChallenges = useMemo(() => {
    if (!challenges) return [];
    const active = challenges.filter((c) => c.status === "active");
    // Sort: same game first, then by end date (soonest first)
    return active.sort((a, b) => {
      const aMatch = gameName && a.game_name?.toLowerCase() === gameName.toLowerCase() ? 0 : 1;
      const bMatch = gameName && b.game_name?.toLowerCase() === gameName.toLowerCase() ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      const aEnd = a.ends_at ? new Date(a.ends_at).getTime() : Infinity;
      const bEnd = b.ends_at ? new Date(b.ends_at).getTime() : Infinity;
      return aEnd - bEnd;
    });
  }, [challenges, gameName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Trophy className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base">Submit to Challenge</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pick an active challenge for this moment
              </p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(80vh-100px)]">
          <div className="p-4 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sortedChallenges.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Trophy className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">No active challenges</p>
                <p className="text-xs mt-1">Check back later for new challenges.</p>
              </div>
            ) : (
              sortedChallenges.map((challenge) => {
                const timeLeft = getTimeRemaining(challenge.ends_at);
                const isGameMatch =
                  gameName && challenge.game_name?.toLowerCase() === gameName.toLowerCase();

                return (
                  <button
                    key={challenge.id}
                    type="button"
                    onClick={() => {
                      onSelect(challenge);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                      "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "border-border bg-card"
                    )}
                  >
                    {/* Thumbnail */}
                    <div className="shrink-0 h-12 w-12 rounded-md overflow-hidden bg-muted">
                      {challenge.thumbnail_url ? (
                        <img
                          src={challenge.thumbnail_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                          <Trophy className="h-5 w-5 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium truncate">{challenge.title}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {isGameMatch && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary"
                          >
                            This game
                          </Badge>
                        )}
                        {challenge.game_name && (
                          <span className="text-[11px] text-muted-foreground">
                            {challenge.game_name}
                          </span>
                        )}
                        {timeLeft && (
                          <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {timeLeft}
                          </span>
                        )}
                        {challenge.difficulty && challenge.difficulty >= 3 && (
                          <span className="flex items-center gap-0.5 text-[11px] text-orange-400">
                            <Flame className="h-3 w-3" />
                            Hard
                          </span>
                        )}
                      </div>
                      {challenge.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {challenge.description}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
