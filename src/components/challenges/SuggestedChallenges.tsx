import { useState, useMemo, useCallback } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock, Flame, ChevronRight, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Challenge } from "@/lib/challenges";
import { useChallenges } from "@/hooks/useChallenges";
import { SubmissionModal } from "./SubmissionModal";

interface SuggestedChallengesProps {
  gameName?: string | null;
  sessionId: string;
  sessionTitle: string;
  sessionVideoUrl?: string | null;
  sessionThumbnailUrl?: string | null;
  sessionDuration?: number | null;
  annotations: {
    id: string;
    annotation_type: string;
    title?: string | null;
    content?: string | null;
    timestamp_seconds: number;
  }[];
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

export function SuggestedChallenges({
  gameName,
  sessionId,
  sessionTitle,
  sessionVideoUrl,
  sessionThumbnailUrl,
  sessionDuration,
  annotations,
}: SuggestedChallengesProps) {
  const { data: challenges } = useChallenges("active");
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [submissionOpen, setSubmissionOpen] = useState(false);

  // Filter to active challenges matching this game
  const suggested = useMemo(() => {
    if (!challenges) return [];
    return challenges
      .filter(
        (c) =>
          c.status === "active" &&
          gameName &&
          c.game_name?.toLowerCase() === gameName.toLowerCase()
      )
      .sort((a, b) => {
        const aEnd = a.ends_at ? new Date(a.ends_at).getTime() : Infinity;
        const bEnd = b.ends_at ? new Date(b.ends_at).getTime() : Infinity;
        return aEnd - bEnd;
      })
      .slice(0, 6);
  }, [challenges, gameName]);

  const handleSubmitMoment = useCallback(
    (challenge: Challenge) => {
      setSelectedChallenge(challenge);
      setSubmissionOpen(true);
    },
    []
  );

  // Build the pre-selected annotation based on count and challenge requirements
  const preSelectedAnnotation = useMemo(() => {
    if (!selectedChallenge) return null;
    const minMoments = selectedChallenge.required_moments_min ?? 1;
    // Only pre-select if single-moment challenge with exactly one annotation
    if (minMoments <= 1 && annotations.length === 1) return annotations[0];
    return null; // multiple or zero — let the modal handle it
  }, [annotations, selectedChallenge]);

  const submissionSession = useMemo(
    () => ({
      id: sessionId,
      title: sessionTitle,
      thumbnail_url: sessionThumbnailUrl,
      video_url: sessionVideoUrl,
      duration_seconds: sessionDuration,
      annotations,
    }),
    [sessionId, sessionTitle, sessionThumbnailUrl, sessionVideoUrl, sessionDuration, annotations]
  );

  if (suggested.length === 0) return null;

  return (
    <>
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Challenges you could submit this session to
          </h3>
        </div>

        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2">
            {suggested.map((challenge) => {
              const timeLeft = getTimeRemaining(challenge.ends_at);
              const minMoments = challenge.required_moments_min ?? 1;
              const hasEnoughMoments = annotations.length >= minMoments;
              const isMultiMoment = minMoments > 1;

              return (
                <div
                  key={challenge.id}
                  className={cn(
                    "shrink-0 w-64 rounded-xl border border-border bg-card p-3.5 flex flex-col gap-2.5 transition-colors",
                    "hover:border-primary/30 hover:bg-card/80"
                  )}
                >
                  {/* Title + difficulty */}
                  <div className="space-y-1">
                    <p className="text-sm font-medium truncate">{challenge.title}</p>
                    {challenge.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {challenge.description}
                      </p>
                    )}
                  </div>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-1.5">
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
                    {challenge.game_name && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 h-4"
                      >
                        {challenge.game_name}
                      </Badge>
                    )}
                  </div>

                  {/* Multi-moment requirement */}
                  {isMultiMoment && (
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={hasEnoughMoments ? "secondary" : "outline"}
                        className={cn(
                          "text-[11px] px-1.5 py-0 h-5 gap-1",
                          hasEnoughMoments
                            ? "bg-primary/10 text-primary border-primary/20"
                            : "text-muted-foreground border-border"
                        )}
                      >
                        <Layers className="h-3 w-3" />
                        Requires {minMoments} moments
                      </Badge>
                      {!hasEnoughMoments && (
                        <span className="text-[10px] text-muted-foreground">
                          ({annotations.length}/{minMoments})
                        </span>
                      )}
                    </div>
                  )}

                  {/* CTA */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5 mt-auto border-primary/20 text-primary hover:bg-primary/10 hover:border-primary/40"
                    onClick={() => handleSubmitMoment(challenge)}
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    Submit Moment
                    <ChevronRight className="h-3 w-3 ml-auto" />
                  </Button>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Submission Modal */}
      {selectedChallenge && (
        <SubmissionModal
          open={submissionOpen}
          onOpenChange={setSubmissionOpen}
          challenge={selectedChallenge}
          selectedSession={submissionSession}
          selectedAnnotation={preSelectedAnnotation}
          onSuccess={() => {
            setSelectedChallenge(null);
          }}
        />
      )}
    </>
  );
}
